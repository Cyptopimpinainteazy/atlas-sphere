'use client';

import React from 'react';
import DocLayout from '@/components/docs/DocLayout';

export default function SvmAccountsPage() {
  return (
    <DocLayout
      title="SVM Accounts Model"
      description="Understanding the SVM account model for program development"
      section="svm"
      prevPage={{ title: 'Deploy SVM Programs', href: '/developers/docs/svm-deploy' }}
      nextPage={{ title: 'SPL Tokens', href: '/developers/docs/spl-tokens' }}
    >
      <p className="lead text-xl text-gray-400 mb-8">
        The SVM uses an account-based model where all state is stored in accounts.
        Understanding accounts is crucial for building efficient SVM programs.
      </p>

      <h2>Account Structure</h2>
      <p>
        Every account in the SVM has these fields:
      </p>
      <DocLayout.CodeBlock language="rust">
{`pub struct Account {
    /// Number of lamports assigned to this account
    pub lamports: u64,
    /// Data held in this account
    pub data: Vec<u8>,
    /// Program that owns this account
    pub owner: Pubkey,
    /// Is this account executable (is it a program?)
    pub executable: bool,
    /// Epoch at which this account will next owe rent
    pub rent_epoch: u64,
}`}
      </DocLayout.CodeBlock>

      <h2>Account Types</h2>

      <h3>1. System Accounts</h3>
      <p>Regular user accounts owned by the System Program:</p>
      <DocLayout.CodeBlock language="typescript">
{`import { SystemProgram, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Create account
const newAccount = Keypair.generate();
const createAccountIx = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: newAccount.publicKey,
  lamports: LAMPORTS_PER_SOL,
  space: 0,
  programId: SystemProgram.programId,
});`}
      </DocLayout.CodeBlock>

      <h3>2. Program Accounts</h3>
      <p>Executable accounts containing BPF bytecode:</p>
      <DocLayout.CodeBlock language="typescript">
{`// Programs are marked executable
const programInfo = await connection.getAccountInfo(programId);
console.log('Is executable:', programInfo.executable); // true

// Program data is stored separately
const [programDataAddress] = PublicKey.findProgramAddressSync(
  [programId.toBuffer()],
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID
);`}
      </DocLayout.CodeBlock>

      <h3>3. Program Derived Addresses (PDAs)</h3>
      <p>Deterministic addresses derived from seeds:</p>
      <DocLayout.CodeBlock language="rust">
{`// In Rust (program)
let (pda, bump) = Pubkey::find_program_address(
    &[
        b"user-stats",
        user.key.as_ref(),
    ],
    program_id,
);

// Seeds for signing
let signer_seeds = &[
    b"user-stats",
    user.key.as_ref(),
    &[bump],
];`}
      </DocLayout.CodeBlock>

      <DocLayout.CodeBlock language="typescript">
{`// In TypeScript (client)
import { PublicKey } from '@solana/web3.js';

const [pda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from('user-stats'), userPubkey.toBuffer()],
  programId
);`}
      </DocLayout.CodeBlock>

      <h2>Account Ownership</h2>
      <DocLayout.Callout type="info" title="Key Concept">
        Only the owner program can modify an account's data. The System Program owns 
        regular wallets, while your program owns its data accounts.
      </DocLayout.Callout>

      <DocLayout.CodeBlock language="rust">
{`// Verify ownership in your program
if account.owner != program_id {
    return Err(ProgramError::IncorrectProgramId);
}

// With Anchor
#[account(
    constraint = my_account.owner == program_id
)]
pub my_account: Account<'info, MyData>,`}
      </DocLayout.CodeBlock>

      <h2>Account Data Serialization</h2>
      <DocLayout.CodeBlock language="rust">
{`use borsh::{BorshDeserialize, BorshSerialize};

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserStats {
    pub level: u8,
    pub experience: u64,
    pub achievements: [bool; 10],
}

// Deserialize
let stats = UserStats::try_from_slice(&account.data.borrow())?;

// Serialize
stats.serialize(&mut *account.data.borrow_mut())?;`}
      </DocLayout.CodeBlock>

      <h2>Space Calculation</h2>
      <p>
        Calculate space needed when creating accounts:
      </p>
      <DocLayout.CodeBlock language="rust">
{`// Manual calculation
// 8 bytes for Anchor discriminator
// + size of each field

pub struct UserStats {
    pub level: u8,           // 1 byte
    pub experience: u64,     // 8 bytes
    pub name: String,        // 4 (len prefix) + max_length bytes
}

const SPACE: usize = 8 + 1 + 8 + (4 + 32);

// With Anchor InitSpace derive
#[account]
#[derive(InitSpace)]
pub struct UserStats {
    pub level: u8,
    pub experience: u64,
    #[max_len(32)]
    pub name: String,
}`}
      </DocLayout.CodeBlock>

      <h2>Rent</h2>
      <p>
        Accounts must maintain a minimum balance to be rent-exempt:
      </p>
      <DocLayout.CodeBlock language="typescript">
{`import { Connection } from '@solana/web3.js';

const connection = new Connection('https://rpc.testnet.atlas-sphere.io');

// Calculate rent-exempt minimum
const space = 165; // bytes
const rentExempt = await connection.getMinimumBalanceForRentExemption(space);
console.log('Rent-exempt minimum:', rentExempt / LAMPORTS_PER_SOL, 'ATLAS');`}
      </DocLayout.CodeBlock>

      <h2>Account Constraints in Anchor</h2>
      <DocLayout.CodeBlock language="rust">
{`#[derive(Accounts)]
pub struct Transfer<'info> {
    // Must be a signer
    pub authority: Signer<'info>,
    
    // Must be mutable
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    
    // Check seeds and bump
    #[account(
        seeds = [b"vault", authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    // Check ownership
    #[account(constraint = config.admin == authority.key())]
    pub config: Account<'info, Config>,
    
    // Initialize new account
    #[account(
        init,
        payer = authority,
        space = 8 + UserStats::INIT_SPACE
    )]
    pub user_stats: Account<'info, UserStats>,
}`}
      </DocLayout.CodeBlock>

      <h2>Closing Accounts</h2>
      <DocLayout.CodeBlock language="rust">
{`// With Anchor - reclaim rent
#[derive(Accounts)]
pub struct CloseAccount<'info> {
    #[account(
        mut,
        close = authority,
        has_one = authority
    )]
    pub data_account: Account<'info, MyData>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}`}
      </DocLayout.CodeBlock>
    </DocLayout>
  );
}
