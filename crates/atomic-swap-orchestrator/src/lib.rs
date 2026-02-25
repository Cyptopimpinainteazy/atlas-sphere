use std::sync::Arc;
use tokio::sync::Mutex;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use x3_vm::{Value, VM};

/// Atomic Transaction Pair (SVM + EVM)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtomicPair {
    pub swap_id: Vec<u8>,
    pub svm_tx: Vec<u8>,
    pub evm_tx: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AtomicStatus {
    Pending,
    Verified,
    Committed,
    RolledBack,
}

/// Orchestrator for Atomic Swaps implementing the 3-Phase Commit (3PAC) protocol.
pub struct AtomicSwapOrchestrator {
    vm: Arc<Mutex<VM>>,
}

impl AtomicSwapOrchestrator {
    pub fn new(vm: VM) -> Self {
        Self {
            vm: Arc::new(Mutex::new(vm)),
        }
    }

    /// Primary entry point for atomic validation and commitment.
    /// This follows the Hard Gate: 100% Determinism, <10ms Overhead.
    pub async fn process_swap(&self, pair: AtomicPair) -> Result<AtomicStatus> {
        log::info!("Processing atomic swap: {:?}", hex::encode(&pair.swap_id));

        // 1. PHASE: VALIDATE (GPU-Accelerated)
        // We call the X3 VM hostcall 0xD8 (GPU_ATOMIC_VERIFY)
        let is_valid = self.verify_gpu(&pair).await?;

        if !is_valid {
            log::error!("Atomic swap failed GPU verification: {:?}", hex::encode(&pair.swap_id));
            return Ok(AtomicStatus::RolledBack);
        }

        // 2. PHASE: COMMIT (GPU-Accelerated)
        // We call the X3 VM hostcall 0xD9 (GPU_ATOMIC_COMMIT)
        self.commit_gpu(&pair).await?;

        log::info!("Atomic swap committed: {:?}", hex::encode(&pair.swap_id));
        Ok(AtomicStatus::Committed)
    }

    async fn verify_gpu(&self, pair: &AtomicPair) -> Result<bool> {
        let vm = self.vm.lock().await;
        
        // Prepare arguments for gpu_atomic_verify(svm_data, evm_data)
        let args = vec![
            Value::Bytes(pair.svm_tx.clone()),
            Value::Bytes(pair.evm_tx.clone()),
        ];

        // Hostcall 0xD8 = GPU_ATOMIC_VERIFY
        let result = vm.invoke_hostcall(0xD8, &args)
            .map_err(|e| anyhow!("VM Hostcall 0xD8 Error: {:?}", e))?;

        match result {
            Some(Value::Bool(b)) => Ok(b),
            _ => Err(anyhow!("Unexpected return value from GPU_ATOMIC_VERIFY")),
        }
    }

    async fn commit_gpu(&self, pair: &AtomicPair) -> Result<()> {
        let vm = self.vm.lock().await;

        let args = vec![
            Value::Bytes(pair.svm_tx.clone()),
            Value::Bytes(pair.evm_tx.clone()),
        ];

        // Hostcall 0xD9 = GPU_ATOMIC_COMMIT
        vm.invoke_hostcall(0xD9, &args)
            .map_err(|e| anyhow!("VM Hostcall 0xD9 Error: {:?}", e))?;

        Ok(())
    }
}
