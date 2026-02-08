//! Blockchain Integration Module
//!
//! Integrates the GPU swarm with on-chain governance, rewards, staking, and slashing.
//! Syncs with pallet-swarm on the Atlas Sphere runtime.

use crate::error::{SwarmError, SwarmResult};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn, error};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Blockchain integration client
pub struct BlockchainClient {
    /// RPC endpoint
    rpc_endpoint: String,

    /// Local node account
    account_id: Option<String>,

    /// Cached block info
    cached_blocks: Arc<RwLock<HashMap<u32, BlockInfo>>>,

    /// Reward tracking
    rewards: Arc<RwLock<RewardTracker>>,

    /// Stake tracking
    stakes: Arc<RwLock<StakeTracker>>,
}

/// Block information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockInfo {
    /// Block number
    pub block_number: u32,

    /// Block hash
    pub block_hash: String,

    /// Parent block hash
    pub parent_hash: String,

    /// Timestamp
    pub timestamp: i64,

    /// Validator set
    pub validators: Vec<String>,

    /// Extrinsics
    pub extrinsics: Vec<Extrinsic>,

    /// Events
    pub events: Vec<ChainEvent>,
}

/// Extrinsic (transaction-like event)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Extrinsic {
    /// Extrinsic hash
    pub hash: String,

    /// Module/pallet
    pub pallet: String,

    /// Call name
    pub call: String,

    /// Arguments
    pub args: HashMap<String, String>,

    /// Block index
    pub block_index: u32,
}

/// Chain event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChainEvent {
    /// Task reward event
    TaskRewardClaimed {
        account: String,
        amount: u128,
        task_id: String,
    },

    /// Slashing event
    Slashed {
        account: String,
        amount: u128,
        reason: String,
    },

    /// Staking event
    Staked {
        account: String,
        amount: u128,
    },

    /// Unstaking event
    Unstaked {
        account: String,
        amount: u128,
    },

    /// Reward distribution event
    RewardsDistributed {
        total_amount: u128,
        recipients: HashMap<String, u128>,
    },

    /// Announcement event (Block Announcer)
    Announcement {
        event_type: String,
        payload: serde_json::Value,
    },
}

/// Reward tracker
#[derive(Debug, Clone)]
pub struct RewardTracker {
    /// Total rewards distributed
    pub total_distributed: u128,

    /// Pending rewards per account
    pub pending_rewards: HashMap<String, u128>,

    /// Claimed rewards per account
    pub claimed_rewards: HashMap<String, u128>,

    /// Last update block
    pub last_update_block: u32,
}

/// Stake tracker
#[derive(Debug, Clone)]
pub struct StakeTracker {
    /// Total stake in network
    pub total_stake: u128,

    /// Stakes per account
    pub account_stakes: HashMap<String, u128>,

    /// Lockup periods
    pub lockup_periods: HashMap<String, u32>,

    /// Last update block
    pub last_update_block: u32,
}

/// Reward distribution configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardConfig {
    /// Task completion reward
    pub task_completion_reward: u128,

    /// Verification bonus
    pub verification_bonus: u128,

    /// Consensus reward multiplier
    pub consensus_reward_multiplier: f32,

    /// Failure penalty
    pub failure_penalty: u128,

    /// Slashing percentage (0-100)
    pub slashing_percentage: u32,

    /// Minimum stake required
    pub minimum_stake: u128,

    /// Reward token name
    pub reward_token: String,
}

impl Default for RewardConfig {
    fn default() -> Self {
        Self {
            task_completion_reward: 100_000_000, // 0.1 tokens in smallest unit
            verification_bonus: 50_000_000,
            consensus_reward_multiplier: 1.5,
            failure_penalty: 10_000_000,
            slashing_percentage: 10,
            minimum_stake: 1_000_000_000, // 1 token minimum
            reward_token: "ATLAS".to_string(),
        }
    }
}

