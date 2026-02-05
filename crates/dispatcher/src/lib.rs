#![deny(missing_docs)]
//! Simple Dual-VM Dispatcher crate used as a standalone implementation for testing and
//! integration prior to wiring into the Atlas Kernel pallet.

use serde::{Deserialize, Serialize};

/// VM identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VMId {
    /// EVM runtime
    EVM,
    /// SVM runtime
    SVM,
    /// X3 runtime
    X3,
}

/// Transaction envelope routed by the dispatcher
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TxEnvelope {
    /// VM to route to
    pub vm_id: VMId,
    /// Payload bytes
    pub payload: Vec<u8>,
    /// Gas/compute limit
    pub gas_limit: u64,
    /// Signer bytes (e.g., encoded account id)
    pub signer: Vec<u8>,
    /// Signature bytes (expected to be sha256(payload || signer) for now)
    pub signature: Vec<u8>,
}

/// Execution result returned by the runtime
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VMExecutionResult {
    /// Whether execution succeeded
    pub success: bool,
    /// Gas used
    pub gas_used: u64,
    /// Return data
    pub return_data: Vec<u8>,
}

/// Dispatch errors
#[derive(thiserror::Error, Debug, PartialEq, Eq)]
pub enum DispatchError {
    /// Gas limit outside allowed range for the target VM
    #[error("invalid gas limit for target VM")]
    InvalidGasLimit,
    /// Signature did not validate for the provided signer/payload
    #[error("invalid signature")]
    InvalidSignature,
    /// VM not supported (not yet implemented)
    #[error("unsupported vm")]
    UnsupportedVm,
    /// Generic execution failure
    #[error("execution failed: {0}")]
    ExecutionFailed(String),
}

/// Dispatcher configuration and behavior
pub struct Dispatcher {
    evm_max_gas: u64,
    svm_max_compute: u64,
    x3_max_gas: u64,
}

impl Dispatcher {
    /// Create a new dispatcher with per-VM gas/computation limits
    pub fn new(evm_max_gas: u64, svm_max_compute: u64, x3_max_gas: u64) -> Self {
        Self {
            evm_max_gas,
            svm_max_compute,
            x3_max_gas,
        }
    }

    /// Verify ECDSA signature (secp256k1) over the payload using SHA256.
    /// `signer` is expected to be the SEC1-encoded public key bytes (compressed or uncompressed);
    /// `signature` is expected to be the compact 64-byte (r||s) signature.
    pub fn verify_ecdsa_signature(payload: &[u8], signer: &[u8], signature: &[u8]) -> bool {
        use k256::ecdsa::{VerifyingKey};
        use k256::ecdsa::signature::{Signature as _, Verifier};

        if signer.is_empty() || signature.is_empty() {
            return false;
        }

        // Parse verifying key from SEC1-encoded public key bytes
        let vk = match VerifyingKey::from_sec1_bytes(signer) {
            Ok(v) => v,
            Err(_) => return false,
        };

        // Try to parse signature as compact 64-bytes
        let sig = match k256::ecdsa::Signature::from_bytes(signature) {
            Ok(s) => s,
            Err(_) => return false,
        };

        // Verify signature against the raw payload bytes. k256's Signer/Verifier
        // implementations used in tests operate on the message bytes directly, so
        // verify using the same input that was signed.
        vk.verify(payload, &sig).is_ok()
    }

    /// Validate signature provided separately
    pub fn validate_signature(&self, signer: &[u8], signature: &[u8], payload: &[u8]) -> bool {
        Self::verify_ecdsa_signature(payload, signer, signature)
    }

    /// Validate the gas/compute limit for a VM
    pub fn validate_gas_limit(&self, vm_id: VMId, gas_limit: u64) -> bool {
        match vm_id {
            VMId::EVM => gas_limit <= self.evm_max_gas,
            VMId::SVM => gas_limit <= self.svm_max_compute,
            VMId::X3 => gas_limit <= self.x3_max_gas,
        }
    }

