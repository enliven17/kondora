use anchor_lang::prelude::*;

#[event]
pub struct MarketCreated {
    pub id: u64,
    pub category: u8,
    pub question_hash: [u8; 32],
    pub close_time: i64,
    pub price_yes: f64,
    pub subsidy: u64,
    pub lend: u64,
}

#[event]
pub struct PositionOpened {
    pub market_id: u64,
    pub owner: Pubkey,
    pub side: u8,
    pub margin: u64,
    pub lev_bps: u64,
    pub shares: u64,
    pub notional: u64,
    pub fee: u64,
    pub price_yes: f64,
    pub ts: i64,
}

#[event]
pub struct PositionClosed {
    pub market_id: u64,
    pub owner: Pubkey,
    pub side: u8,
    pub shares: u64,
    pub gross: u64,
    pub to_user: u64,
    pub shortfall: u64,
    pub penalty: u64,
    pub liquidation: bool,
    pub price_yes: f64,
    pub ts: i64,
}

#[event]
pub struct MarketClosed {
    pub id: u64,
    pub final_price_yes: f64,
}

#[event]
pub struct ResolutionProposed {
    pub id: u64,
    pub outcome: u8,
    pub evidence_hash: [u8; 32],
    pub finalize_after: i64,
}

#[event]
pub struct ResolutionChallenged {
    pub id: u64,
    pub auditor: Pubkey,
}

#[event]
pub struct MarketResolved {
    pub id: u64,
    pub outcome: u8,
    pub by_rule: bool,
}

#[event]
pub struct Claimed {
    pub market_id: u64,
    pub owner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Swept {
    pub market_id: u64,
    pub amount: u64,
    pub allocated: u64,
}
