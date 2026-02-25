use super::{IsolatedSigner, SignerError, SignerCaps};
use crate::wallet_core::ipc::{IntentDraft, Attestation, ChainType};

pub struct EvmSigner {
    pub chain_id: u64,
    // Secret handling omitted for brevity, would use secure memory
}

impl IsolatedSigner for EvmSigner {
    fn derive_address(&self, _path: &str) -> Result<String, SignerError> {
        Ok("0xEVM...".into())
    }

    fn sign_intent(&self, preimage: &IntentDraft, attestation: &Attestation) -> Result<String, SignerError> {
        // MUST VERIFY ATTESTATION SIG BEFORE PROCEEDING
        if attestation.intent_id != preimage.id {
            return Err(SignerError::IntentMismatch);
        }
        
        // Ensure not expired
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
        if attestation.expiry < now {
            return Err(SignerError::AttestationExpired);
        }

        // Return EIP-712 structured hex signature
        Ok("0xdeadbeef_eip712_sig".into())
    }

    fn sign_tx(&self, canonical_tx_bytes: &[u8], _intent_id: &str) -> Result<String, SignerError> {
        // MUST decode canonical_tx_bytes and match against cached Intent constraints before signing.
        Ok("0xsigned_tx_payload".into())
    }

    fn get_capabilities(&self) -> SignerCaps {
        SignerCaps {
            chains: vec!["EVM".to_string()],
            max_tx_value: "100000000000000000000".to_string(), // 100 ETH bound
            requires_hardware: false,
        }
    }
}
