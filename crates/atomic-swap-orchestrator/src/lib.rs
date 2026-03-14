use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use x3_vm::{
    bridge::{BridgeConfig, X3VMBridge},
    gpu_hostcalls::GpuHostcalls,
    Value, VM,
};

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

    /// Creates an orchestrator with GPU hostcalls (0xD8/0xD9) pre-registered on `vm`.
    /// Use this instead of `new()` unless the caller has already registered them.
    pub fn new_with_gpu(mut vm: VM) -> Self {
        GpuHostcalls::new().register_on_vm(&mut vm);
        Self {
            vm: Arc::new(Mutex::new(vm)),
        }
    }

    /// Creates an orchestrator with both GPU hostcalls AND bridge hostcalls registered.
    ///
    /// This wires:
    /// - 0xD8/0xD9 — GPU atomic verify/commit (via GpuHostcalls)
    /// - 0x10–0x22 — SVM/EVM execution calls (via X3VMBridge real executors)
    /// - 0x30/0x31 — Cross-VM bridge ops (fail-closed until canonical ledger is wired)
    pub fn new_with_bridge(mut vm: VM) -> Self {
        // Register GPU hostcalls first (0xD8/0xD9)
        GpuHostcalls::new().register_on_vm(&mut vm);
        // Register bridge hostcalls (0x10-0x31) using real SVM/EVM executors
        let bridge = X3VMBridge::with_config(BridgeConfig {
            enable_svm: true,
            enable_evm: true,
            enable_gpu: false, // GPU already registered above
            gas_limit: 10_000_000,
            max_cpi_depth: 4,
        });
        bridge.register_bridge_hostcalls(&mut vm);
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
            log::warn!(
                "Atomic swap failed GPU verification: {:?}",
                hex::encode(&pair.swap_id)
            );
            return Ok(AtomicStatus::RolledBack);
        }

        // 2. PHASE: COMMIT (GPU-Accelerated)
        // We call the X3 VM hostcall 0xD9 (GPU_ATOMIC_COMMIT).
        // On commit failure we roll back and propagate the status — callers
        // should not re-submit the same swap_id after a rollback.
        match self.commit_gpu(&pair).await {
            Ok(()) => {
                log::info!("Atomic swap committed: {:?}", hex::encode(&pair.swap_id));
                Ok(AtomicStatus::Committed)
            }
            Err(e) => {
                log::error!(
                    "Atomic swap commit failed, rolling back {:?}: {:?}",
                    hex::encode(&pair.swap_id),
                    e
                );
                Ok(AtomicStatus::RolledBack)
            }
        }
    }

    async fn verify_gpu(&self, pair: &AtomicPair) -> Result<bool> {
        let vm = self.vm.lock().await;

        // Prepare arguments for gpu_atomic_verify(svm_data, evm_data)
        let args = vec![
            Value::Bytes(pair.svm_tx.clone()),
            Value::Bytes(pair.evm_tx.clone()),
        ];

        // Hostcall 0xD8 = GPU_ATOMIC_VERIFY
        let result = vm
            .invoke_hostcall(0xD8, &args)
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

    /// Drain all pending committed swap entries from the `/x3_atomic_commits`
    /// POSIX shm ring buffer written by `atomic_commit_host()`.
    ///
    /// Returns a list of `(svm_prefix_32, evm_prefix_32, committed_at_ns)` tuples
    /// for every new entry since the last drain.  Call this from your finality
    /// handler to trigger on-chain state updates.
    pub fn drain_committed_swaps() -> Vec<([u8; 32], [u8; 32], u64)> {
        use std::ffi::CStr;
        use std::os::raw::c_int;

        // Constants mirror those in atomic_swap.cu
        const RING_SIZE: usize = 256;
        const SHM_NAME: &[u8] = b"/x3_atomic_commits\0";

        #[repr(C)]
        struct AtomicCommitEntry {
            svm_prefix:     [u8; 32],
            evm_prefix:     [u8; 32],
            committed_at_ns: u64,
            valid:          u8,
            _pad:           [u8; 7],
        }

        #[repr(C)]
        struct AtomicCommitRing {
            write_idx: u32,
            _pad:      [u32; 7],
            entries:   [AtomicCommitEntry; RING_SIZE],
        }

        let shm_size = std::mem::size_of::<AtomicCommitRing>();

        let fd = unsafe {
            libc::shm_open(
                SHM_NAME.as_ptr() as *const libc::c_char,
                libc::O_RDWR,
                0,
            )
        };
        if fd < 0 {
            return Vec::new(); // shm not yet created — nothing committed
        }

        let ptr = unsafe {
            libc::mmap(
                std::ptr::null_mut(),
                shm_size,
                libc::PROT_READ | libc::PROT_WRITE,
                libc::MAP_SHARED,
                fd,
                0,
            )
        };
        unsafe { libc::close(fd) };
        if ptr == libc::MAP_FAILED {
            return Vec::new();
        }

        let ring = ptr as *mut AtomicCommitRing;
        let mut results = Vec::new();

        for i in 0..RING_SIZE {
            let entry = unsafe { &mut (*ring).entries[i] };
            // Acquire load: read valid flag
            let valid =
                unsafe { std::sync::atomic::AtomicU8::from_ptr(&mut entry.valid as *mut u8) }
                    .load(std::sync::atomic::Ordering::Acquire);
            if valid == 1 {
                results.push((entry.svm_prefix, entry.evm_prefix, entry.committed_at_ns));
                // Clear the slot so we don't re-read it next drain
                unsafe {
                    std::sync::atomic::AtomicU8::from_ptr(&mut entry.valid as *mut u8)
                        .store(0, std::sync::atomic::Ordering::Release)
                };
            }
        }

        unsafe { libc::munmap(ptr, shm_size) };
        results
    }
}
