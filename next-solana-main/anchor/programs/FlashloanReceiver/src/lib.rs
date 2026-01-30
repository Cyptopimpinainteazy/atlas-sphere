use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer};
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::account_info::AccountInfo;
use anchor_lang::solana_program::pubkey::Pubkey;

use crate::error::ErrorCode;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod flashloan_receiver {
    use super::*;

    pub fn initialize_receiver(ctx: Context<InitializeReceiver>) -> Result<()> {
        let receiver = &mut ctx.accounts.receiver;
        receiver.authority = ctx.accounts.authority.key();
        receiver.is_initialized = true;
        receiver.circuit_breaker_count = 0;
        receiver.last_profit = 0;
        receiver.total_loans = 0;
        receiver.total_repaid = 0;
        Ok(())
    }

    pub fn initiate_flashloan(
        ctx: Context<InitiateFlashloan>,
        amount: u64,
        min_profit: u64,
        max_slippage: u64,
    ) -> Result<()> {
        // Validate inputs
        require!(amount > 0, ErrorCode::InvalidFlashloanAmount);
        require!(min_profit > 0, ErrorCode::ProfitThresholdNotMet);
        require!(max_slippage <= 10000, ErrorCode::InvalidSlippage); // Max 100%

        let receiver = &ctx.accounts.receiver;
        require!(receiver.is_initialized, ErrorCode::Unauthorized);

        // Check circuit breaker
        require!(receiver.circuit_breaker_count < 3, ErrorCode::CircuitBreakerTriggered);

        // Calculate expected repay amount (amount + fees)
        let flash_fee = calculate_flashloan_fee(amount);
        let repay_amount = amount + flash_fee;

        // Build the callback instruction for execute_arbitrage
        let execute_ix = Instruction {
            program_id: ctx.program_id,
            accounts: vec![
                AccountMeta::new(ctx.accounts.receiver.key(), false),
                AccountMeta::new(ctx.accounts.arb_engine.key(), false),
                AccountMeta::new(ctx.accounts.input_token_account.key(), false),
                AccountMeta::new(ctx.accounts.output_token_account.key(), false),
                AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.arb_engine_program.key(), false),
            ],
            data: execute_arbitrage_ix_data(amount, min_profit, max_slippage)?,
        };

        // CPI to Solend flash_borrow
        solend_program::cpi::flash_borrow(
            CpiContext::new(
                ctx.accounts.solend_program.to_account_info(),
                solend_program::cpi::accounts::FlashBorrow {
                    lending_market: ctx.accounts.lending_market.to_account_info(),
                    reserve: ctx.accounts.reserve.to_account_info(),
                    reserve_liquidity_supply: ctx.accounts.reserve_liquidity_supply.to_account_info(),
                    reserve_liquidity_fee_receiver: ctx.accounts.reserve_liquidity_fee_receiver.to_account_info(),
                    host_fee_receiver: ctx.accounts.host_fee_receiver.to_account_info(),
                    oracle: ctx.accounts.oracle.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    receiver_program: ctx.program_id,
                    receiver: ctx.accounts.receiver.to_account_info(),
                    source_liquidity: ctx.accounts.source_liquidity.to_account_info(),
                    destination_liquidity: ctx.accounts.token_account.to_account_info(),
                    lending_market_authority: ctx.accounts.lending_market_authority.to_account_info(),
                    reserve_authority: ctx.accounts.reserve_authority.to_account_info(),
                },
            ),
            solend_program::instruction::FlashBorrowParams {
                amount,
            },
            Some(execute_ix.data),
        )?;

        emit!(FlashloanInitiated {
            amount,
            min_profit,
            max_slippage,
            receiver: ctx.accounts.receiver.key(),
            repay_amount,
        });

        Ok(())
    }

    pub fn execute_arbitrage(
        ctx: Context<ExecuteArbitrage>,
        amount: u64,
        min_profit: u64,
        max_slippage: u64
    ) -> Result<()> {
        let receiver = &mut ctx.accounts.receiver;

        // This is called by Solend as the flashloan callback
        // The flashloan amount should already be in token_account

        // Verify we have the flashloan amount
        require!(ctx.accounts.token_account.amount >= amount, ErrorCode::InsufficientFlashloanAmount);

        // Calculate fees and rent
        let flash_fee = calculate_flashloan_fee(amount);
        let total_repay = amount + flash_fee;

        // Execute arbitrage through ArbEngine
        let trade_result = arb_engine::cpi::execute_trades(
            CpiContext::new(
                ctx.accounts.arb_engine_program.to_account_info(),
                arb_engine::cpi::accounts::ExecuteTrades {
                    engine: ctx.accounts.arb_engine.to_account_info(),
                    input_token_account: ctx.accounts.token_account.to_account_info(),
                    output_token_account: ctx.accounts.temp_token_account.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    dex_programs: ctx.remaining_accounts.to_vec(),
                },
            ),
            amount,
            min_profit,
            max_slippage,
            vec![], // path will be determined by ArbEngine
        )?;

        // Validate profit
        let actual_profit = trade_result.profit;
        require!(actual_profit >= min_profit as i64, ErrorCode::ProfitThresholdNotMet);

        // Check slippage
        let expected_output = amount + (min_profit as u64);
        let actual_output = amount + actual_profit.max(0) as u64;
        let slippage = calculate_slippage(actual_output, expected_output);
        require!(slippage <= max_slippage, ErrorCode::SlippageExceeded);

        // Update receiver state
        receiver.last_profit = actual_profit;
        receiver.total_loans += amount;
        receiver.total_repaid += total_repay;

        if actual_profit < 0 {
            receiver.circuit_breaker_count += 1;
        } else {
            receiver.circuit_breaker_count = 0;
        }

        emit!(ArbitrageExecuted {
            amount_in: amount,
            amount_out: actual_output,
            profit: actual_profit,
            flash_fee,
            trades: trade_result.trades,
        });

        Ok(())
    }

    pub fn repay_flashloan(ctx: Context<RepayFlashloan>) -> Result<()> {
        let receiver = &ctx.accounts.receiver;

        // Calculate total repay amount (principal + fee)
        let flash_fee = calculate_flashloan_fee(ctx.accounts.amount);
        let total_repay = ctx.accounts.amount + flash_fee;

        // Transfer repay amount from receiver's token account to lending reserve
        anchor_spl::token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_account.to_account_info(),
                    to: ctx.accounts.reserve_liquidity_supply.to_account_info(),
                    authority: ctx.accounts.receiver.to_account_info(),
                },
            ),
            total_repay,
        )?;

        emit!(FlashloanRepaid {
            amount: ctx.accounts.amount,
            fee: flash_fee,
            total_repaid: total_repay,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeReceiver<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Receiver::INIT_SPACE,
        seeds = [b"receiver", authority.key().as_ref()],
        bump
    )]
    pub receiver: Account<'info, Receiver>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitiateFlashloan<'info> {
    #[account(
        mut,
        seeds = [b"receiver", authority.key().as_ref()],
        bump,
        has_one = authority
    )]
    pub receiver: Account<'info, Receiver>,
    pub authority: Signer<'info>,

    /// CHECK: Lending market account
    pub lending_market: AccountInfo<'info>,
    /// CHECK: Reserve account
    pub reserve: AccountInfo<'info>,
    /// CHECK: Reserve liquidity supply
    #[account(mut)]
    pub reserve_liquidity_supply: AccountInfo<'info>,
    /// CHECK: Reserve liquidity fee receiver
    #[account(mut)]
    pub reserve_liquidity_fee_receiver: AccountInfo<'info>,
    /// CHECK: Host fee receiver
    #[account(mut)]
    pub host_fee_receiver: AccountInfo<'info>,
    /// CHECK: Oracle account
    pub oracle: AccountInfo<'info>,
    /// CHECK: Lending market authority
    pub lending_market_authority: AccountInfo<'info>,
    /// CHECK: Reserve authority
    pub reserve_authority: AccountInfo<'info>,
    /// CHECK: Source liquidity
    #[account(mut)]
    pub source_liquidity: AccountInfo<'info>,

    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    /// CHECK: Solend program
    pub solend_program: AccountInfo<'info>,

    /// ArbEngine accounts
    /// CHECK: ArbEngine program
    pub arb_engine_program: AccountInfo<'info>,
    /// CHECK: ArbEngine PDA
    pub arb_engine: AccountInfo<'info>,
    /// CHECK: Input token account for arbitrage
    pub input_token_account: AccountInfo<'info>,
    /// CHECK: Output token account for arbitrage
    pub output_token_account: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ExecuteArbitrage<'info> {
    #[account(mut)]
    pub receiver: Account<'info, Receiver>,

    /// ArbEngine accounts
    /// CHECK: ArbEngine PDA
    pub arb_engine: AccountInfo<'info>,
    /// CHECK: ArbEngine program
    pub arb_engine_program: AccountInfo<'info>,

    /// Token accounts
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub temp_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,

    // DEX programs and accounts passed as remaining accounts
}

