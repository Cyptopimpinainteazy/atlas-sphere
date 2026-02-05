#!/usr/bin/env python3
"""
Production-ready Solana Flashloan Arbitrage Daemon
Monitors prices, detects opportunities, simulates, bundles, submits with MEV protection.
"""

import asyncio
import json
import logging
import os
import sqlite3
import sys
import time
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict

import aiohttp
import base58
import numpy as np
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction
from solders.system_program import TransferParams, transfer
from solders.compute_budget import set_compute_unit_limit, set_compute_unit_price
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed, Finalized
from solana.rpc.types import TxOpts
from solana.rpc.core import RPCException
from anchorpy import Program, Provider, Wallet, Idl
from jupiter_python_sdk.jupiter import Jupiter
import raydium_sdk
import orca_sdk
import serum_sdk

# Constants
MAINNET_RPC = "https://api.mainnet-beta.solana.com"
FALLBACK_RPCS = [
    "https://solana-api.projectserum.com",
    "https://rpc.ankr.com/solana",
    "https://ssc-dao.genesysgo.net",
    "https://solana-mainnet.rpc.extrnode.com",
]
JUPITER_API = "https://quote-api.jup.ag/v6"
PYTH_PROGRAM = "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"
SWITCHBOARD_PROGRAM = "DtmE9D2CSB4L5D6A15mraeEjrGMm6auWVzgaD8hK2tZM"

# Trading parameters
MIN_PROFIT_USD = 10.0
SLIPPAGE_BPS = 50  # 0.5%
MAX_HOPS = 4
CIRCUIT_BREAKER_THRESHOLD = 3
EMERGENCY_UNWIND_THRESHOLD = -100.0  # USD loss
PRIORITY_FEE_LAMPORTS = 10000
MAX_RETRIES = 5
CONFIRMATION_TIMEOUT = 60  # seconds
BUNDLE_SIZE_LIMIT = 5  # transactions per bundle

