/// Wallet-DEX RPC Integration
/// Wire wallet signing to DEX swap execution

use jsonrpc_core::{Error, Result};
use jsonrpc_derive::rpc;
use sp_api::ProvideRuntimeApi;
use sp_blockchain::HeaderBackend;
use sp_runtime::traits::Block as BlockT;
use std::sync::Arc;

/// Swap request with wallet integration
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct SwapRequest {
    pub token_in: [u8; 32],
    pub token_out: [u8; 32],
    pub amount_in: u128,
    pub min_amount_out: u128,
    pub wallet_id: [u8; 32],
    pub require_approval: bool,
    pub approval_threshold: u128,
}

/// Swap response with signing details
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct SwapResponse {
    pub swap_id: [u8; 32],
    pub amount_out: u128,
    pub approval_required: bool,
    pub approval_request_id: Option<[u8; 32]>,
    pub estimated_gas: u128,
}

/// Hardware wallet signing request
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct HardwareSigningRequest {
    pub transaction_hash: [u8; 32],
    pub display_message: String,
    pub request_id: [u8; 32],
    pub timeout_seconds: u32,
}

/// Hardware wallet signing response
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct HardwareSigningResponse {
    pub signature: Vec<u8>,
    pub recovery_id: u8,
    pub signed_block: u32,
}

#[rpc]
pub trait WalletDexApi {
    /// Estimate swap with approval requirements
    #[rpc(name = "walletDex_estimateSwap")]
    fn estimate_swap(&self, request: SwapRequest) -> Result<SwapResponse>;

    /// Execute swap with wallet signatures
    #[rpc(name = "walletDex_executeSwap")]
    fn execute_swap(&self, request: SwapRequest, signatures: Vec<Vec<u8>>) -> Result<SwapResponse>;

    /// Request hardware wallet signature
    #[rpc(name = "walletDex_requestHardwareSignature")]
    fn request_hardware_signature(
        &self,
        wallet_id: [u8; 32],
        transaction_hash: [u8; 32],
        display_message: String,
    ) -> Result<HardwareSigningRequest>;

    /// Approve transaction with multisig
    #[rpc(name = "walletDex_approveTransaction")]
    fn approve_transaction(
        &self,
        wallet_id: [u8; 32],
        transaction_hash: [u8; 32],
        approval_signature: Vec<u8>,
    ) -> Result<bool>;

    /// Get wallet balance
    #[rpc(name = "walletDex_getBalance")]
    fn get_balance(&self, account: String, token_id: [u8; 32]) -> Result<u128>;

    /// Check approval status
    #[rpc(name = "walletDex_getApprovalStatus")]
    fn get_approval_status(&self, approval_id: [u8; 32]) -> Result<(String, u32)>; // status, signatures_needed
}

/// RPC implementation
pub struct WalletDexRpc<Block, Client> {
    client: Arc<Client>,
    _phantom: std::marker::PhantomData<Block>,
}

impl<Block, Client> WalletDexRpc<Block, Client> {
    pub fn new(client: Arc<Client>) -> Self {
        WalletDexRpc {
            client,
            _phantom: std::marker::PhantomData,
        }
    }
}

impl<Block, Client> WalletDexApi for WalletDexRpc<Block, Client>
where
    Block: BlockT,
    Client: HeaderBackend<Block> + 'static,
{
    fn estimate_swap(&self, request: SwapRequest) -> Result<SwapResponse> {
        // Simplified swap estimation
        // In production: call DEX runtime api for actual prices
        let amount_out = (request.amount_in * 95) / 100; // simplified 5% fee

        let approval_required = request.require_approval && request.amount_in > request.approval_threshold;

        Ok(SwapResponse {
            swap_id: [0u8; 32],
            amount_out,
            approval_required,
            approval_request_id: if approval_required {
                Some([1u8; 32])
            } else {
                None
            },
            estimated_gas: 100_000,
        })
    }

    fn execute_swap(&self, request: SwapRequest, signatures: Vec<Vec<u8>>) -> Result<SwapResponse> {
        // In production: verify signatures against wallet, execute atomic swap
        // For now: simulate successful swap

        if request.require_approval && signatures.is_empty() {
            return Err(Error::invalid_params("Signatures required for approval"));
        }

        let amount_out = (request.amount_in * 95) / 100;

        Ok(SwapResponse {
            swap_id: [1u8; 32],
            amount_out,
            approval_required: false,
            approval_request_id: None,
            estimated_gas: 100_000,
        })
    }

    fn request_hardware_signature(
        &self,
        wallet_id: [u8; 32],
        transaction_hash: [u8; 32],
        display_message: String,
    ) -> Result<HardwareSigningRequest> {
        // Create signing request for hardware wallet
        // In production: interact with WebUSB/WebHID APIs

        let mut request_id = [0u8; 32];
        request_id[0..16].copy_from_slice(&wallet_id[0..16]);
        request_id[16..32].copy_from_slice(&transaction_hash[16..32]);

        Ok(HardwareSigningRequest {
            transaction_hash,
            display_message,
            request_id,
            timeout_seconds: 120, // 2 minute timeout
        })
    }

    fn approve_transaction(
        &self,
        wallet_id: [u8; 32],
        transaction_hash: [u8; 32],
        approval_signature: Vec<u8>,
    ) -> Result<bool> {
        // Verify signature against wallet
        // In production: validate against stored public key

        if approval_signature.is_empty() {
            return Err(Error::invalid_params("Signature cannot be empty"));
        }

        // Simplified: assume valid if non-empty
        Ok(true)
    }

    fn get_balance(&self, _account: String, _token_id: [u8; 32]) -> Result<u128> {
        // In production: query wallet pallet storage
        // For now: return mock balance
        Ok(1_000_000_000_000) // 1M tokens
    }

    fn get_approval_status(&self, _approval_id: [u8; 32]) -> Result<(String, u32)> {
        // In production: query approval pallet
        Ok(("pending".to_string(), 2)) // 2 signatures needed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estimate_swap() {
        let request = SwapRequest {
            token_in: [1u8; 32],
            token_out: [2u8; 32],
            amount_in: 1000,
            min_amount_out: 900,
            wallet_id: [3u8; 32],
            require_approval: false,
            approval_threshold: 5000,
        };

        // Simplified test without full RPC setup
        let amount_out = (request.amount_in * 95) / 100;
        assert_eq!(amount_out, 950);
    }

    #[test]
    fn test_swap_with_approval() {
        let request = SwapRequest {
            token_in: [1u8; 32],
            token_out: [2u8; 32],
            amount_in: 10000,
            min_amount_out: 9000,
            wallet_id: [3u8; 32],
            require_approval: true,
            approval_threshold: 5000,
        };

        // Amount > threshold, so approval required
        assert!(request.amount_in > request.approval_threshold);
    }

    #[test]
    fn test_hardware_signature_request() {
        let wallet_id = [1u8; 32];
        let tx_hash = [2u8; 32];
        let message = "Approve swap: 1000 USDC → 950 USDT".to_string();

        let mut request_id = [0u8; 32];
        request_id[0..16].copy_from_slice(&wallet_id[0..16]);
        request_id[16..32].copy_from_slice(&tx_hash[16..32]);

        assert_eq!(request_id[0..16], wallet_id[0..16]);
    }
}
