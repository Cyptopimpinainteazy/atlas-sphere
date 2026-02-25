use super::{IsolatedSigner, SignerError, SignerCaps};
use crate::wallet_core::ipc::{IntentDraft, Attestation, ChainType};

pub struct SvmSigner {
    pub genesis_hash: String,
    // Secret handling omitted for brevity
}

impl IsolatedSigner for SvmSigner {
    fn derive_address(&self, _path: &str) -> Result<String, SignerError> {
        Ok("SVM...".into())
    }

    fn sign_intent(&self, preimage: &IntentDraft, attestation: &Attestation) -> Result<String, SignerError> {
        if attestation.intent_id != preimage.id {
            return Err(SignerError::IntentMismatch);
        }
        
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
        if attestation.expiry < now {
            return Err(SignerError::AttestationExpired);
        }

        Ok("ed25519_intent_sig".into())
    }

    fn sign_tx(&self, canonical_tx_bytes: &[u8], _intent_id: &str) -> Result<String, SignerError> {
        Ok("svm_signed_tx_base58".into())
    }

    fn get_capabilities(&self) -> SignerCaps {
        SignerCaps {
            chains: vec!["SVM".to_string()],
            max_tx_value: "100000000000000000".to_string(), // 100 SOL 
            requires_hardware: false,
        }
    }
}