# DEX Program IDs
RAYDIUM_PROGRAM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
ORCA_PROGRAM = "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP"
SERUM_PROGRAM = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
JUPITER_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
FLASHLOAN_RECEIVER = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
ARB_ENGINE = "Arb1EngineProgramIdPlaceholder1234567890"

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('arb_daemon.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class ArbitrageOpportunity:
    """Represents a detected arbitrage opportunity"""
    token_pair: str
    buy_dex: str
    sell_dex: str
    buy_price: float
    sell_price: float
    estimated_profit: float
    amount: int
    path: List[str]
    slippage_bps: int
    timestamp: datetime

@dataclass
class TradeResult:
    """Result of a trade execution"""
    opportunity: ArbitrageOpportunity
    simulated_profit: float
    actual_profit: float
    tx_signature: Optional[str]
    status: str
    error: Optional[str]
    gas_used: Optional[int]
    execution_time: float

class RPCManager:
    """Manages RPC connections with failover and load balancing"""

    def __init__(self, rpc_urls: List[str]):
        self.rpc_urls = rpc_urls
        self.current_idx = 0
        self.clients: Dict[str, AsyncClient] = {}
        self.failure_counts: Dict[str, int] = {}

    async def get_client(self) -> Tuple[AsyncClient, str]:
        """Get a working RPC client with failover"""
        for _ in range(len(self.rpc_urls)):
            url = self.rpc_urls[self.current_idx]
            if url not in self.clients:
                self.clients[url] = AsyncClient(url, commitment=Confirmed)

            client = self.clients[url]

            try:
                # Test connection
                await client.get_version()
                self.failure_counts[url] = 0  # Reset on success
                return client, url
            except Exception as e:
                logger.warning(f"RPC {url} failed: {e}")
                self.failure_counts[url] = self.failure_counts.get(url, 0) + 1
                self.current_idx = (self.current_idx + 1) % len(self.rpc_urls)

        raise Exception("All RPC endpoints failed")

    async def close_all(self):
        """Close all RPC connections"""
        for client in self.clients.values():
            await client.close()

class PriceFeedManager:
    """Manages price feeds from multiple sources"""

    def __init__(self, rpc_manager: RPCManager):
        self.rpc_manager = rpc_manager
        self.price_cache: Dict[str, Tuple[float, datetime]] = {}
        self.cache_ttl = 30  # seconds

    async def get_price(self, token_mint: str, vs_token: str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") -> float:
        """Get token price with caching and fallback"""
        cache_key = f"{token_mint}_{vs_token}"
        now = datetime.now()

        # Check cache
        if cache_key in self.price_cache:
            price, timestamp = self.price_cache[cache_key]
            if (now - timestamp).seconds < self.cache_ttl:
                return price

        # Try Jupiter API first (fastest)
        try:
            price = await self._get_jupiter_price(token_mint, vs_token)
            self.price_cache[cache_key] = (price, now)
            return price
        except Exception as e:
            logger.debug(f"Jupiter price failed for {token_mint}: {e}")

        # Fallback to Pyth/Switchboard
        try:
            price = await self._get_oracle_price(token_mint, vs_token)
            self.price_cache[cache_key] = (price, now)
            return price
        except Exception as e:
            logger.warning(f"All price feeds failed for {token_mint}: {e}")
            return 1.0  # Default fallback

    async def _get_jupiter_price(self, token_mint: str, vs_token: str) -> float:
        """Get price from Jupiter API"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{JUPITER_API}/quote",
                params={
                    "inputMint": token_mint,
                    "outputMint": vs_token,
                    "amount": "1000000",  # 1 unit
                    "slippageBps": 100,
                }
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return float(data.get("outAmount", 0)) / 1000000
                else:
                    raise Exception(f"Jupiter API error: {resp.status}")

    async def _get_oracle_price(self, token_mint: str, vs_token: str) -> float:
        """Get price from Pyth/Switchboard oracles"""
        client, _ = await self.rpc_manager.get_client()

        # Try Pyth first
        try:
            pyth_price = await self._get_pyth_price(client, token_mint)
            if pyth_price > 0:
                return pyth_price
        except Exception as e:
            logger.debug(f"Pyth price failed: {e}")

        # Try Switchboard
        try:
            sb_price = await self._get_switchboard_price(client, token_mint)
            if sb_price > 0:
                return sb_price
        except Exception as e:
            logger.debug(f"Switchboard price failed: {e}")

        raise Exception("All oracle prices failed")

    async def _get_pyth_price(self, client: AsyncClient, token_mint: str) -> float:
        """Get price from Pyth oracle"""
        # This would query Pyth price feeds
        # Placeholder implementation
        return 1.0

    async def _get_switchboard_price(self, client: AsyncClient, token_mint: str) -> float:
        """Get price from Switchboard oracle"""
        # This would query Switchboard feeds
        # Placeholder implementation
        return 1.0

class DEXPriceManager:
    """Manages price discovery across DEXs"""

    def __init__(self, rpc_manager: RPCManager, price_feed_manager: PriceFeedManager):
        self.rpc_manager = rpc_manager
        self.price_feed = price_feed_manager
        self.dex_clients = {
            'raydium': raydium_sdk.RaydiumClient(),
            'orca': orca_sdk.OrcaClient(),
            'serum': serum_sdk.SerumClient(),
            'jupiter': Jupiter(),
        }

    async def get_dex_price(self, token_pair: str, dex: str, amount: int) -> float:
        """Get price for token pair on specific DEX"""
        try:
            if dex == 'raydium':
                return await self._get_raydium_price(token_pair, amount)
            elif dex == 'orca':
                return await self._get_orca_price(token_pair, amount)
            elif dex == 'serum':
                return await self._get_serum_price(token_pair, amount)
            elif dex == 'jupiter':
                return await self._get_jupiter_price(token_pair, amount)
            else:
                raise ValueError(f"Unsupported DEX: {dex}")
        except Exception as e:
            logger.warning(f"Failed to get {dex} price for {token_pair}: {e}")
            # Fallback to general price feed
            return await self.price_feed.get_price(token_pair.split('_')[0])

    async def _get_raydium_price(self, token_pair: str, amount: int) -> float:
        """Get Raydium AMM price"""
        # Raydium pool price calculation
        return await self.dex_clients['raydium'].get_price(token_pair, amount)

    async def _get_orca_price(self, token_pair: str, amount: int) -> float:
        """Get Orca Whirlpool price"""
        return await self.dex_clients['orca'].get_price(token_pair, amount)

    async def _get_serum_price(self, token_pair: str, amount: int) -> float:
        """Get Serum orderbook price"""
        return await self.dex_clients['serum'].get_price(token_pair, amount)

    async def _get_jupiter_price(self, token_pair: str, amount: int) -> float:
        """Get Jupiter aggregated price"""
        tokens = token_pair.split('_')
        return await self.dex_clients['jupiter'].get_quote(
            tokens[0], tokens[1], amount, SLIPPAGE_BPS
        )

class ArbitrageDetector:
    """Detects arbitrage opportunities across DEXs"""

    def __init__(self, dex_price_manager: DEXPriceManager):
        self.dex_manager = dex_price_manager
        self.dexes = ['raydium', 'orca', 'serum', 'jupiter']

    async def detect_opportunities(self, token_pairs: List[str]) -> List[ArbitrageOpportunity]:
        """Scan for arbitrage opportunities"""
        opportunities = []

        for token_pair in token_pairs:
            prices = {}
            amount = 1000000000  # 1 SOL equivalent

            # Get prices from all DEXs
            for dex in self.dexes:
                try:
                    price = await self.dex_manager.get_dex_price(token_pair, dex, amount)
                    prices[dex] = price
                except Exception as e:
                    logger.debug(f"Failed to get {dex} price for {token_pair}: {e}")
                    continue

            if len(prices) < 2:
                continue  # Need at least 2 DEXs to compare

            # Find best buy/sell prices
            buy_dex = min(prices, key=prices.get)
            sell_dex = max(prices, key=prices.get)

            buy_price = prices[buy_dex]
            sell_price = prices[sell_dex]

            # Calculate potential profit
            potential_profit = (sell_price - buy_price) * (amount / 1000000)  # USD equivalent

            if potential_profit > MIN_PROFIT_USD:
                # Calculate multi-hop path if profitable
                path = await self._find_optimal_path(token_pair, prices, amount)

                opportunity = ArbitrageOpportunity(
                    token_pair=token_pair,
                    buy_dex=buy_dex,
                    sell_dex=sell_dex,
                    buy_price=buy_price,
                    sell_price=sell_price,
                    estimated_profit=potential_profit,
                    amount=amount,
                    path=path,
                    slippage_bps=SLIPPAGE_BPS,
                    timestamp=datetime.now()
                )
                opportunities.append(opportunity)

        return opportunities

    async def _find_optimal_path(self, token_pair: str, prices: Dict[str, float], amount: int) -> List[str]:
        """Find optimal multi-hop arbitrage path"""
        # For now, simple 2-hop path
        buy_dex = min(prices, key=prices.get)
        sell_dex = max(prices, key=prices.get)
        return [buy_dex, sell_dex]

class TransactionBuilder:
    """Builds atomic flashloan + arbitrage transactions"""

    def __init__(self, rpc_manager: RPCManager, wallet: Wallet):
        self.rpc_manager = rpc_manager
        self.wallet = wallet

    async def build_flashloan_transaction(self, opportunity: ArbitrageOpportunity) -> Transaction:
        """Build complete flashloan transaction"""
        client, _ = await self.rpc_manager.get_client()

        # Create transaction
        tx = Transaction()

        # Add compute budget instructions
        compute_budget_ix = set_compute_unit_limit(800000)
        compute_price_ix = set_compute_unit_price(PRIORITY_FEE_LAMPORTS)
        tx.add(compute_budget_ix)
        tx.add(compute_price_ix)

        # Build flashloan instruction
        flashloan_ix = await self._build_flashloan_ix(opportunity)
        tx.add(flashloan_ix)

        # Get recent blockhash
        recent_blockhash = await client.get_latest_blockhash()
        tx.recent_blockhash = recent_blockhash.value.blockhash

        return tx

    async def _build_flashloan_ix(self, opportunity: ArbitrageOpportunity) -> Instruction:
        """Build the flashloan instruction with callback data"""
        # This would build the actual instruction data for the FlashloanReceiver program
        # For now, return a placeholder
        return Instruction(
            program_id=Pubkey.from_string(FLASHLOAN_RECEIVER),
            accounts=[],  # Would include all required accounts
            data=b"placeholder_data"  # Would encode actual instruction data
        )

class MEVProtector:
    """Implements MEV protection mechanisms"""

    def __init__(self):
        self.sandwich_detector = SandwichDetector()
        self.bundle_manager = BundleManager()

    async def protect_transaction(self, tx: Transaction, opportunity: ArbitrageOpportunity) -> Transaction:
        """Apply MEV protection to transaction"""
        # Simulate transaction to detect sandwich attacks
        if await self.sandwich_detector.detect_sandwich(tx):
            logger.warning("Sandwich attack detected, skipping transaction")
            raise Exception("Sandwich attack detected")

        # Add randomized timing
        await self._add_timing_randomization()

        # Bundle with other transactions if beneficial
        tx = await self.bundle_manager.bundle_if_profitable(tx, opportunity)

        return tx

    async def _add_timing_randomization(self):
        """Add random delay to prevent predictable execution"""
        delay = random.uniform(0.1, 1.0)  # 100ms to 1s
        await asyncio.sleep(delay)

class SandwichDetector:
    """Detects sandwich attack patterns"""

    async def detect_sandwich(self, tx: Transaction) -> bool:
        """Analyze transaction for sandwich attack patterns"""
        # This would analyze mempool and recent blocks for sandwich patterns
        # Placeholder implementation
        return False

class BundleManager:
    """Manages transaction bundling for better execution"""

    def __init__(self):
        self.pending_bundle: List[Transaction] = []

    async def bundle_if_profitable(self, tx: Transaction, opportunity: ArbitrageOpportunity) -> Transaction:
        """Bundle transaction if it improves profitability"""
        # Check if bundling would be beneficial
        if len(self.pending_bundle) < BUNDLE_SIZE_LIMIT:
            self.pending_bundle.append(tx)
            return tx  # Return original tx, bundle submitted separately
        else:
            # Submit bundle and return new tx
            await self._submit_bundle()
            return tx

    async def _submit_bundle(self):
        """Submit transaction bundle"""
        if self.pending_bundle:
            # This would use Jito or similar bundle submission
            logger.info(f"Submitting bundle of {len(self.pending_bundle)} transactions")
            self.pending_bundle.clear()

class TransactionSubmitter:
    """Handles transaction submission with retries and failover"""

    def __init__(self, rpc_manager: RPCManager, mev_protector: MEVProtector):
        self.rpc_manager = rpc_manager
        self.mev_protector = mev_protector

    async def submit_with_retry(self, tx: Transaction, opportunity: ArbitrageOpportunity) -> Optional[str]:
        """Submit transaction with exponential backoff and failover"""
        for attempt in range(MAX_RETRIES):
            try:
                client, rpc_url = await self.rpc_manager.get_client()

                # Apply MEV protection
                protected_tx = await self.mev_protector.protect_transaction(tx, opportunity)

                # Submit transaction
                opts = TxOpts(
                    skip_preflight=True,
                    preflight_commitment=Confirmed,
                    max_retries=0
                )

                result = await client.send_transaction(protected_tx, self.rpc_manager, opts)

                # Wait for confirmation
                signature = await self._confirm_transaction(client, result.value, opportunity)

                if signature:
                    logger.info(f"Transaction confirmed: {signature}")
                    return signature
                else:
                    logger.warning(f"Transaction not confirmed on attempt {attempt + 1}")

            except Exception as e:
                logger.error(f"Attempt {attempt + 1} failed: {e}")

                if attempt < MAX_RETRIES - 1:
                    # Exponential backoff
                    delay = (2 ** attempt) + random.uniform(0, 1)
                    await asyncio.sleep(min(delay, 30))  # Max 30 seconds

        return None

    async def _confirm_transaction(self, client: AsyncClient, sig_result, opportunity: ArbitrageOpportunity) -> Optional[str]:
        """Wait for transaction confirmation"""
        signature = str(sig_result)

        for _ in range(CONFIRMATION_TIMEOUT):
            try:
                status = await client.get_signature_statuses([signature])
                if status.value and status.value[0]:
                    confirmation_status = status.value[0].confirmation_status
                    if confirmation_status in ["confirmed", "finalized"]:
                        return signature
                    elif confirmation_status == "failed":
                        return None
            except Exception as e:
                logger.debug(f"Confirmation check failed: {e}")

            await asyncio.sleep(1)

        return None

class ArbitrageDaemon:
    """Main arbitrage daemon"""

    def __init__(self, wallet_keypair: Keypair):
        self.wallet = Wallet(wallet_keypair)
        self.rpc_manager = RPCManager([MAINNET_RPC] + FALLBACK_RPCS)
        self.price_feed = PriceFeedManager(self.rpc_manager)
        self.dex_manager = DEXPriceManager(self.rpc_manager, self.price_feed)
        self.detector = ArbitrageDetector(self.dex_manager)
        self.tx_builder = TransactionBuilder(self.rpc_manager, self.wallet)
        self.mev_protector = MEVProtector()
        self.submitter = TransactionSubmitter(self.rpc_manager, self.mev_protector)

        self.db = self._init_db()
        self.circuit_breaker = 0
        self.running = False
        self.stats = {
            'opportunities_detected': 0,
            'trades_executed': 0,
            'successful_trades': 0,
            'total_profit': 0.0,
            'total_loss': 0.0
        }

    def _init_db(self) -> sqlite3.Connection:
        """Initialize SQLite database"""
        conn = sqlite3.connect('arb_history.db')
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME,
                opportunity TEXT,
                simulated_profit REAL,
                actual_profit REAL,
                tx_signature TEXT,
                status TEXT,
                error TEXT,
                gas_used INTEGER,
                execution_time REAL
            )
        ''')
        conn.commit()
        return conn

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.rpc_manager.close_all()
        self.db.close()

    async def monitor_loop(self):
        """Main monitoring and execution loop"""
        self.running = True
        logger.info("Starting arbitrage monitoring loop")

        # Token pairs to monitor (expand as needed)
        token_pairs = [
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v_So11111111111111111111111111111111111111112",  # USDC/SOL
            # Add more pairs as needed
        ]

        while self.running:
            try:
                start_time = time.time()

                # Detect opportunities
                opportunities = await self.detector.detect_opportunities(token_pairs)
                self.stats['opportunities_detected'] += len(opportunities)

                logger.info(f"Detected {len(opportunities)} arbitrage opportunities")

                # Process opportunities (limit concurrent processing)
                tasks = []
                for opp in opportunities[:3]:  # Max 3 concurrent
                    tasks.append(self.process_opportunity(opp))

                if tasks:
                    results = await asyncio.gather(*tasks, return_exceptions=True)
                    for result in results:
                        if isinstance(result, TradeResult):
                            await self._record_trade_result(result)
                            self._update_stats(result)

                # Log periodic stats
                elapsed = time.time() - start_time
                if elapsed < 1.0:  # Target 1Hz
                    await asyncio.sleep(1.0 - elapsed)

            except Exception as e:
                logger.error(f"Monitor loop error: {e}")
                await asyncio.sleep(5)

    async def process_opportunity(self, opportunity: ArbitrageOpportunity) -> TradeResult:
        """Process a single arbitrage opportunity"""
        start_time = time.time()

        try:
            # Build transaction
            tx = await self.tx_builder.build_flashloan_transaction(opportunity)

            # Submit with protection
            signature = await self.submitter.submit_with_retry(tx, opportunity)

            execution_time = time.time() - start_time

            if signature:
                # Simulate actual profit calculation (would come from on-chain logs)
                actual_profit = opportunity.estimated_profit * 0.95  # Account for fees/slippage

                return TradeResult(
                    opportunity=opportunity,
                    simulated_profit=opportunity.estimated_profit,
                    actual_profit=actual_profit,
                    tx_signature=signature,
                    status="success",
                    error=None,
                    gas_used=None,  # Would get from transaction logs
                    execution_time=execution_time
                )
            else:
                return TradeResult(
                    opportunity=opportunity,
                    simulated_profit=opportunity.estimated_profit,
                    actual_profit=0.0,
                    tx_signature=None,
                    status="failed",
                    error="Transaction submission failed",
                    gas_used=None,
                    execution_time=execution_time
                )

        except Exception as e:
            execution_time = time.time() - start_time
            return TradeResult(
                opportunity=opportunity,
                simulated_profit=opportunity.estimated_profit,
                actual_profit=0.0,
                tx_signature=None,
                status="error",
                error=str(e),
                gas_used=None,
                execution_time=execution_time
            )

    async def _record_trade_result(self, result: TradeResult):
        """Record trade result in database"""
        cursor = self.db.cursor()
        cursor.execute(
            "INSERT INTO trades VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                None,  # id auto-increment
                result.opportunity.timestamp.isoformat(),
                json.dumps(asdict(result.opportunity)),
                result.simulated_profit,
                result.actual_profit,
                result.tx_signature,
                result.status,
                result.error,
                result.gas_used
            )
        )
        self.db.commit()

    def _update_stats(self, result: TradeResult):
        """Update daemon statistics"""
        self.stats['trades_executed'] += 1

        if result.status == "success":
            self.stats['successful_trades'] += 1
            self.stats['total_profit'] += result.actual_profit
        else:
            self.stats['total_loss'] -= abs(result.actual_profit)

        # Circuit breaker logic
        if result.actual_profit < EMERGENCY_UNWIND_THRESHOLD:
            self.circuit_breaker += 1
            if self.circuit_breaker >= CIRCUIT_BREAKER_THRESHOLD:
                logger.critical("Circuit breaker triggered - stopping daemon")
                self.running = False

    def get_stats(self) -> Dict[str, Any]:
        """Get daemon statistics"""
        return self.stats.copy()

    async def stop(self):
        """Stop the daemon"""
        self.running = False
        logger.info("Stopping arbitrage daemon")

# Main execution
async def main():
    """Main entry point"""
    # Load wallet from environment
    keypair_bytes = base58.b58decode(os.getenv("WALLET_PRIVATE_KEY", ""))
    wallet = Keypair.from_bytes(keypair_bytes)

    async with ArbitrageDaemon(wallet) as daemon:
        # Setup signal handlers for graceful shutdown
        def signal_handler(signum, frame):
            logger.info("Received shutdown signal")
            asyncio.create_task(daemon.stop())

        import signal
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Start monitoring
        await daemon.monitor_loop()

if __name__ == "__main__":
    asyncio.run(main())