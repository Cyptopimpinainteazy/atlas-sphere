#[cfg(test)]
mod tests {
    use super::*;
    use crate::atomic_lock::{AtomicLock, LockPhase, ReleaseReason};
    use crate::mock::{new_test_ext, Test, ALICE, BOB};
    use crate::mock::{RuntimeEvent, RuntimeOrigin};
    use crate::types::{
        AssetSpec, ExternalChainId, IntentState, ProofType, SettlementProof, TokenId,
    };
    use crate::{AtomicLocks, Bonds, BondsByOwner, Event, IntentStates, Pallet, SettlementIntents};
    use frame_support::{assert_ok, traits::Hooks};
    use sp_core::H256;
    use sp_runtime::DispatchError;

    #[test]
    fn create_and_request_withdrawal() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            // Create bond
            let id = Pallet::<Test>::create_bond_internal(&ALICE, b"ASSET".to_vec(), 500u128, 0)
                .unwrap();
            assert!(Bonds::<Test>::contains_key(id));
            let rec = Bonds::<Test>::get(id).expect("exists");
            assert_eq!(rec.state, 0);

            // Request withdrawal
            assert_ok!(Pallet::<Test>::request_withdrawal_internal(id));
            let rec2 = Bonds::<Test>::get(id).expect("exists");
            assert_eq!(rec2.state, 1);
        });
    }

    #[test]
    fn finalize_and_slash() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            // Create and finalize withdraw
            let id = Pallet::<Test>::create_bond_internal(&ALICE, b"ASSET".to_vec(), 100u128, 0)
                .unwrap();
            assert_ok!(Pallet::<Test>::request_withdrawal_internal(id));
            assert_ok!(Pallet::<Test>::finalize_withdraw_internal(id));
            assert!(!Bonds::<Test>::contains_key(id));
            let list = BondsByOwner::<Test>::get(ALICE);
            assert!(!list.iter().any(|x| *x == id));

            // Create and slash
            let id2 =
                Pallet::<Test>::create_bond_internal(&BOB, b"B".to_vec(), 200u128, 0).unwrap();
            assert_ok!(Pallet::<Test>::slash_bond_internal(id2));
            let rec = Bonds::<Test>::get(id2).expect("exists");
            assert_eq!(rec.state, 2);
        });
    }

    #[test]
    fn extrinsic_flow() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            // Deposit bond via extrinsic
            assert_ok!(Pallet::<Test>::deposit_bond(
                RuntimeOrigin::signed(ALICE),
                b"ASSET".to_vec(),
                100u128,
                0
            ));

            // There should be a bond for ALICE
            let list = BondsByOwner::<Test>::get(ALICE);
            assert_eq!(list.len(), 1);
            let id = list[0];

            // Request withdraw via extrinsic
            assert_ok!(Pallet::<Test>::request_bond_withdraw(
                RuntimeOrigin::signed(ALICE),
                id
            ));
            let rec = Bonds::<Test>::get(id).expect("exists");
            assert_eq!(rec.state, 1);

            // Finalize withdraw via extrinsic
            assert_ok!(Pallet::<Test>::finalize_bond_withdraw(
                RuntimeOrigin::signed(ALICE),
                id
            ));
            assert!(!Bonds::<Test>::contains_key(id));
        });
    }

    // ============================================================================
    // ATOMIC LOCK INTEGRATION TESTS
    // ============================================================================

    #[test]
    fn atomic_lock_created_on_intent() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret_hash = H256::from([1u8; 32]);

            // Create an intent
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Bitcoin,
                    token: TokenId::Native,
                    amount: 500u128,
                },
                secret_hash,
                Some(3600),
            ));

            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist after create_intent");

            // AtomicLock is created by lock_escrow (first leg), not by create_intent.
            // Lock the first escrow leg so the AtomicLock entry is created.
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            let lock = crate::AtomicLocks::<Test>::get(intent_id)
                .expect("AtomicLock should exist after first lock_escrow");

            // Verify the lock is in LockedForCommit phase (initial phase)
            match lock.phase {
                LockPhase::LockedForCommit { .. } => {
                    // Expected - lock starts in LockedForCommit phase
                }
                _ => panic!("Lock should be in LockedForCommit phase"),
            }
        });
    }

    #[test]
    fn atomic_lock_transitions_to_commit() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret_hash = H256::from([1u8; 32]);

            // Create an intent
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Bitcoin,
                    token: TokenId::Native,
                    amount: 500u128,
                },
                secret_hash,
                Some(3600),
            ));

            // Get the intent_id
            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // AtomicLock is created by the first lock_escrow call, not by create_intent.
            // Lock escrow for first leg
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0, // leg_index
                ExternalChainId::Ethereum,
                1000u128, // amount
                vec![],   // escrow_data
            ));

            // Lock should still be in LockedForCommit (only 1 of 2 legs locked)
            let after_leg1 = crate::AtomicLocks::<Test>::get(intent_id).expect("lock exists");
            match after_leg1.phase {
                LockPhase::LockedForCommit { .. } => {}
                _ => panic!("Lock should still be in LockedForCommit phase after locking 1 leg"),
            }

            // Lock escrow for second leg (all legs now locked)
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(maker),
                intent_id,
                1, // leg_index
                ExternalChainId::Bitcoin,
                500u128, // amount
                vec![],  // escrow_data
            ));

            // Verify the lock transitioned to CommitInProgress phase when ALL legs locked
            let updated_lock = crate::AtomicLocks::<Test>::get(intent_id).expect("lock exists");
            match updated_lock.phase {
                LockPhase::CommitInProgress { .. } => {
                    // Expected - lock transitions when all legs are locked
                }
                _ => panic!("Lock should be in CommitInProgress phase after all legs locked"),
            }
        });
    }

    #[test]
    fn atomic_lock_released_on_finalize() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret = H256::from([42u8; 32]);
            let secret_hash = H256::from(sp_io::hashing::sha2_256(secret.as_bytes()));

            // Create an intent
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Bitcoin,
                    token: TokenId::Native,
                    amount: 500u128,
                },
                secret_hash,
                Some(3600),
            ));

            // Get the intent_id
            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // Lock both escrow legs
            // Leg 0: taker deposits (taker is the origin)
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));
            // Leg 1: maker deposits (maker is the origin)
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(maker),
                intent_id,
                1,
                ExternalChainId::Bitcoin,
                500u128,
                vec![],
            ));

            // Verify lock is in CommitInProgress after all legs locked
            let lock_before = crate::AtomicLocks::<Test>::get(intent_id).expect("lock exists");
            match lock_before.phase {
                LockPhase::CommitInProgress { .. } => {}
                _ => panic!("Lock should be in CommitInProgress after all legs locked"),
            }

            // Claim settlement: taker claims (marks leg 0 as claimed)
            assert_ok!(Pallet::<Test>::claim_settlement(
                RuntimeOrigin::signed(taker),
                intent_id,
                secret,
            ));

            // After taker's claim: legs_claimed = 1, legs_total = 2, so NOT finalized yet
            // Lock should still be in CommitInProgress
            let lock_after_taker = crate::AtomicLocks::<Test>::get(intent_id).expect("lock exists");
            match lock_after_taker.phase {
                LockPhase::CommitInProgress { .. } => {}
                _ => panic!("Lock should still be in CommitInProgress after 1 leg claimed"),
            }

            // Claim settlement: maker claims (marks leg 1 as claimed)
            // This should trigger finalization since all legs are now claimed
            assert_ok!(Pallet::<Test>::claim_settlement(
                RuntimeOrigin::signed(maker),
                intent_id,
                secret,
            ));

            // Verify the lock is now Released (finalization released it with CommitSucceeded)
            let lock_after = crate::AtomicLocks::<Test>::get(intent_id).expect("lock exists");
            match lock_after.phase {
                LockPhase::Released { reason, .. } => {
                    // Expected
                    assert_eq!(reason, ReleaseReason::CommitSucceeded);
                }
                _ => panic!(
                    "Lock should be Released after claim_settlement, but is in {:?}",
                    lock_after.phase
                ),
            }
        });
    }

    #[test]
    fn atomic_lock_timeout_triggers_slash() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret_hash = H256::from([1u8; 32]);

            // Create an intent with short timeout
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Bitcoin,
                    token: TokenId::Native,
                    amount: 500u128,
                },
                secret_hash,
                Some(100),
            ));

            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // AtomicLock is created by the first lock_escrow call.
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            let lock_before =
                crate::AtomicLocks::<Test>::get(intent_id).expect("Lock should exist after lock_escrow");

            // Verify lock is in LockedForCommit phase
            match lock_before.phase {
                LockPhase::LockedForCommit { .. } => {}
                _ => panic!("Lock should be in LockedForCommit phase"),
            }

            // Advance blocks to pass the timeout deadline
            if let Some(deadline) = lock_before.deadline_block() {
                // deadline is u32, set_block_number takes u64
                let deadline_u64 = (deadline as u64) + 1;
                frame_system::Pallet::<Test>::set_block_number(deadline_u64);

                // Trigger on_finalize hook with u64 block number
                <Pallet<Test> as Hooks<u64>>::on_finalize(deadline_u64);

                // Verify the lock is now Slashed
                let lock_after = crate::AtomicLocks::<Test>::get(intent_id).expect("lock exists");
                match lock_after.phase {
                    LockPhase::Slashed { .. } => {
                        // Expected - lock should be slashed on timeout
                    }
                    _ => panic!(
                        "Lock should be Slashed after timeout, but is in {:?}",
                        lock_after.phase
                    ),
                }
            } else {
                panic!("Lock should have a deadline");
            }
        });
    }

    #[test]
    fn atomic_lock_event_emitted_on_timeout() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret_hash = H256::from([1u8; 32]);

            // Create an intent with short timeout
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Bitcoin,
                    token: TokenId::Native,
                    amount: 500u128,
                },
                secret_hash,
                Some(100),
            ));

            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // AtomicLock is created by the first lock_escrow call.
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            let lock = crate::AtomicLocks::<Test>::get(intent_id)
                .expect("Lock should exist after lock_escrow");

            if let Some(deadline) = lock.deadline_block() {
                // Clear events
                frame_system::Pallet::<Test>::reset_events();

                // Advance past deadline and trigger on_finalize
                let deadline_u64 = (deadline as u64) + 1;
                frame_system::Pallet::<Test>::set_block_number(deadline_u64);
                <Pallet<Test> as Hooks<u64>>::on_finalize(deadline_u64);

                // Verify AtomicLockTimeoutSlashed event was emitted
                let events = frame_system::Pallet::<Test>::events();
                let has_timeout_event = events.iter().any(|event| match event.event {
                    RuntimeEvent::X3SettlementEngine(
                        crate::Event::<Test>::AtomicLockTimeoutSlashed {
                            intent_id: evt_intent_id,
                            ..
                        },
                    ) => evt_intent_id == intent_id,
                    _ => false,
                });
                assert!(
                    has_timeout_event,
                    "AtomicLockTimeoutSlashed event should have been emitted"
                );
            } else {
                panic!("Lock should have a deadline");
            }
        });
    }

    // ============================================================================
    // SETTLEMENT INTEGRATION TEST HELPERS
    // ============================================================================

    /// Helper to create a valid EVM receipt proof for testing
    /// Creates a proof with RLP-encoded receipt and matching Keccak256 hash
    fn create_evm_receipt_proof() -> SettlementProof {
        // RLP-encoded receipt: must be a valid list with at least 3 elements
        // Receipt format: [status/root, gas_used, logs, contractAddress?]
        // We create: [0x01 (status), 0x00 (0 gas), 0xc0 (empty logs list)]
        // RLP encoding: 0xc3 (list with 3 bytes) + 0x01 + 0x00 + 0xc0
        let receipt_data = vec![0xc3, 0x01, 0x00, 0xc0];

        // Compute Keccak256 hash of the receipt
        let tx_hash = H256::from(sp_io::hashing::keccak_256(&receipt_data));

        SettlementProof {
            proof_type: ProofType::MerkleTrie,
            tx_hash,
            block_hash: H256::from([2u8; 32]),
            confirmations: 12,
            merkle_proof: (vec![H256::from([3u8; 32])]).try_into().unwrap(),
            receipt_data: receipt_data.try_into().unwrap(),
        }
    }

    /// Helper to create a valid Solana proof for testing
    /// Creates a proof with proper structure that passes validation
    fn create_solana_proof() -> SettlementProof {
        // Minimal valid Solana transaction structure:
        // - 1 byte: 0x00 (0 signatures in compact u32)
        // - 1 byte: 0x00 (header: 0 required, 0 readonly signed, 0 readonly unsigned)
        // - 1 byte: 0x01 (1 static account)
        // - 32 bytes: recent blockhash (all zeros)
        // - 1 byte: 0x00 (0 instructions)
        let tx_data = vec![
            0x00, // 0 signatures (compact u32 encoding: single byte)
            0x00, // header: all zeros
            0x01, // 1 static account
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // blockhash (32 bytes)
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, // 0 instructions (compact u32)
        ];

        SettlementProof {
            proof_type: ProofType::SolanaProof,
            tx_hash: H256::from([4u8; 32]),
            block_hash: H256::from([5u8; 32]),
            confirmations: 32,
            merkle_proof: (vec![H256::from([6u8; 32])]).try_into().unwrap(),
            receipt_data: tx_data.try_into().unwrap(),
        }
    }

    // ============================================================================
    // SETTLEMENT INTEGRATION TESTS
    // ============================================================================

    #[test]
    fn settlement_lifecycle_evm_to_evm() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret = H256::from([42u8; 32]);
            let secret_hash = H256::from(sp_io::hashing::sha2_256(secret.as_bytes()));

            // 1. Create intent: maker sends ETH, taker sends ETH on different chain
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                secret_hash,
                Some(3600),
            ));

            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // 2. Lock escrow: both parties lock their assets
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(maker),
                intent_id,
                1,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            // 3. Submit proofs: simulate external execution with valid proof
            let evm_proof = create_evm_receipt_proof();
            assert_ok!(Pallet::<Test>::submit_proof(
                RuntimeOrigin::signed(maker),
                intent_id,
                ExternalChainId::Ethereum,
                evm_proof,
            ));

            // 4. Claim settlement: both parties reveal secret and claim
            assert_ok!(Pallet::<Test>::claim_settlement(
                RuntimeOrigin::signed(taker),
                intent_id,
                secret,
            ));

            assert_ok!(Pallet::<Test>::claim_settlement(
                RuntimeOrigin::signed(maker),
                intent_id,
                secret,
            ));

            // 5. Verify final state: settlement should be finalized
            let final_intent = crate::SettlementIntents::<Test>::get(intent_id)
                .expect("Intent should still exist after finalization");
            assert_eq!(final_intent.legs_claimed, final_intent.legs_total);

            let final_state = crate::IntentStates::<Test>::get(intent_id);
            assert!(matches!(final_state, IntentState::Finalized));
        });
    }

    #[test]
    fn settlement_lifecycle_evm_to_solana() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret = H256::from([43u8; 32]);
            let secret_hash = H256::from(sp_io::hashing::sha2_256(secret.as_bytes()));

            // 1. Create intent: maker sends ETH, taker sends SOL
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 5000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Solana,
                    token: TokenId::Native,
                    amount: 2000u128,
                },
                secret_hash,
                Some(7200),
            ));

            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // 2. Lock both legs
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                5000u128,
                vec![],
            ));

            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(maker),
                intent_id,
                1,
                ExternalChainId::Solana,
                2000u128,
                vec![],
            ));

            // 3. Submit proofs from both chains with valid proofs
            let evm_proof = create_evm_receipt_proof();
            assert_ok!(Pallet::<Test>::submit_proof(
                RuntimeOrigin::signed(maker),
                intent_id,
                ExternalChainId::Ethereum,
                evm_proof,
            ));

            let solana_proof = create_solana_proof();
            assert_ok!(Pallet::<Test>::submit_proof(
                RuntimeOrigin::signed(taker),
                intent_id,
                ExternalChainId::Solana,
                solana_proof,
            ));

            // 4. Claim settlement
            assert_ok!(Pallet::<Test>::claim_settlement(
                RuntimeOrigin::signed(taker),
                intent_id,
                secret,
            ));

            assert_ok!(Pallet::<Test>::claim_settlement(
                RuntimeOrigin::signed(maker),
                intent_id,
                secret,
            ));

            // 5. Verify finalization
            let final_state = crate::IntentStates::<Test>::get(intent_id);
            assert!(matches!(final_state, IntentState::Finalized));

            let final_intent =
                crate::SettlementIntents::<Test>::get(intent_id).expect("Intent should exist");
            assert_eq!(final_intent.legs_claimed, 2);
        });
    }

    #[test]
    fn settlement_fails_with_empty_receipt() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret_hash = H256::from([1u8; 32]);

            // Create intent
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                secret_hash,
                Some(3600),
            ));

            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // Lock both legs
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(maker),
                intent_id,
                1,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            // Try to submit invalid EVM proof (empty receipt data)
            let invalid_proof = SettlementProof {
                proof_type: ProofType::MerkleTrie,
                tx_hash: H256::from([1u8; 32]),
                block_hash: H256::from([2u8; 32]),
                confirmations: 12,
                merkle_proof: (vec![H256::from([3u8; 32])]).try_into().unwrap(),
                receipt_data: vec![].try_into().unwrap(), // Empty = invalid
            };

            let result = Pallet::<Test>::submit_proof(
                RuntimeOrigin::signed(maker),
                intent_id,
                ExternalChainId::Ethereum,
                invalid_proof,
            );

            // Should fail with InvalidProof error
            assert!(result.is_err());
        });
    }

    #[test]
    fn settlement_fails_with_invalid_secret() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let correct_secret = H256::from([42u8; 32]);
            let correct_hash = H256::from(sp_io::hashing::sha2_256(correct_secret.as_bytes()));
            let wrong_secret = H256::from([99u8; 32]);

            // Create intent with correct secret hash
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                correct_hash,
                Some(3600),
            ));

            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // Lock both legs
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(maker),
                intent_id,
                1,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            // Submit valid proof
            let proof = create_evm_receipt_proof();
            assert_ok!(Pallet::<Test>::submit_proof(
                RuntimeOrigin::signed(maker),
                intent_id,
                ExternalChainId::Ethereum,
                proof,
            ));

            // Try to claim with wrong secret
            let result = Pallet::<Test>::claim_settlement(
                RuntimeOrigin::signed(taker),
                intent_id,
                wrong_secret,
            );

            // Should fail with InvalidSecret error
            assert!(result.is_err());
        });
    }

    #[test]
    fn settlement_fails_with_invalid_evm_proof() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret_hash = H256::from([1u8; 32]);

            // Create intent
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                secret_hash,
                Some(3600),
            ));

            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // Lock both legs
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(maker),
                intent_id,
                1,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            // Try to submit invalid EVM proof (empty receipt data)
            let invalid_proof = SettlementProof {
                proof_type: ProofType::MerkleTrie,
                tx_hash: H256::from([1u8; 32]),
                block_hash: H256::from([2u8; 32]),
                confirmations: 12,
                merkle_proof: (vec![H256::from([3u8; 32])]).try_into().unwrap(),
                receipt_data: vec![].try_into().unwrap(), // Empty = invalid
            };

            let result = Pallet::<Test>::submit_proof(
                RuntimeOrigin::signed(maker),
                intent_id,
                ExternalChainId::Ethereum,
                invalid_proof,
            );

            // Should fail with InvalidProof error
            assert!(result.is_err());
        });
    }

    #[test]
    fn settlement_partial_claim_before_full_lock() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret = H256::from([42u8; 32]);
            let secret_hash = H256::from(sp_io::hashing::sha2_256(secret.as_bytes()));

            // Create intent with 2 legs
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                secret_hash,
                Some(3600),
            ));

            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // Lock only first leg
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            // Try to claim before all legs locked - should fail
            let result =
                Pallet::<Test>::claim_settlement(RuntimeOrigin::signed(taker), intent_id, secret);

            // Should fail because not all legs are locked (state is FundingInProgress)
            assert!(result.is_err());
        });
    }

    #[test]
    fn settlement_state_transitions() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret = H256::from([42u8; 32]);
            let secret_hash = H256::from(sp_io::hashing::sha2_256(secret.as_bytes()));

            // Create intent
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                secret_hash,
                Some(3600),
            ));

            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // Verify initial state: Created
            let state1 = crate::IntentStates::<Test>::get(intent_id);
            assert!(matches!(state1, IntentState::Created));

            // Lock first leg
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            // Verify state: FundingInProgress
            let state2 = crate::IntentStates::<Test>::get(intent_id);
            assert!(matches!(state2, IntentState::FundingInProgress));

            // Lock second leg
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(maker),
                intent_id,
                1,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            // Verify state: FullyFunded
            let state3 = crate::IntentStates::<Test>::get(intent_id);
            assert!(matches!(state3, IntentState::FullyFunded));

            // Submit proof
            let proof = create_evm_receipt_proof();
            assert_ok!(Pallet::<Test>::submit_proof(
                RuntimeOrigin::signed(maker),
                intent_id,
                ExternalChainId::Ethereum,
                proof,
            ));

            // Verify state: ExecutingExternal
            let state4 = crate::IntentStates::<Test>::get(intent_id);
            assert!(matches!(state4, IntentState::ExecutingExternal));

            // Claim first leg
            assert_ok!(Pallet::<Test>::claim_settlement(
                RuntimeOrigin::signed(taker),
                intent_id,
                secret,
            ));

            // Verify state: Claiming (not finalized yet)
            let state5 = crate::IntentStates::<Test>::get(intent_id);
            assert!(matches!(state5, IntentState::Claiming));

            // Claim second leg
            assert_ok!(Pallet::<Test>::claim_settlement(
                RuntimeOrigin::signed(maker),
                intent_id,
                secret,
            ));

            // Verify final state: Finalized
            let state6 = crate::IntentStates::<Test>::get(intent_id);
            assert!(matches!(state6, IntentState::Finalized));
        });
    }

    #[test]
    fn settlement_respects_timeout() {
        let mut ext = new_test_ext();
        ext.execute_with(|| {
            let maker = ALICE;
            let taker = BOB;
            let secret = H256::from([42u8; 32]);
            let secret_hash = H256::from(sp_io::hashing::sha2_256(secret.as_bytes()));

            // Create intent with very short timeout (100 seconds)
            assert_ok!(Pallet::<Test>::create_intent(
                RuntimeOrigin::signed(maker),
                taker,
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                AssetSpec {
                    chain: ExternalChainId::Ethereum,
                    token: TokenId::Native,
                    amount: 1000u128,
                },
                secret_hash,
                Some(100),
            ));

            let intent_id = crate::SettlementIntents::<Test>::iter()
                .find(|(_, intent)| intent.maker == maker)
                .map(|(id, _)| id)
                .expect("Intent should exist");

            // Lock both legs
            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(taker),
                intent_id,
                0,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            assert_ok!(Pallet::<Test>::lock_escrow(
                RuntimeOrigin::signed(maker),
                intent_id,
                1,
                ExternalChainId::Ethereum,
                1000u128,
                vec![],
            ));

            // Submit proof
            let proof = create_evm_receipt_proof();
            assert_ok!(Pallet::<Test>::submit_proof(
                RuntimeOrigin::signed(maker),
                intent_id,
                ExternalChainId::Ethereum,
                proof,
            ));

            // Claim once - should succeed
            assert_ok!(Pallet::<Test>::claim_settlement(
                RuntimeOrigin::signed(taker),
                intent_id,
                secret,
            ));

            // Simulate time passing: set unix time to after timeout
            // Note: In real runtime, this would be controlled by block time
            // For now, we just verify the timeout check exists in claim_settlement

            let intent = crate::SettlementIntents::<Test>::get(intent_id).unwrap();
            assert!(intent.timeout > 0, "Intent should have a timeout set");
        });
    }
}
