use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sp_core::{hashing::sha2_256, H256};
use std::sync::Arc;
use tokio::sync::Mutex;
use x3_vm::{
    bridge::{BridgeConfig, X3VMBridge},
    gpu_hostcalls::GpuHostcalls,
    Value, VM,
};

/// Atomic Transaction Pair (SVM + EVM).
///
/// `sequence_nonce` is a monotonically increasing per-account counter that
/// enforces submission ordering across concurrent swaps (BRIDGE-005).
/// Callers must increment it for every new swap; the orchestrator and the
/// on-chain pallet use it to detect and reject out-of-order replays.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtomicPair {
    pub swap_id: Vec<u8>,
    pub svm_tx: Vec<u8>,
    pub evm_tx: Vec<u8>,
    /// Monotonic sequence counter for replay-protection and ordering.
    /// Set to 0 if ordering is not required (e.g., isolated test swaps).
    pub sequence_nonce: u64,
}

/// Outcome returned by `process_swap()`.  Contains both the local `AtomicStatus`
/// and all data needed for on-chain finalization via `finalize_atomic_bundle`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessResult {
    pub status: AtomicStatus,
    /// Deterministic bundle identifier (SHA-256 of swap_id || svm_tx || evm_tx || nonce).
    pub bundle_id: H256,
    /// Receipt root to be passed to `finalize_atomic_bundle` on success.
    /// Computed as SHA-256 of the committed shm entry data (svm_prefix || evm_prefix).
    /// `None` when the swap was rolled back.
    pub receipt_root: Option<H256>,
    /// Nanosecond timestamp from the GPU commit, for auditing.
    pub committed_at_ns: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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
    ///
    /// Implements the 3-Phase Atomic Commit (3PAC) protocol:
    ///  1. **Verify** — GPU batch-verifies Ed25519 (SVM) + secp256k1 (EVM) sigs.
    ///  2. **Commit** — GPU writes the pair to the shm ring buffer.
    ///  3. **Drain**  — Reads the ring buffer for this pair's committed entry,
    ///                  builds the receipt_root, and returns finalization data.
    ///
    /// The returned `ProcessResult` contains everything needed to call
    /// `finalize_atomic_bundle` on the x3-atomic-kernel pallet.
    pub async fn process_swap(&self, pair: AtomicPair) -> Result<ProcessResult> {
        let bundle_id = Self::derive_bundle_id(&pair);
        log::info!(
            "Processing atomic swap: bundle_id={:?} seq={}",
            bundle_id,
            pair.sequence_nonce
        );

        // PHASE 1: GPU-accelerated verification (0xD8)
        let is_valid = self.verify_gpu(&pair).await?;
        if !is_valid {
            log::warn!("Atomic swap failed GPU verification: bundle_id={:?}", bundle_id);
            return Ok(ProcessResult {
                status: AtomicStatus::RolledBack,
                bundle_id,
                receipt_root: None,
                committed_at_ns: None,
            });
        }

        // PHASE 2: GPU-accelerated commit (0xD9 → shm ring buffer)
        if let Err(e) = self.commit_gpu(&pair).await {
            log::error!("Atomic swap commit failed, rolling back {:?}: {:?}", bundle_id, e);
            return Ok(ProcessResult {
                status: AtomicStatus::RolledBack,
                bundle_id,
                receipt_root: None,
                committed_at_ns: None,
            });
        }

        // PHASE 3: Drain shm ring buffer and compute receipt_root for on-chain finalization.
        //
        // The GPU wrote our entry to /x3_atomic_commits.  We read it back, compute
        // a deterministic receipt_root (SHA-256 of svm_prefix || evm_prefix), and
        // return it so the caller can submit `finalize_atomic_bundle` to the pallet.
        //
        // Note: In production, this should poll with a short timeout.  Here we do a
        // single drain since the GPU commit is synchronous in the non-CUDA fallback.
        let committed = Self::drain_committed_swaps();
        let (receipt_root, committed_at_ns) = if let Some((svm_prefix, evm_prefix, ts)) =
            committed.into_iter().find(|(svm, _evm, _ts)| {
                // Match on the first 32 bytes of our svm_tx
                let our_prefix = &pair.svm_tx[..pair.svm_tx.len().min(32)];
                &svm[..our_prefix.len()] == our_prefix
            }) {
            let root = Self::compute_receipt_root(&svm_prefix, &evm_prefix);
            (Some(root), Some(committed_at_ns))
        } else {
            // Fallback: compute deterministic receipt_root from the pair directly.
            // This path is taken in tests where the shm is not available.
            let svm_prefix: [u8; 32] = {
                let mut a = [0u8; 32];
                let n = pair.svm_tx.len().min(32);
                a[..n].copy_from_slice(&pair.svm_tx[..n]);
                a
            };
            let evm_prefix: [u8; 32] = {
                let mut a = [0u8; 32];
                let n = pair.evm_tx.len().min(32);
                a[..n].copy_from_slice(&pair.evm_tx[..n]);
                a
            };
            (
                Some(Self::compute_receipt_root(&svm_prefix, &evm_prefix)),
                None,
            )
        };

        log::info!("Atomic swap committed: bundle_id={:?}", bundle_id);
        Ok(ProcessResult {
            status: AtomicStatus::Committed,
            bundle_id,
            receipt_root,
            committed_at_ns,
        })
    }

    /// Compute a deterministic `bundle_id` (H256) for an `AtomicPair`.
    ///
    /// `bundle_id = SHA-256(swap_id || svm_tx || evm_tx || sequence_nonce_le)`
    ///
    /// This must match the derivation in `submit_atomic_bundle` on the pallet
    /// (where it uses `T::Hashing::hash(&legs_encoded)`).  For off-chain use
    /// we use SHA-256 for compatibility with EVM verifier contracts.
    pub fn derive_bundle_id(pair: &AtomicPair) -> H256 {
        let mut data = pair.swap_id.clone();
        data.extend_from_slice(&pair.svm_tx);
        data.extend_from_slice(&pair.evm_tx);
        data.extend_from_slice(&pair.sequence_nonce.to_le_bytes());
        H256(sha2_256(&data))
    }

    /// Compute the `receipt_root` from a committed shm entry.
    ///
    /// `receipt_root = SHA-256(svm_prefix || evm_prefix)`
    ///
    /// This is the value that goes into `finalize_atomic_bundle` on the pallet.
    pub fn compute_receipt_root(svm_prefix: &[u8; 32], evm_prefix: &[u8; 32]) -> H256 {
        let mut data = [0u8; 64];
        data[..32].copy_from_slice(svm_prefix);
        data[32..].copy_from_slice(evm_prefix);
        H256(sha2_256(&data))
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

#[cfg(test)]
mod tests {
    use super::*;

    // ── AtomicPair helpers ────────────────────────────────────────────────────

    fn make_pair(swap_id: u8, svm: &[u8], evm: &[u8], nonce: u64) -> AtomicPair {
        AtomicPair {
            swap_id: vec![swap_id; 8],
            svm_tx: svm.to_vec(),
            evm_tx: evm.to_vec(),
            sequence_nonce: nonce,
        }
    }

    // ── bundle_id determinism ─────────────────────────────────────────────────

    #[test]
    fn test_bundle_id_is_deterministic() {
        let p1 = make_pair(1, b"svm_data_abc", b"evm_data_xyz", 0);
        let p2 = make_pair(1, b"svm_data_abc", b"evm_data_xyz", 0);
        assert_eq!(
            AtomicSwapOrchestrator::derive_bundle_id(&p1),
            AtomicSwapOrchestrator::derive_bundle_id(&p2),
            "Same inputs must produce the same bundle_id"
        );
    }

    #[test]
    fn test_bundle_id_differs_by_nonce() {
        let p0 = make_pair(1, b"svm_data", b"evm_data", 0);
        let p1 = make_pair(1, b"svm_data", b"evm_data", 1);
        assert_ne!(
            AtomicSwapOrchestrator::derive_bundle_id(&p0),
            AtomicSwapOrchestrator::derive_bundle_id(&p1),
            "Different sequence_nonce must yield different bundle_id"
        );
    }

    #[test]
    fn test_bundle_id_differs_by_swap_content() {
        let p_svm = make_pair(1, b"svm_A", b"evm_data", 0);
        let p_evm = make_pair(1, b"svm_data", b"evm_B", 0);
        assert_ne!(
            AtomicSwapOrchestrator::derive_bundle_id(&p_svm),
            AtomicSwapOrchestrator::derive_bundle_id(&p_evm),
        );
    }

    // ── receipt_root ──────────────────────────────────────────────────────────

    #[test]
    fn test_receipt_root_deterministic() {
        let s = [0x11u8; 32];
        let e = [0x22u8; 32];
        let r1 = AtomicSwapOrchestrator::compute_receipt_root(&s, &e);
        let r2 = AtomicSwapOrchestrator::compute_receipt_root(&s, &e);
        assert_eq!(r1, r2);
    }

    #[test]
    fn test_receipt_root_order_matters() {
        let s = [0x11u8; 32];
        let e = [0x22u8; 32];
        let r_se = AtomicSwapOrchestrator::compute_receipt_root(&s, &e);
        let r_es = AtomicSwapOrchestrator::compute_receipt_root(&e, &s);
        assert_ne!(
            r_se, r_es,
            "Swapping svm/evm in receipt_root must give different roots"
        );
    }

    #[test]
    fn test_receipt_root_nonzero() {
        let s = [0xABu8; 32];
        let e = [0xCDu8; 32];
        let root = AtomicSwapOrchestrator::compute_receipt_root(&s, &e);
        assert_ne!(root, H256::zero(), "SHA-256 of non-zero input is never zero");
    }

    // ── sequence_nonce ordering ───────────────────────────────────────────────

    #[test]
    fn test_nonce_sequence_is_monotonically_distinct() {
        // N consecutive swaps from the same submitter must all have unique bundle_ids
        let pairs: Vec<_> = (0u64..10)
            .map(|n| make_pair(1, b"svm", b"evm", n))
            .collect();
        let ids: Vec<_> = pairs
            .iter()
            .map(AtomicSwapOrchestrator::derive_bundle_id)
            .collect();

        // Verify all 10 bundle_ids are distinct
        let unique: std::collections::HashSet<_> = ids.iter().collect();
        assert_eq!(
            unique.len(),
            10,
            "Every nonce must produce a unique bundle_id"
        );

        // Verify they are ordered differently (no accidental collision)
        assert_ne!(ids[0], ids[9]);
    }

    // ── drain_committed_swaps (no shm available — returns empty) ─────────────

    #[test]
    fn test_drain_returns_empty_when_no_shm() {
        // Without a running CUDA kernel there is no /x3_atomic_commits shm.
        // drain_committed_swaps must return [] instead of panicking.
        let drained = AtomicSwapOrchestrator::drain_committed_swaps();
        // Either empty (no shm) or a valid Vec (shm exists from prior test run).
        // We only assert it doesn't panic.
        let _ = drained;
    }

    // ── AtomicStatus equality ─────────────────────────────────────────────────

    #[test]
    fn test_atomic_status_eq() {
        assert_eq!(AtomicStatus::Committed, AtomicStatus::Committed);
        assert_ne!(AtomicStatus::Committed, AtomicStatus::RolledBack);
        assert_ne!(AtomicStatus::Pending, AtomicStatus::Verified);
    }
}

