//! Types for the governance pallet.

use frame_support::pallet_prelude::*;
use parity_scale_codec::{Decode, Encode, MaxEncodedLen};
use scale_info::TypeInfo;
use sp_runtime::{Percent, RuntimeDebug};
use sp_std::prelude::*;

/// Conviction multiplier for voting power.
#[derive(
    Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default,
)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum Conviction {
    /// 0.1x voting power, no lock.
    #[default]
    None,
    /// 1x voting power, 1 period lock.
    Locked1x,
    /// 2x voting power, 2 period lock.
    Locked2x,
    /// 3x voting power, 4 period lock.
    Locked3x,
    /// 4x voting power, 8 period lock.
    Locked4x,
    /// 5x voting power, 16 period lock.
    Locked5x,
    /// 6x voting power, 32 period lock.
    Locked6x,
}

impl Conviction {
    /// Get the vote multiplier for this conviction level.
    /// Returns (multiplier_num, multiplier_denom) for proper integer math.
    pub fn multiplier(self) -> (u32, u32) {
        match self {
            Conviction::None => (1, 10), // 0.1x
            Conviction::Locked1x => (1, 1),
            Conviction::Locked2x => (2, 1),
            Conviction::Locked3x => (3, 1),
            Conviction::Locked4x => (4, 1),
            Conviction::Locked5x => (5, 1),
            Conviction::Locked6x => (6, 1),
        }
    }

    /// Get the number of lock periods for this conviction.
    pub fn lock_periods(self) -> u32 {
        match self {
            Conviction::None => 0,
            Conviction::Locked1x => 1,
            Conviction::Locked2x => 2,
            Conviction::Locked3x => 4,
            Conviction::Locked4x => 8,
            Conviction::Locked5x => 16,
            Conviction::Locked6x => 32,
        }
    }
}

/// Direction of a vote.
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum VoteDirection {
    /// Vote in favor.
    Aye,
    /// Vote against.
    Nay,
    /// Abstain from voting (counts toward quorum).
    Abstain,
}

/// Status of a proposal.
#[derive(
    Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default,
)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum ProposalStatus {
    /// Proposal is in voting period.
    #[default]
    Voting,
    /// Proposal was approved.
    Approved,
    /// Proposal was rejected.
    Rejected,
    /// Proposal was enacted.
    Enacted,
    /// Proposal was cancelled.
    Cancelled,
}

/// A governance proposal.
#[derive(Clone, PartialEq, Eq, Encode, Decode, TypeInfo, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct Proposal<AccountId, Balance, BlockNumber, Call> {
    /// Unique proposal ID.
    pub id: u32,
    /// Account that submitted the proposal.
    pub proposer: AccountId,
    /// The call to execute if approved.
    pub call: Call,
    /// Short title.
    pub title: BoundedVec<u8, ConstU32<256>>,
    /// Detailed description.
    pub description: BoundedVec<u8, ConstU32<4096>>,
    /// Deposit amount.
    pub deposit: Balance,
    /// Current status.
    pub status: ProposalStatus,
    /// Block when submitted.
    pub submitted_at: BlockNumber,
    /// Block when voting ends.
    pub voting_end: BlockNumber,
    /// Block when enacted (if applicable).
    pub enacted_at: Option<BlockNumber>,
}

/// Tally of votes for a proposal.
#[derive(Clone, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct ProposalTally<Balance: Default> {
    /// Total voting power for Aye.
    pub ayes: Balance,
    /// Total voting power for Nay.
    pub nays: Balance,
    /// Total voting power for Abstain.
    pub abstains: Balance,
    /// Number of Aye voters.
    pub aye_voters: u32,
    /// Number of Nay voters.
    pub nay_voters: u32,
    /// Total token turnout (raw balances).
    pub turnout: Balance,
}

