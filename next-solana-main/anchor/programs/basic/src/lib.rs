use anchor_lang::prelude::*;

declare_id!("A2NKHo8dGdRmNgFfaxmqLmmDVJyeoxhYRyuC7WouMW47");

#[program]
pub mod basic {
    use super::*;

    pub fn greet(ctx: Context<Greet>) -> Result<()> {
        msg!("Greetings from the Basic program!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Greet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
}