#[derive(Accounts)]
pub struct RepayFlashloan<'info> {
    #[account(mut)]
    pub receiver: Account<'info, Receiver>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    /// CHECK: Reserve liquidity supply
    #[account(mut)]
    pub reserve_liquidity_supply: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    /// Amount being repaid (stored in account for access)
    pub amount: u64,
}

#[event]
pub struct FlashloanInitiated {
    pub amount: u64,
    pub min_profit: u64,
    pub max_slippage: u64,
    pub receiver: Pubkey,
    pub repay_amount: u64,
}

#[event]
pub struct ArbitrageExecuted {
    pub amount_in: u64,
    pub amount_out: u64,
    pub profit: i64,
    pub flash_fee: u64,
    pub trades: u64,
}

#[event]
pub struct FlashloanRepaid {
    pub amount: u64,
    pub fee: u64,
    pub total_repaid: u64,
}

// Helper functions
fn calculate_flashloan_fee(amount: u64) -> u64 {
    amount * 9 / 10000 // 0.09% typical Solend fee
}

fn calculate_slippage(executed: u64, expected: u64) -> u64 {
    if expected == 0 { 10000 } else {
        ((expected as i64 - executed as i64).abs() * 10000 / expected as i64) as u64
    }
}

fn execute_arbitrage_ix_data(amount: u64, min_profit: u64, max_slippage: u64) -> Result<Vec<u8>> {
    let mut data = Vec::new();
    // Discriminator for execute_arbitrage (calculated from function name hash)
    let discriminator = anchor_lang::solana_program::hash::hash(b"global:execute_arbitrage").to_bytes()[..8].to_vec();
    data.extend_from_slice(&discriminator);
    data.extend_from_slice(&amount.to_le_bytes());
    data.extend_from_slice(&min_profit.to_le_bytes());
    data.extend_from_slice(&max_slippage.to_le_bytes());
    Ok(data)
}