/// An individual vote.
#[derive(Clone, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct Vote<Balance> {
    /// Direction of vote.
    pub direction: VoteDirection,
    /// Balance used for voting.
    pub balance: Balance,
    /// Conviction multiplier.
    pub conviction: Conviction,
    /// Calculated voting power.
    pub voting_power: Balance,
}

/// Delegation of voting power.
#[derive(Clone, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct Delegation<AccountId, Balance> {
    /// Account to delegate to.
    pub target: AccountId,
    /// Conviction for delegated votes.
    pub conviction: Conviction,
    /// Balance being delegated.
    pub balance: Balance,
}

/// Token lock for conviction voting.
#[derive(Clone, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct VoteLock<Balance, BlockNumber> {
    /// Locked amount.
    pub amount: Balance,
    /// Block when tokens unlock.
    pub unlock_at: BlockNumber,
    /// Conviction level of the lock.
    pub conviction: Conviction,
}

/// Governance configuration parameters.
#[derive(Clone, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct GovernanceParams<Balance: Default, BlockNumber: Default> {
    /// Minimum percentage of issuance that must vote.
    pub quorum: Percent,
    /// Percentage of votes required for approval.
    pub approval_threshold: Percent,
    /// Duration of voting period in blocks.
    pub voting_period: BlockNumber,
    /// Delay between approval and enactment.
    pub enactment_period: BlockNumber,
    /// Deposit required to submit proposal.
    pub proposal_deposit: Balance,
}

/// Summary of a proposal for API responses.
#[derive(Clone, PartialEq, Eq, Encode, Decode, TypeInfo, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct ProposalSummary<AccountId, Balance, BlockNumber> {
    /// Proposal ID.
    pub id: u32,
    /// Proposer account.
    pub proposer: AccountId,
    /// Current status.
    pub status: ProposalStatus,
    /// When voting ends.
    pub voting_end: BlockNumber,
    /// Total Aye votes.
    pub ayes: Balance,
    /// Total Nay votes.
    pub nays: Balance,
    /// Total turnout.
    pub turnout: Balance,
}

/// Snapshot of governance state for offchain consumers.
#[derive(Clone, PartialEq, Eq, Encode, Decode, TypeInfo, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct GovernanceSnapshot<AccountId, Balance: Default, BlockNumber: Default> {
    /// Total proposals submitted.
    pub proposal_count: u32,
    /// Currently active proposals in voting.
    pub active_proposals: Vec<ProposalSummary<AccountId, Balance, BlockNumber>>,
    /// Proposals pending enactment.
    pub pending_enactments: Vec<u32>,
    /// Current governance configuration.
    pub config: GovernanceParams<Balance, BlockNumber>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conviction_multipliers_work() {
        // Test conviction multipliers
        assert_eq!(Conviction::None.multiplier(), (1, 10)); // 0.1x
        assert_eq!(Conviction::Locked1x.multiplier(), (1, 1)); // 1x
        assert_eq!(Conviction::Locked2x.multiplier(), (2, 1)); // 2x
        assert_eq!(Conviction::Locked3x.multiplier(), (3, 1)); // 3x
        assert_eq!(Conviction::Locked4x.multiplier(), (4, 1)); // 4x
        assert_eq!(Conviction::Locked5x.multiplier(), (5, 1)); // 5x
        assert_eq!(Conviction::Locked6x.multiplier(), (6, 1)); // 6x
    }

    #[test]
    fn conviction_lock_periods_work() {
        assert_eq!(Conviction::None.lock_periods(), 0);
        assert_eq!(Conviction::Locked1x.lock_periods(), 1);
        assert_eq!(Conviction::Locked2x.lock_periods(), 2);
        assert_eq!(Conviction::Locked3x.lock_periods(), 4);
        assert_eq!(Conviction::Locked4x.lock_periods(), 8);
        assert_eq!(Conviction::Locked5x.lock_periods(), 16);
        assert_eq!(Conviction::Locked6x.lock_periods(), 32);
    }
}