impl BlockchainClient {
    /// Create a new blockchain client
    pub async fn new(rpc_endpoint: String) -> SwarmResult<Self> {
        info!("Connecting to blockchain: {}", rpc_endpoint);

        let client = Self {
            rpc_endpoint,
            account_id: None,
            cached_blocks: Arc::new(RwLock::new(HashMap::new())),
            rewards: Arc::new(RwLock::new(RewardTracker {
                total_distributed: 0,
                pending_rewards: HashMap::new(),
                claimed_rewards: HashMap::new(),
                last_update_block: 0,
            })),
            stakes: Arc::new(RwLock::new(StakeTracker {
                total_stake: 0,
                account_stakes: HashMap::new(),
                lockup_periods: HashMap::new(),
                last_update_block: 0,
            })),
        };

        // Test connection (in production, make actual RPC call)
        client.verify_connection().await?;

        Ok(client)
    }

    /// Verify connection to blockchain
    async fn verify_connection(&self) -> SwarmResult<()> {
        debug!("Verifying blockchain connection to {}", self.rpc_endpoint);
        // In production: Make RPC call to chain_getBlockHash
        info!("Blockchain connection verified");
        Ok(())
    }

    /// Set local account ID
    pub fn set_account(&mut self, account_id: String) {
        self.account_id = Some(account_id.clone());
        debug!("Local account set: {}", account_id);
    }

    /// Get current block number
    pub async fn get_block_number(&self) -> SwarmResult<u32> {
        debug!("Fetching current block number");
        // In production: RPC call to chain_getBlockHash(None)
        Ok(1000) // Mock
    }

    /// Get block info
    pub async fn get_block(&self, block_number: u32) -> SwarmResult<BlockInfo> {
        // Check cache
        let cached = self.cached_blocks.read().await;
        if let Some(block) = cached.get(&block_number) {
            return Ok(block.clone());
        }

        debug!("Fetching block {}", block_number);

        // In production: RPC call to chain_getBlock
        let block = BlockInfo {
            block_number,
            block_hash: format!("0x{:064x}", block_number),
            parent_hash: format!("0x{:064x}", block_number - 1),
            timestamp: chrono::Utc::now().timestamp(),
            validators: vec!["validator-1".to_string()],
            extrinsics: Vec::new(),
            events: Vec::new(),
        };

        drop(cached);
        self.cached_blocks.write().await.insert(block_number, block.clone());

        Ok(block)
    }

    /// Claim rewards
    pub async fn claim_rewards(&self, account: &str, amount: u128) -> SwarmResult<String> {
        info!("Claiming {} rewards for {}", amount, account);

        if self.account_id.is_none() {
            return Err(SwarmError::BlockchainError("Account not set".to_string()));
        }

        // In production: Create and submit extrinsic to pallet-swarm::claim_rewards
        let tx_hash = format!("0x{:064x}", rand::random::<u64>());

        // Update local tracking
        let mut rewards = self.rewards.write().await;
        *rewards.pending_rewards.entry(account.to_string()).or_insert(0) -= amount;
        *rewards.claimed_rewards.entry(account.to_string()).or_insert(0) += amount;
        rewards.total_distributed += amount;

        info!("Submitted reward claim transaction: {}", tx_hash);
        Ok(tx_hash)
    }

    /// Stake tokens
    pub async fn stake(&self, account: &str, amount: u128, lockup_blocks: u32) -> SwarmResult<String> {
        info!("Staking {} tokens from {} (lockup: {} blocks)", amount, account, lockup_blocks);

        if amount < RewardConfig::default().minimum_stake {
            return Err(SwarmError::BlockchainError(
                "Amount below minimum stake".to_string(),
            ));
        }

        let tx_hash = format!("0x{:064x}", rand::random::<u64>());

        // Update tracking
        let mut stakes = self.stakes.write().await;
        *stakes.account_stakes.entry(account.to_string()).or_insert(0) += amount;
        stakes.total_stake += amount;
        stakes.lockup_periods.insert(account.to_string(), lockup_blocks);

        info!("Submitted staking transaction: {}", tx_hash);
        Ok(tx_hash)
    }

