/// Proof Submitter - Submits proofs to X3 runtime via RPC

use crate::types::{EvmProof, SvmProof};
use anyhow::{anyhow, Result};
use log::{debug, info, warn};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct RpcSubmitter {
    x3_rpc_url: String,
    relayer_account: String,
    nonce: Arc<RwLock<u32>>,
    rpc_client: reqwest::Client,
}

impl RpcSubmitter {
    pub async fn new(x3_rpc_url: String, relayer_account: String) -> Result<Self> {
        let client = reqwest::Client::new();
        
        // Initialize nonce from X3 runtime
        let initial_nonce = Self::get_account_nonce(&client, &x3_rpc_url, &relayer_account).await?;
        
        info!(
            "RPC submitter initialized for {} (initial nonce: {})",
            relayer_account, initial_nonce
        );

        Ok(Self {
            x3_rpc_url,
            relayer_account,
            nonce: Arc::new(RwLock::new(initial_nonce)),
            rpc_client: client,
        })
    }

    pub async fn submit_evm_proof(&self, proof: EvmProof) -> Result<String> {
        let nonce = {
            let mut n = self.nonce.write().await;
            let current = *n;
            *n = n.saturating_add(1);
            current
        };

        debug!(
            "Submitting EVM proof (domain: {}, block: {}, nonce: {})",
            proof.source_domain, proof.finalized_block, nonce
        );

        let extrinsic = self.build_submit_cross_vm_extrinsic(&proof)?;
        
        self.submit_extrinsic(&extrinsic, nonce).await
    }

    pub async fn submit_svm_proof(&self, proof: SvmProof) -> Result<String> {
        let nonce = {
            let mut n = self.nonce.write().await;
            let current = *n;
            *n = n.saturating_add(1);
            current
        };

        debug!(
            "Submitting SVM proof (domain: {}, slot: {}, nonce: {})",
            proof.source_domain, proof.slot, nonce
        );

        let extrinsic = self.build_submit_svm_extrinsic(&proof)?;
        
        self.submit_extrinsic(&extrinsic, nonce).await
    }

    pub async fn is_bridge_paused(&self) -> Result<bool> {
        let response = self.rpc_client
            .post(&self.x3_rpc_url)
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "method": "x3_getBridgeStatus",
                "params": [],
                "id": 1,
            }))
            .send()
            .await?;

        let json: serde_json::Value = response.json().await?;
        
        json["result"]["paused"]
            .as_bool()
            .ok_or_else(|| anyhow!("No paused status in response"))
    }

    pub async fn get_nonce(&self) -> Result<u32> {
        let nonce = self.nonce.read().await;
        Ok(*nonce)
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    async fn submit_extrinsic(&self, extrinsic: &str, nonce: u32) -> Result<String> {
        let response = self.rpc_client
            .post(&self.x3_rpc_url)
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "method": "author_submitExtrinsic",
                "params": [extrinsic],
                "id": 1,
            }))
            .send()
            .await?;

        let json: serde_json::Value = response.json().await?;
        
        if let Some(error) = json.get("error") {
            warn!("RPC error submitting extrinsic (nonce: {}): {}", nonce, error);
            return Err(anyhow!("RPC error: {}", error));
        }

        let tx_hash = json["result"]
            .as_str()
            .ok_or_else(|| anyhow!("No tx hash in response"))?
            .to_string();

        info!("Submitted extrinsic: {}", tx_hash);
        Ok(tx_hash)
    }

    fn build_submit_cross_vm_extrinsic(&self, proof: &EvmProof) -> Result<String> {
        // Simplified extrinsic encoding (in production, use proper scale codec)
        let payload = serde_json::json!({
            "pallet": "x3Verifier",
            "call": "submitEvmProof",
            "args": {
                "domain": proof.source_domain,
                "block_hash": format!("0x{:x}", u256_from_bytes(&proof.block_hash)),
                "state_root": format!("0x{:x}", u256_from_bytes(&proof.state_root)),
                "finalized_block": proof.finalized_block,
            }
        });

        Ok(serde_json::to_string(&payload)?)
    }

    fn build_submit_svm_extrinsic(&self, proof: &SvmProof) -> Result<String> {
        let payload = serde_json::json!({
            "pallet": "x3Verifier",
            "call": "submitSvmProof",
            "args": {
                "domain": proof.source_domain,
                "slot": proof.slot,
                "blockhash": format!("0x{:x}", u256_from_bytes(&proof.blockhash)),
                "validator_signatures": proof.validator_signatures.iter()
                    .map(|sig| format!("0x{:x}", u256_from_bytes(sig)))
                    .collect::<Vec<_>>(),
                "required_signatures": proof.required_signatures,
            }
        });

        Ok(serde_json::to_string(&payload)?)
    }

    async fn get_account_nonce(
        client: &reqwest::Client,
        rpc_url: &str,
        account: &str,
    ) -> Result<u32> {
        let response = client
            .post(rpc_url)
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "method": "system_accountNextIndex",
                "params": [account],
                "id": 1,
            }))
            .send()
            .await?;

        let json: serde_json::Value = response.json().await?;
        
        json["result"]
            .as_u64()
            .map(|n| n as u32)
            .ok_or_else(|| anyhow!("No nonce in response"))
    }
}

/// Convert [u8; 32] to u256 representation for hex encoding
fn u256_from_bytes(bytes: &[u8; 32]) -> u128 {
    let mut result: u128 = 0;
    for (i, &byte) in bytes.iter().take(16).enumerate() {
        result |= (byte as u128) << (8 * i);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_u256_from_bytes() {
        let mut bytes = [0u8; 32];
        bytes[0] = 0xFF;
        bytes[1] = 0xEE;
        let result = u256_from_bytes(&bytes);
        assert_eq!(result, 0xEEFF);
    }
}
