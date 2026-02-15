#!/usr/bin/env python3
"""
X3 Treasury Integration for Triangular Arbitrage Bot
Automatically routes 50% of trading profits to X3 Treasury
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import sys

# Configuration
CONFIG_PATH = Path(__file__).parent / "x3_treasury_config.json"
LOG_PATH = Path(__file__).parent / "treasury_transactions.log"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("X3TreasuryIntegration")


class TreasuryIntegration:
    """Handles automatic profit splitting for triangular arbitrage"""
    
    def __init__(self, config_path: Path = CONFIG_PATH):
        self.config = self._load_config(config_path)
        self.enabled = self.config.get("enabled", False)
        self.split_percentage = self.config.get("treasury_split_percentage", 50)
        logger.info(f"Treasury integration initialized (enabled={self.enabled}, split={self.split_percentage}%)")
    
    def _load_config(self, config_path: Path) -> Dict[str, Any]:
        """Load treasury configuration"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return {}
    
    def calculate_split(self, profit_amount: float, currency: str = "USD") -> tuple[float, float]:
        """Calculate trader and treasury splits"""
        if not self.enabled:
            return profit_amount, 0.0
        
        treasury_amount = profit_amount * (self.split_percentage / 100)
        trader_amount = profit_amount - treasury_amount
        
        logger.info(f"Split calculation: {profit_amount} {currency} -> Trader: {trader_amount}, Treasury: {treasury_amount}")
        return trader_amount, treasury_amount
    
    def route_to_treasury(
        self,
        amount: float,
        currency: str,
        chain: str,
        exchange: str,
        cycle_info: Dict[str, Any]
    ) -> bool:
        """Route treasury portion to X3 wallet"""
        if not self.enabled or amount <= 0:
            return False
        
        try:
            treasury_address = self.config["supported_chains"].get(
                chain.lower(),
                self.config["x3_treasury_address"]
            )
            
            transaction = {
                "timestamp": datetime.now().isoformat(),
                "amount": amount,
                "currency": currency,
                "chain": chain,
                "exchange": exchange,
                "treasury_address": treasury_address,
                "cycle_info": cycle_info,
                "type": "arbitrage_profit_split"
            }
            
            # Log transaction
            self._log_transaction(transaction)
            
            # TODO: Implement actual blockchain transaction
            # This would integrate with ccxt or web3.py to execute the transfer
            logger.info(f"Treasury routing: {amount} {currency} on {chain} to {treasury_address}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to route to treasury: {e}")
            return False
    
    def _log_transaction(self, transaction: Dict[str, Any]):
        """Log treasury transaction"""
        log_file = Path(self.config["transaction_logging"]["log_file"])
        try:
            with open(log_file, 'a') as f:
                f.write(json.dumps(transaction) + "\n")
        except Exception as e:
            logger.error(f"Failed to log transaction: {e}")
    
    def process_arbitrage_profit(
        self,
        profit: float,
        currency: str,
        exchange: str,
        cycle: list[str],
        chain: str = "ethereum"
    ) -> Dict[str, float]:
        """
        Process an arbitrage profit and split it
        
        Args:
            profit: Total profit amount
            currency: Currency/token symbol
            exchange: Exchange name
            cycle: List of assets in arbitrage cycle (e.g., ["BTC", "ETH", "USDT"])
            chain: Blockchain to use for treasury transfer
            
        Returns:
            Dictionary with 'trader' and 'treasury' amounts
        """
        trader_amount, treasury_amount = self.calculate_split(profit, currency)
        
        if treasury_amount > 0:
            cycle_info = {
                "assets": cycle,
                "cycle_length": len(cycle),
                "profit": profit,
                "currency": currency
            }
            
            success = self.route_to_treasury(
                treasury_amount,
                currency,
                chain,
                exchange,
                cycle_info
            )
            
            if not success:
                logger.warning("Treasury routing failed, trader receives full amount")
                return {"trader": profit, "treasury": 0.0}
        
        return {
            "trader": trader_amount,
            "treasury": treasury_amount
        }


# Global instance
treasury = TreasuryIntegration()


def wrap_profit_callback(original_callback):
    """
    Decorator to wrap the arbitrage bot's profit callback
    Intercepts profits and routes them through treasury integration
    """
    def wrapped_callback(profit_data: Dict[str, Any]):
        # Extract profit information
        profit = profit_data.get("profit", 0.0)
        currency = profit_data.get("currency", "USD")
        exchange = profit_data.get("exchange", "unknown")
        cycle = profit_data.get("cycle", [])
        chain = profit_data.get("chain", "ethereum")
        
        # Process through treasury
        split_result = treasury.process_arbitrage_profit(
            profit, currency, exchange, cycle, chain
        )
        
        # Update profit data with split information
        profit_data["original_profit"] = profit
        profit_data["trader_amount"] = split_result["trader"]
        profit_data["treasury_amount"] = split_result["treasury"]
        profit_data["treasury_integrated"] = True
        
        # Call original callback with updated data
        return original_callback(profit_data)
    
    return wrapped_callback


if __name__ == "__main__":
    # Test the integration
    logger.info("Testing X3 Treasury Integration for Triangular Arbitrage")
    
    test_profit = 100.0
    test_cycle = ["BTC", "ETH", "USDT", "BTC"]
    
    result = treasury.process_arbitrage_profit(
        profit=test_profit,
        currency="USDT",
        exchange="Binance",
        cycle=test_cycle,
        chain="bsc"
    )
    
    print(f"\nTest Results:")
    print(f"Original Profit: {test_profit} USDT")
    print(f"Trader Receives: {result['trader']} USDT")
    print(f"Treasury Receives: {result['treasury']} USDT")
    print(f"Split Percentage: {treasury.split_percentage}%")
