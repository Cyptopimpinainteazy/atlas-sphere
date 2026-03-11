//! X3 Bridge Infrastructure
//!
//! Cross-chain bridges: Ethereum, Solana, Cosmos, IBC, L2, Bitcoin, governance, and fee abstraction.

pub mod ethereum_bridge;
pub mod wormhole_adapter;
pub mod security_council;
pub mod ibc_light_client;
pub mod l2_bridge;
pub mod bitcoin_htlc;
pub mod cross_chain_account;
pub mod gas_relayer;
pub mod cross_chain_proofs;

pub use cross_chain_proofs::*;
pub use ethereum_bridge::{EthereumBridge, BridgeDeposit, ERC20Token};
pub use wormhole_adapter::{WormholeBridge, WrappedSPLToken, VAA};
pub use security_council::{BridgeSecurityCouncil, Proposal, ProposalType};
pub use ibc_light_client::{IBCLightClient, CosmosChainInfo, ConsensusState, IBCPacket};
pub use l2_bridge::{L2Bridge, L2BridgeDeposit, L2Withdrawal, OutputRoot};
pub use bitcoin_htlc::{BitcoinHTLC, HTLCContract, Preimage, BitcoinAddress};
pub use cross_chain_account::{CrossChainAccountManager, CrossChainAccount, DerivedAddress};
pub use gas_relayer::{GasRelayer, RelayerConfig, FeeRequest, SponsorPool};
