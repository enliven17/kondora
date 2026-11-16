use anchor_lang::prelude::*;

#[error_code]
pub enum KondoraError {
    #[msg("Not authorized")]
    Unauthorized,
    #[msg("Protocol is paused")]
    Paused,
    #[msg("Invalid parameters")]
    InvalidParams,
    #[msg("Math overflow or invalid AMM state")]
    Math,
    #[msg("Market is not open for trading")]
    MarketNotOpen,
    #[msg("Market is in the wrong state for this action")]
    WrongState,
    #[msg("Trading has closed")]
    TradingClosed,
    #[msg("Trading is still open")]
    TradingStillOpen,
    #[msg("Amount below the minimum trade")]
    TooSmall,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Leverage above the current cap")]
    LeverageTooHigh,
    #[msg("Not enough lending liquidity for this leverage")]
    InsufficientLiquidity,
    #[msg("Price would leave the allowed range")]
    PriceOutOfRange,
    #[msg("Slippage limit exceeded")]
    Slippage,
    #[msg("No free position slot")]
    NoSlot,
    #[msg("Position not found")]
    NoPosition,
    #[msg("Position would be liquidatable right away")]
    Unhealthy,
    #[msg("Position is healthy")]
    Healthy,
    #[msg("Leveraged positions are still open")]
    DebtOutstanding,
    #[msg("Dispute window has not passed")]
    DisputeWindowOpen,
    #[msg("Dispute window has passed")]
    DisputeWindowClosed,
    #[msg("Invalid outcome")]
    InvalidOutcome,
    #[msg("Already swept")]
    AlreadySwept,
    #[msg("Insufficient house liquidity")]
    HouseLiquidity,
    #[msg("Token mint mismatch")]
    MintMismatch,
}