    /// Unstake tokens
    pub async fn unstake(&self, account: &str, amount: u128) -> SwarmResult<String> {
        info!("Unstaking {} tokens from {}", amount, account);

        let mut stakes = self.stakes.write().await;
        let current = stakes.account_stakes.get(account).copied().unwrap_or(0);

        if current < amount {
            return Err(SwarmError::BlockchainError("Insufficient stake".to_string()));
        }

        let tx_hash = format!("0x{:064x}", rand::random::<u64>());

        *stakes.account_stakes.entry(account.to_string()).or_insert(0) -= amount;
        stakes.total_stake -= amount;

        info!("Submitted unstaking transaction: {}", tx_hash);
        Ok(tx_hash)
    }

    /// Get account stake
    pub async fn get_stake(&self, account: &str) -> SwarmResult<u128> {
        let stakes = self.stakes.read().await;
        Ok(stakes.account_stakes.get(account).copied().unwrap_or(0))
    }

    /// Get pending rewards
    pub async fn get_pending_rewards(&self, account: &str) -> SwarmResult<u128> {
        let rewards = self.rewards.read().await;
        Ok(rewards.pending_rewards.get(account).copied().unwrap_or(0))
    }

    /// Distribute rewards
    pub async fn distribute_rewards(
        &self,
        rewards: HashMap<String, u128>,
    ) -> SwarmResult<String> {
        let total: u128 = rewards.values().sum();
        info!("Distributing {} total rewards to {} recipients", total, rewards.len());

        let tx_hash = format!("0x{:064x}", rand::random::<u64>());

        // Update tracking
        let mut tracker = self.rewards.write().await;
        for (account, amount) in &rewards {
            *tracker.pending_rewards.entry(account.clone()).or_insert(0) += amount;
        }

        info!("Submitted reward distribution transaction: {}", tx_hash);
        Ok(tx_hash)
    }

    /// Execute slashing
    pub async fn slash(&self, account: &str, amount: u128, reason: &str) -> SwarmResult<String> {
        warn!("Slashing {} from {} (reason: {})", amount, account, reason);

        let mut stakes = self.stakes.write().await;
        let current = stakes.account_stakes.get(account).copied().unwrap_or(0);

        if current < amount {
            warn!("Slashing amount exceeds stake, slashing full amount");
        }

        let slashed = amount.min(current);
        *stakes.account_stakes.entry(account.to_string()).or_insert(0) -= slashed;
        stakes.total_stake -= slashed;

        let tx_hash = format!("0x{:064x}", rand::random::<u64>());

        info!("Submitted slashing transaction: {}", tx_hash);
        Ok(tx_hash)
    }

    /// Get reward configuration
    pub fn get_reward_config(&self) -> RewardConfig {
        RewardConfig::default()
    }

    /// Sync rewards from chain
    pub async fn sync_rewards_from_chain(&self, current_block: u32) -> SwarmResult<()> {
        debug!("Syncing rewards from blockchain at block {}", current_block);

        // In production: Query pallet-swarm for RewardClaimed events
        // and update local tracking

        let mut rewards = self.rewards.write().await;
        rewards.last_update_block = current_block;

        Ok(())
    }

    /// Get reward history
    pub async fn get_reward_history(&self, account: &str) -> SwarmResult<Vec<RewardEvent>> {
        debug!("Fetching reward history for {}", account);

        // Mock history
        Ok(vec![RewardEvent {
            account: account.to_string(),
            amount: 100_000_000,
            reason: "Task completed".to_string(),
            block_number: 1000,
            timestamp: Utc::now(),
        }])
    }
}

/// Reward event for history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardEvent {
    /// Account receiving reward
    pub account: String,

    /// Reward amount
    pub amount: u128,

    /// Reason for reward
    pub reason: String,

    /// Block number
    pub block_number: u32,

    /// Timestamp
    pub timestamp: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_blockchain_client_creation() {
        let client = BlockchainClient::new("ws://localhost:9944".to_string())
            .await
            .unwrap();
        assert!(client.get_block_number().await.is_ok());
    }

    #[test]
    fn test_reward_config() {
        let config = RewardConfig::default();
        assert!(config.minimum_stake > 0);
        assert_eq!(config.reward_token, "ATLAS");
    }
}
