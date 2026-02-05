use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid trade path")]
    InvalidTradePath,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Price impact too high")]
    HighPriceImpact,
    #[msg("No profitable arbitrage opportunity")]
    NoProfitableOpportunity,
    #[msg("DEX integration error")]
    DexIntegrationError,
    #[msg("Oracle price stale")]
    StaleOraclePrice,
    #[msg("Multi-hop path too long")]
    PathTooLong,
    #[msg("Fallback RPC failed")]
    RpcFallbackFailed,
}
