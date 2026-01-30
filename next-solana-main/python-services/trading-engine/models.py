"""
Pydantic models for the Trading Engine API
Matches the existing Python trading system interfaces
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field, validator
from enum import Enum

class ChainId(str, Enum):
    SOLANA = "solana"
    ETHEREUM = "ethereum"
    BASE = "base"
    POLYGON = "polygon"
    BSC = "bsc"
    ARBITRUM = "arbitrum"
    OPTIMISM = "optimism"
    PULSECHAIN = "pulsechain"

class TradeStatus(str, Enum):
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"

class PositionStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"

class TradeRequest(BaseModel):
    """Request model for trade execution"""
    tokenAddress: str = Field(..., description="Token contract address", regex="^[A-Za-z0-9]{32,44}$")
    chainId: ChainId = Field(..., description="Target blockchain network")
    tradeAmountUsd: float = Field(..., gt=0, description="Trade amount in USD")
    slippageOverride: Optional[float] = Field(None, ge=0, le=100, description="Custom slippage percentage")
    routePreferences: Optional[Dict] = Field(None, description="DEX routing preferences")
    userPublicKey: Optional[str] = Field(None, description="User's wallet public key")
    strategyOverrides: Optional[Dict] = Field(None, description="Custom strategy parameters")

    @validator('tokenAddress')
    def validate_token_address(cls, v, values):
        """Validate token address format based on chain"""
        if 'chainId' in values:
            chain_id = values['chainId']
            if chain_id == ChainId.SOLANA and len(v) != 44:
                raise ValueError('Solana addresses must be 44 characters')
            elif chain_id != ChainId.SOLANA and len(v) != 42:
                raise ValueError('EVM addresses must be 42 characters (including 0x)')
        return v

class TradeResponse(BaseModel):
    """Response model for trade execution"""
    taskId: str = Field(..., description="Unique trade identifier")
    success: bool = Field(..., description="Trade execution success status")
    message: str = Field(..., description="Execution result message")
    txHashes: List[str] = Field(default_factory=list, description="Transaction hashes")
    estimatedSlices: int = Field(1, ge=1, description="Estimated number of order slices")

class RiskStatus(BaseModel):
    """Risk management status response"""
    position_count: int = Field(..., ge=0, description="Current open positions")
    daily_pnl: float = Field(..., description="Daily profit/loss in USD")
    circuit_breaker_active: bool = Field(..., description="Circuit breaker status")
    losing_streak: int = Field(..., ge=0, description="Consecutive losing trades")
    max_positions: int = Field(..., gt=0, description="Maximum allowed positions")
    max_daily_loss: float = Field(..., description="Maximum daily loss limit")

class ChainInfo(BaseModel):
    """Supported blockchain information"""
    chain_id: str = Field(..., description="Chain identifier")
    name: str = Field(..., description="Human-readable chain name")
    native_token: str = Field(..., description="Native token symbol")
    rpc_url: str = Field(..., description="RPC endpoint URL")
    status: str = Field(..., description="Network status")

class TokenData(BaseModel):
    """Token data structure for strategy analysis"""
    address: str = Field(..., description="Token contract address")
    symbol: Optional[str] = Field(None, description="Token symbol")
    name: Optional[str] = Field(None, description="Token name")
    decimals: Optional[int] = Field(None, ge=0, le=18, description="Token decimals")
    chain_id: str = Field(..., description="Blockchain network")
    price_usd: Optional[float] = Field(None, gt=0, description="Current USD price")
    liquidity_usd: Optional[float] = Field(None, ge=0, description="Total liquidity in USD")
    volume_24h: Optional[float] = Field(None, ge=0, description="24h trading volume")
    market_cap: Optional[float] = Field(None, ge=0, description="Market capitalization")

class StrategySignal(BaseModel):
    """Trading strategy signal"""
    action: str = Field(..., description="Recommended action (BUY/SELL/HOLD)")
    confidence: float = Field(..., ge=0, le=1, description="Signal confidence score")
    momentum_score: Optional[float] = Field(None, description="Momentum analysis score")
    sentiment_score: Optional[float] = Field(None, description="Sentiment analysis score")
    risk_level: str = Field(..., description="Risk assessment (LOW/MEDIUM/HIGH)")
    reasoning: List[str] = Field(..., description="Strategy reasoning points")

class Position(BaseModel):
    """Trading position information"""
    id: str = Field(..., description="Position unique identifier")
    trade_id: str = Field(..., description="Related trade identifier")
    token_address: str = Field(..., description="Token contract address")
    chain_id: str = Field(..., description="Blockchain network")
    entry_price: float = Field(..., gt=0, description="Average entry price")
    current_price: float = Field(..., gt=0, description="Current token price")
    quantity: float = Field(..., gt=0, description="Position quantity")
    pnl_usd: float = Field(..., description="Unrealized P&L in USD")
    pnl_percentage: float = Field(..., description="Unrealized P&L percentage")
    status: PositionStatus = Field(..., description="Position status")
    created_at: str = Field(..., description="Position creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")

class TradeSlice(BaseModel):
    """Individual order slice information"""
    id: str = Field(..., description="Slice unique identifier")
    trade_id: str = Field(..., description="Parent trade identifier")
    slice_number: int = Field(..., ge=1, description="Slice sequence number")
    amount_usd: float = Field(..., gt=0, description="Slice amount in USD")
    status: TradeStatus = Field(..., description="Slice execution status")
    tx_hash: Optional[str] = Field(None, description="Transaction hash")
    gas_used: Optional[float] = Field(None, description="Gas cost")
    execution_time: Optional[float] = Field(None, description="Execution duration")
    created_at: str = Field(..., description="Slice creation timestamp")

class RiskEvent(BaseModel):
    """Risk management event"""
    id: str = Field(..., description="Event unique identifier")
    event_type: str = Field(..., description="Event type (CIRCUIT_BREAKER, DAILY_LIMIT, etc.)")
    severity: str = Field(..., description="Event severity (LOW/MEDIUM/HIGH)")
    message: str = Field(..., description="Event description")
    triggered_by: str = Field(..., description="Triggering condition")
    timestamp: str = Field(..., description="Event timestamp")

class PreflightCheck(BaseModel):
    """Enhanced preflight check results"""
    liquidity_sufficient: bool = Field(..., description="Liquidity meets requirements")
    volume_adequate: bool = Field(..., description="24h volume meets thresholds")
    decimals_valid: bool = Field(..., description="Token decimals are valid")
    contract_verified: bool = Field(..., description="Contract is verified")
    blacklist_clean: bool = Field(..., description="Token not blacklisted")
    price_impact_acceptable: bool = Field(..., description="Price impact within limits")
    recommended_slippage: float = Field(..., description="Recommended slippage")
    warnings: List[str] = Field(default_factory=list, description="Warning messages")

class TradingConfig(BaseModel):
    """Trading system configuration"""
    default_slippage: float = Field(1.0, ge=0, le=100, description="Default slippage percentage")
    max_trade_amount: float = Field(10000.0, gt=0, description="Maximum trade amount USD")
    enable_order_splitting: bool = Field(True, description="Enable order splitting")
    max_position_count: int = Field(10, gt=0, description="Maximum concurrent positions")
    max_daily_loss: float = Field(-1000.0, description="Maximum daily loss limit")
    circuit_breaker_minutes: int = Field(30, gt=0, description="Circuit breaker duration")
    min_liquidity_usd: float = Field(100000.0, gt=0, description="Minimum liquidity requirement")
    min_volume_24h: float = Field(50000.0, gt=0, description="Minimum 24h volume requirement")