#[account]
#[derive(InitSpace)]
pub struct Receiver {
    pub authority: Pubkey,
    pub is_initialized: bool,
    pub circuit_breaker_count: u8,
    pub last_profit: i64,
    pub total_loans: u64,
    pub total_repaid: u64,
}

impl Receiver {
    pub const INIT_SPACE: usize = 8 + 32 + 1 + 1 + 8 + 8 + 8;
}

// ArbEngine CPI interface
pub mod arb_engine {
    use super::*;

    #[derive(Accounts)]
    pub struct ExecuteTrades<'info> {
        pub engine: AccountInfo<'info>,
        pub input_token_account: AccountInfo<'info>,
        pub output_token_account: AccountInfo<'info>,
        pub token_program: AccountInfo<'info>,
        pub dex_programs: Vec<AccountInfo<'info>>,
    }

    #[derive(AnchorSerialize, AnchorDeserialize)]
    pub struct TradeResult {
        pub profit: i64,
        pub executed_amount: u64,
        pub trades: u64,
    }
}

// Solend CPI interface (simplified)
pub mod solend_program {
    use super::*;
    use anchor_lang::solana_program::instruction::Instruction;

    #[derive(Accounts)]
    pub struct FlashBorrow<'info> {
        pub lending_market: AccountInfo<'info>,
        pub reserve: AccountInfo<'info>,
        pub reserve_liquidity_supply: AccountInfo<'info>,
        pub reserve_liquidity_fee_receiver: AccountInfo<'info>,
        pub host_fee_receiver: AccountInfo<'info>,
        pub oracle: AccountInfo<'info>,
        pub token_program: AccountInfo<'info>,
        pub receiver_program: Pubkey,
        pub receiver: AccountInfo<'info>,
        pub source_liquidity: AccountInfo<'info>,
        pub destination_liquidity: AccountInfo<'info>,
        pub lending_market_authority: AccountInfo<'info>,
        pub reserve_authority: AccountInfo<'info>,
    }

    #[derive(AnchorSerialize, AnchorDeserialize)]
    pub struct FlashBorrowParams {
        pub amount: u64,
    }

    pub fn flash_borrow<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, FlashBorrow<'info>>,
        params: FlashBorrowParams,
        callback_data: Option<Vec<u8>>,
    ) -> Result<()> {
        // This would be the actual Solend CPI call
        // For now, emit an event to simulate
        emit!(FlashBorrowEvent {
            amount: params.amount,
            callback_data_len: callback_data.map(|d| d.len()).unwrap_or(0),
        });
        Ok(())
    }

    #[event]
    pub struct FlashBorrowEvent {
        pub amount: u64,
        pub callback_data_len: usize,
    }
}