    /// Dispatch transaction to target VM. For now, execution is simulated deterministically.
    pub fn dispatch(&self, tx: TxEnvelope) -> Result<VMExecutionResult, DispatchError> {
        // Basic payload validation
        if tx.payload.is_empty() {
            return Err(DispatchError::ExecutionFailed("empty payload".into()));
        }

        // Signature validation
        if !self.validate_signature(&tx.signer, &tx.signature, &tx.payload) {
            return Err(DispatchError::InvalidSignature);
        }

        if !self.validate_gas_limit(tx.vm_id, tx.gas_limit) {
            return Err(DispatchError::InvalidGasLimit);
        }

        match tx.vm_id {
            VMId::EVM => Ok(VMExecutionResult {
                success: true,
                gas_used: core::cmp::min(tx.gas_limit, tx.payload.len() as u64 * 10 + 21_000), // simulated usage
                return_data: vec![],
            }),
            VMId::SVM => Ok(VMExecutionResult {
                success: true,
                gas_used: core::cmp::min(tx.gas_limit, tx.payload.len() as u64 * 5 + 5_000), // simulated usage
                return_data: vec![],
            }),
            VMId::X3 => {
                // X3-specific validation: payloads starting with 0xFF represent a failing execution case
                if tx.payload.get(0) == Some(&0xFFu8) {
                    return Err(DispatchError::ExecutionFailed("x3 execution failed".into()));
                }
                // Require magic header 0x58,0x33
                if tx.payload.len() < 2 || tx.payload[0] != 0x58 || tx.payload[1] != 0x33 {
                    return Err(DispatchError::ExecutionFailed("invalid x3 header".into()));
                }
                Ok(VMExecutionResult {
                    success: true,
                    gas_used: core::cmp::min(tx.gas_limit, tx.payload.len() as u64 * 5 + 3_000), // simulated X3 usage
                    return_data: vec![],
                })
            }
        }
    }
}

#[cfg(any(feature = "test-helpers", test))]
/// Test utilities for signing/verifying payloads.
///
/// These helpers produce the same compressed SEC1 pubkey (33 bytes) and compact
/// ECDSA signature (r||s 64 bytes) used by pallet-level tests.
pub mod test_utils {
    use k256::ecdsa::{SigningKey, signature::Signer};
    use k256::elliptic_curve::sec1::ToEncodedPoint;

