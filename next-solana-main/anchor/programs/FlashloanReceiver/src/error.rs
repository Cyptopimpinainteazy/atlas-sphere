use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Flashloan amount must be greater than zero")]
    InvalidFlashloanAmount,
    #[msg("Insufficient funds to repay flashloan")]
    InsufficientRepayAmount,
    #[msg("Profit threshold not met")]
    ProfitThresholdNotMet,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Circuit breaker triggered")]
    CircuitBreakerTriggered,
    #[msg("Invalid PDA derivation")]
    InvalidPDA,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("DEX trade failed")]
    DexTradeFailed,
    #[msg("Rent calculation error")]
    RentCalculationError,
    #[msg("Fee calculation error")]
    FeeCalculationError,
}
