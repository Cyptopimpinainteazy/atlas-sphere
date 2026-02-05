"""
FastAPI Trading Engine Server
Wraps the existing Python trading system for Next.js integration
"""

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add the CRYPTO_TRADING_BOT_100X-main directory to Python path
crypto_bot_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'CRYPTO_TRADING_BOT_100X-main')
sys.path.append(crypto_bot_path)

try:
    from multi_chain_executor import MultiChainExecutor
    from risk_manager import RiskManager
    from advanced_trading import AdvancedTrading
    from strategy import StrategyEngine
    from config_loader import ConfigLoader
except ImportError as e:
    print(f"Error importing trading modules: {e}")
    print("Please ensure CRYPTO_TRADING_BOT_100X-main is in the parent directory")
    sys.exit(1)

# Global instances
multi_chain_executor = None
risk_manager = None
advanced_trading = None
strategy_engine = None
config_loader = None

class TradeRequest(BaseModel):
    tokenAddress: str
    chainId: str
    tradeAmountUsd: float
    slippageOverride: Optional[float] = None
    routePreferences: Optional[dict] = None
    userPublicKey: Optional[str] = None
    strategyOverrides: Optional[dict] = None

class TradeResponse(BaseModel):
    taskId: str
    success: bool
    message: str
    txHashes: List[str] = []
    estimatedSlices: int = 1

class RiskStatus(BaseModel):
    position_count: int
    daily_pnl: float
    circuit_breaker_active: bool
    losing_streak: int
    max_positions: int
    max_daily_loss: float

class ChainInfo(BaseModel):
    chain_id: str
    name: str
    native_token: str
    rpc_url: str
    status: str

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize trading modules on startup"""
    global multi_chain_executor, risk_manager, advanced_trading, strategy_engine, config_loader

    # Initialize configuration
    config_loader = ConfigLoader()

    # Initialize trading modules
    multi_chain_executor = MultiChainExecutor()
    risk_manager = RiskManager()
    advanced_trading = AdvancedTrading()
    strategy_engine = StrategyEngine()

    # Validate configuration
    if not config_loader.validate_config():
        raise Exception("Invalid configuration")

    print("Trading engine initialized successfully")
    yield

    # Cleanup
    print("Shutting down trading engine")

# Create FastAPI app
app = FastAPI(
    title="Trading Engine API",
    description="Multi-chain trading engine for sophisticated DeFi operations",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Next.js dev ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/trade", response_model=TradeResponse)
async def execute_trade(request: TradeRequest):
    """Execute a trade using the advanced trading system"""
    try:
        # Check risk limits first
        if not risk_manager.can_proceed_with_trade(request.tradeAmountUsd):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trade rejected due to risk limits"
            )

        # Prepare token data for strategy engine
        token_data = {
            'address': request.tokenAddress,
            'chain_id': request.chainId,
            'trade_amount_usd': request.tradeAmountUsd
        }

        # Get trading strategy
        strategy = strategy_engine.analyze_token(token_data)

        # Execute trade through multi-chain executor
        result = await multi_chain_executor.execute_trade_async(
            token_address=request.tokenAddress,
            chain_id=request.chainId,
            amount_usd=request.tradeAmountUsd,
            user_public_key=request.userPublicKey,
            strategy=strategy,
            slippage_override=request.slippageOverride,
            route_preferences=request.routePreferences
        )

        if result['success']:
            return TradeResponse(
                taskId=result.get('task_id', 'unknown'),
                success=True,
                message=result.get('message', 'Trade executed successfully'),
                txHashes=result.get('tx_hashes', []),
                estimatedSlices=result.get('estimated_slices', 1)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('message', 'Trade execution failed')
            )

    except Exception as e:
        logging.error(f"Trade execution error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Trade execution failed: {str(e)}"
        )

@app.get("/risk/status", response_model=RiskStatus)
async def get_risk_status():
    """Get current risk management status"""
    try:
        status_data = risk_manager.get_status_summary()

        return RiskStatus(
            position_count=status_data.get('position_count', 0),
            daily_pnl=status_data.get('daily_pnl', 0.0),
            circuit_breaker_active=status_data.get('circuit_breaker_active', False),
            losing_streak=status_data.get('losing_streak', 0),
            max_positions=status_data.get('max_positions', 10),
            max_daily_loss=status_data.get('max_daily_loss', -1000.0)
        )
    except Exception as e:
        logging.error(f"Risk status error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get risk status: {str(e)}"
        )

@app.get("/chains", response_model=List[ChainInfo])
async def get_supported_chains():
    """Get list of supported blockchain networks"""
    try:
        chains = [
            ChainInfo(chain_id="solana", name="Solana", native_token="SOL", rpc_url="https://api.mainnet-beta.solana.com", status="online"),
            ChainInfo(chain_id="ethereum", name="Ethereum", native_token="ETH", rpc_url="https://eth-mainnet.g.alchemy.com/v2/demo", status="online"),
            ChainInfo(chain_id="base", name="Base", native_token="ETH", rpc_url="https://base-mainnet.g.alchemy.com/v2/demo", status="online"),
            ChainInfo(chain_id="polygon", name="Polygon", native_token="MATIC", rpc_url="https://polygon-mainnet.g.alchemy.com/v2/demo", status="online"),
            ChainInfo(chain_id="bsc", name="BNB Smart Chain", native_token="BNB", rpc_url="https://bsc-dataseed.binance.org", status="online"),
            ChainInfo(chain_id="arbitrum", name="Arbitrum", native_token="ETH", rpc_url="https://arb1.arbitrum.io/rpc", status="online"),
            ChainInfo(chain_id="optimism", name="Optimism", native_token="ETH", rpc_url="https://mainnet.optimism.io", status="online"),
            ChainInfo(chain_id="pulsechain", name="PulseChain", native_token="PLS", rpc_url="https://rpc.pulsechain.com", status="online"),
        ]
        return chains
    except Exception as e:
        logging.error(f"Chains info error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get chains info: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "trading-engine",
        "version": "1.0.0",
        "modules": {
            "multi_chain_executor": multi_chain_executor is not None,
            "risk_manager": risk_manager is not None,
            "advanced_trading": advanced_trading is not None,
            "strategy_engine": strategy_engine is not None,
        }
    }

if __name__ == "__main__":
    port = int(os.getenv("TRADING_ENGINE_PORT", "8001"))
    host = os.getenv("TRADING_ENGINE_HOST", "0.0.0.0")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