    /// Sign a payload using the provided 32-byte secp256k1 private key.
    /// Returns (compressed_pubkey_bytes_33, signature_bytes_64).
    pub fn sign_payload(sk_bytes: &[u8; 32], payload: &[u8]) -> (Vec<u8>, Vec<u8>) {
        let sk = SigningKey::from_bytes(sk_bytes).expect("invalid signing key bytes");
        let pk = sk.verifying_key();
        let ep = pk.to_encoded_point(true);
        let pubkey = ep.as_bytes().to_vec();
        let sig: k256::ecdsa::Signature = sk.sign(payload);
        let sig_bytes = sig.as_ref().to_vec();
        (pubkey, sig_bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_gas_limits() {
        let d = Dispatcher::new(100_000, 200_000, 50_000);
        assert!(d.validate_gas_limit(VMId::EVM, 50_000));
        assert!(!d.validate_gas_limit(VMId::EVM, 200_000));
        assert!(d.validate_gas_limit(VMId::SVM, 200_000));
        assert!(!d.validate_gas_limit(VMId::SVM, 200_001));
    }

    #[test]
    fn dispatch_routing() {
        use k256::ecdsa::{SigningKey, signature::Signer};
        use k256::elliptic_curve::sec1::ToEncodedPoint;
        // Use deterministic private keys for tests
        let d = Dispatcher::new(100_000, 200_000, 50_000);

        // EVM
        let payload1 = vec![1,2,3];
        let (pk1_bytes, sig1) = crate::test_utils::sign_payload(&[1u8;32], &payload1);
        let tx_evm = TxEnvelope { vm_id: VMId::EVM, payload: payload1, gas_limit: 90_000, signer: pk1_bytes, signature: sig1 };
        let res = d.dispatch(tx_evm).expect("EVM should succeed");
        assert!(res.success);

        // SVM
        let payload2 = vec![4,5,6];
        let (pk2_bytes, sig2) = crate::test_utils::sign_payload(&[2u8;32], &payload2);
        let tx_svm = TxEnvelope { vm_id: VMId::SVM, payload: payload2, gas_limit: 150_000, signer: pk2_bytes, signature: sig2 };
        let res = d.dispatch(tx_svm).expect("SVM should succeed");
        assert!(res.success);

        // X3
        let payload_x3 = vec![0x58, 0x33, 0x00];
        let (pk3_bytes, sig3) = crate::test_utils::sign_payload(&[3u8;32], &payload_x3);
        let tx_x3 = TxEnvelope { vm_id: VMId::X3, payload: payload_x3, gas_limit: 10_000, signer: pk3_bytes, signature: sig3 };
        let res = d.dispatch(tx_x3).expect("X3 should succeed");
        assert!(res.success);
    }

    #[test]
    fn invalid_gas_error() {
        use k256::ecdsa::{SigningKey, signature::Signer};
        let d = Dispatcher::new(1_000, 1_000, 1_000);
        let (signer, sig) = crate::test_utils::sign_payload(&[9u8;32], &[0x01]);
        let tx = TxEnvelope { vm_id: VMId::EVM, payload: vec![0x01], gas_limit: 2_000, signer: signer.clone(), signature: sig };
        let err = d.dispatch(tx).unwrap_err();
        assert_eq!(err, DispatchError::InvalidGasLimit);
    }

    #[test]
    fn empty_payload_is_rejected() {
        use k256::ecdsa::{SigningKey, signature::Signer};
        let d = Dispatcher::new(100_000, 200_000, 50_000);
        let (signer, sig) = crate::test_utils::sign_payload(&[8u8;32], &[]);
        let tx = TxEnvelope { vm_id: VMId::EVM, payload: vec![], gas_limit: 50_000, signer: signer.clone(), signature: sig };
        let err = d.dispatch(tx).unwrap_err();
        assert_eq!(err, DispatchError::ExecutionFailed("empty payload".into()));
    }

    #[test]
    fn invalid_signature_rejected() {
        let d = Dispatcher::new(100_000, 200_000, 50_000);
        let signer = b"mallory".to_vec();
        let bad_sig = b"bad_sig".to_vec();
        let tx = TxEnvelope { vm_id: VMId::EVM, payload: vec![1,2,3], gas_limit: 50_000, signer: signer.clone(), signature: bad_sig };
        let err = d.dispatch(tx).unwrap_err();
        assert_eq!(err, DispatchError::InvalidSignature);
    }

    #[test]
    fn x3_invalid_header_rejected() {
        let d = Dispatcher::new(100_000, 200_000, 50_000);
        use k256::ecdsa::{SigningKey, signature::Signer};
        let (signer, sig) = crate::test_utils::sign_payload(&[7u8;32], &vec![0x00,0x01]);
        let payload = vec![0x00, 0x01];
        let tx = TxEnvelope { vm_id: VMId::X3, payload: payload.clone(), gas_limit: 50_000, signer: signer.clone(), signature: sig };
        let err = d.dispatch(tx).unwrap_err();
        assert_eq!(err, DispatchError::ExecutionFailed("invalid x3 header".into()));
    }

    #[test]
    fn x3_failing_payload_rejected() {
        let d = Dispatcher::new(100_000, 200_000, 50_000);
        use k256::ecdsa::{SigningKey, signature::Signer};
        let (signer, sig) = crate::test_utils::sign_payload(&[6u8;32], &vec![0xFF,0x00,0x00]);
        let payload = vec![0xFF, 0x00, 0x00];
        let tx = TxEnvelope { vm_id: VMId::X3, payload: payload.clone(), gas_limit: 50_000, signer: signer.clone(), signature: sig };
        let err = d.dispatch(tx).unwrap_err();
        assert_eq!(err, DispatchError::ExecutionFailed("x3 execution failed".into()));
    }
}
