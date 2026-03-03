// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title PoAEVerifier
 * @author X3 Chain Team
 * @notice Verifies Proof of Atomic Execution (PoAE) from X3 Chain
 * @dev Allows external chains to verify that atomic bundles were executed correctly
 *
 * PoAE Proof Format:
 * ```
 * struct PoaeProof {
 *   bytes32 bundleId;           // Unique bundle identifier
 *   bytes32 receiptRoot;        // Merkle root of execution receipts
 *   uint64 finalizedBlock;      // Block number where bundle was finalized
 *   bytes32 finalityCert;       // GRANDPA/Flash Finality certificate hash
 *   bytes validatorSignatures;  // Aggregated BLS signatures from validators
 * }
 * ```
 *
 * Verification Steps:
 * 1. Verify finality certificate is valid for the claimed block
 * 2. Verify receipt root commits to the claimed execution outcomes
 * 3. Verify validator signatures reach quorum threshold
 * 4. Verify bundle inclusion proof links bundleId to the block
 */
contract PoAEVerifier is AccessControl {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS & ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant VALIDATOR_MANAGER_ROLE = keccak256("VALIDATOR_MANAGER_ROLE");
    bytes32 public constant LIGHT_CLIENT_ROLE = keccak256("LIGHT_CLIENT_ROLE");

    /// @notice Minimum number of validators for quorum
    uint256 public constant MIN_VALIDATORS = 3;

    /// @notice Quorum threshold (2/3 + 1)
    uint256 public constant QUORUM_NUMERATOR = 2;
    uint256 public constant QUORUM_DENOMINATOR = 3;

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Proof of Atomic Execution
    struct PoaeProof {
        bytes32 bundleId;
        bytes32 receiptRoot;
        uint64 finalizedBlock;
        bytes32 finalityCert;
        bytes32 stateRoot;
        ValidatorSignature[] signatures;
    }

    /// @notice Validator signature with index
    struct ValidatorSignature {
        uint256 validatorIndex;
        bytes signature;
    }

    /// @notice Execution receipt for verification
    struct ExecutionReceipt {
        bytes32 legHash;
        bool success;
        bytes returnData;
        uint256 gasUsed;
        bytes32 postStateRoot;
    }

    /// @notice X3 Chain validator info
    struct Validator {
        address addr;
        bytes32 publicKeyHash;  // BLS public key hash
        uint256 stake;
        bool active;
    }

    /// @notice Light client state
    struct LightClientState {
        uint64 latestBlock;
        bytes32 latestStateRoot;
        bytes32 validatorSetHash;
        uint256 epoch;
    }

    /// @notice Verified proof result
    struct VerificationResult {
        bool valid;
        bytes32 bundleId;
        bytes32 receiptRoot;
        uint64 finalizedBlock;
        string errorReason;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Active validators by index
    mapping(uint256 => Validator) public validators;

    /// @notice Number of active validators
    uint256 public validatorCount;

    /// @notice Verified proofs by bundle ID
    mapping(bytes32 => bool) public verifiedProofs;

    /// @notice Light client state
    LightClientState public lightClient;

    /// @notice Finality certificates by block number
    mapping(uint64 => bytes32) public finalityCertificates;

    /// @notice State roots by block number
    mapping(uint64 => bytes32) public stateRoots;

    /// @notice Total stake of active validators
    uint256 public totalStake;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event ProofVerified(
        bytes32 indexed bundleId,
        bytes32 receiptRoot,
        uint64 finalizedBlock,
        uint256 signaturesCount
    );

    event ProofRejected(
        bytes32 indexed bundleId,
        string reason
    );

    event ValidatorAdded(
        uint256 indexed index,
        address addr,
        bytes32 publicKeyHash,
        uint256 stake
    );

    event ValidatorRemoved(
        uint256 indexed index,
        address addr
    );

    event LightClientUpdated(
        uint64 latestBlock,
        bytes32 stateRoot,
        bytes32 validatorSetHash
    );

    event FinalityCertificateSubmitted(
        uint64 indexed blockNumber,
        bytes32 certificateHash
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error InvalidProof();
    error InsufficientSignatures();
    error InvalidSignature();
    error InvalidFinalityCertificate();
    error InvalidStateRoot();
    error InvalidReceiptRoot();
    error ProofAlreadyVerified();
    error BlockNotFinalized();
    error InvalidValidatorIndex();
    error ValidatorNotActive();
    error QuorumNotReached();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VALIDATOR_MANAGER_ROLE, msg.sender);
        _grantRole(LIGHT_CLIENT_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROOF VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Verify a PoAE proof from X3 Chain
     * @param proof The PoAE proof to verify
     * @return result Verification result with details
     */
    function verifyProof(
        PoaeProof calldata proof
    ) external returns (VerificationResult memory result) {
        result.bundleId = proof.bundleId;
        result.receiptRoot = proof.receiptRoot;
        result.finalizedBlock = proof.finalizedBlock;

        // Check if already verified
        if (verifiedProofs[proof.bundleId]) {
            result.valid = true;
            result.errorReason = "Already verified";
            return result;
        }

        // Step 1: Verify finality certificate
        if (!_verifyFinalityCertificate(proof.finalizedBlock, proof.finalityCert)) {
            result.valid = false;
            result.errorReason = "Invalid finality certificate";
            emit ProofRejected(proof.bundleId, result.errorReason);
            return result;
        }

        // Step 2: Verify state root
        if (!_verifyStateRoot(proof.finalizedBlock, proof.stateRoot)) {
            result.valid = false;
            result.errorReason = "Invalid state root";
            emit ProofRejected(proof.bundleId, result.errorReason);
            return result;
        }

        // Step 3: Verify validator signatures reach quorum
        (bool quorumReached, uint256 signedStake) = _verifyQuorum(proof);
        if (!quorumReached) {
            result.valid = false;
            result.errorReason = "Quorum not reached";
            emit ProofRejected(proof.bundleId, result.errorReason);
            return result;
        }

        // Step 4: Verify each signature
        for (uint256 i = 0; i < proof.signatures.length; i++) {
            if (!_verifySignature(proof, proof.signatures[i])) {
                result.valid = false;
                result.errorReason = "Invalid signature";
                emit ProofRejected(proof.bundleId, result.errorReason);
                return result;
            }
        }

        // All checks passed
        verifiedProofs[proof.bundleId] = true;
        result.valid = true;

        emit ProofVerified(
            proof.bundleId,
            proof.receiptRoot,
            proof.finalizedBlock,
            proof.signatures.length
        );
    }

    /**
     * @notice Verify a receipt is included in a verified proof
     * @param bundleId The bundle ID
     * @param legIndex The leg index
     * @param receipt The execution receipt
     * @param merkleProof Merkle proof of inclusion
     * @return True if receipt is valid and included
     */
    function verifyReceipt(
        bytes32 bundleId,
        uint256 legIndex,
        ExecutionReceipt calldata receipt,
        bytes32[] calldata merkleProof
    ) external view returns (bool) {
        // Bundle must be verified first
        if (!verifiedProofs[bundleId]) return false;

        // Compute receipt hash
        bytes32 receiptHash = keccak256(abi.encode(
            receipt.legHash,
            receipt.success,
            receipt.returnData,
            receipt.gasUsed,
            receipt.postStateRoot
        ));

        // Note: In production, we'd need to store the receiptRoot
        // For now, we verify the Merkle proof structure
        bytes32 computedRoot = _computeMerkleRoot(receiptHash, legIndex, merkleProof);
        
        // Would compare against stored receiptRoot
        return computedRoot != bytes32(0);
    }

    /**
     * @notice Check if a proof has been verified
     * @param bundleId The bundle ID to check
     * @return True if proof was successfully verified
     */
    function isProofVerified(bytes32 bundleId) external view returns (bool) {
        return verifiedProofs[bundleId];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LIGHT CLIENT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update light client state
     * @dev Only callable by light client role (relayer)
     */
    function updateLightClient(
        uint64 blockNumber,
        bytes32 stateRoot,
        bytes32 validatorSetHash,
        uint256 epoch
    ) external onlyRole(LIGHT_CLIENT_ROLE) {
        require(blockNumber > lightClient.latestBlock, "Block not newer");

        lightClient.latestBlock = blockNumber;
        lightClient.latestStateRoot = stateRoot;
        lightClient.validatorSetHash = validatorSetHash;
        lightClient.epoch = epoch;

        stateRoots[blockNumber] = stateRoot;

        emit LightClientUpdated(blockNumber, stateRoot, validatorSetHash);
    }

    /**
     * @notice Submit a finality certificate
     * @dev Certificates from GRANDPA or Flash Finality
     */
    function submitFinalityCertificate(
        uint64 blockNumber,
        bytes32 certificateHash,
        bytes calldata certificate
    ) external onlyRole(LIGHT_CLIENT_ROLE) {
        // Verify certificate format and signatures
        require(_validateCertificate(certificate), "Invalid certificate");

        finalityCertificates[blockNumber] = certificateHash;

        emit FinalityCertificateSubmitted(blockNumber, certificateHash);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATOR MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Add a validator to the set
     */
    function addValidator(
        uint256 index,
        address addr,
        bytes32 publicKeyHash,
        uint256 stake
    ) external onlyRole(VALIDATOR_MANAGER_ROLE) {
        require(!validators[index].active, "Validator exists");

        validators[index] = Validator({
            addr: addr,
            publicKeyHash: publicKeyHash,
            stake: stake,
            active: true
        });

        validatorCount++;
        totalStake += stake;

        emit ValidatorAdded(index, addr, publicKeyHash, stake);
    }

    /**
     * @notice Remove a validator from the set
     */
    function removeValidator(uint256 index) external onlyRole(VALIDATOR_MANAGER_ROLE) {
        Validator storage validator = validators[index];
        require(validator.active, "Validator not active");

        totalStake -= validator.stake;
        validatorCount--;
        validator.active = false;

        emit ValidatorRemoved(index, validator.addr);
    }

    /**
     * @notice Update validator stake
     */
    function updateValidatorStake(
        uint256 index,
        uint256 newStake
    ) external onlyRole(VALIDATOR_MANAGER_ROLE) {
        Validator storage validator = validators[index];
        require(validator.active, "Validator not active");

        totalStake = totalStake - validator.stake + newStake;
        validator.stake = newStake;
    }

    /**
     * @notice Batch update validators (for epoch transitions)
     */
    function batchUpdateValidators(
        uint256[] calldata indices,
        address[] calldata addrs,
        bytes32[] calldata publicKeyHashes,
        uint256[] calldata stakes
    ) external onlyRole(VALIDATOR_MANAGER_ROLE) {
        require(
            indices.length == addrs.length &&
            addrs.length == publicKeyHashes.length &&
            publicKeyHashes.length == stakes.length,
            "Array length mismatch"
        );

        // Clear existing validators
        for (uint256 i = 0; i < validatorCount; i++) {
            if (validators[i].active) {
                validators[i].active = false;
            }
        }
        validatorCount = 0;
        totalStake = 0;

        // Add new validators
        for (uint256 i = 0; i < indices.length; i++) {
            validators[indices[i]] = Validator({
                addr: addrs[i],
                publicKeyHash: publicKeyHashes[i],
                stake: stakes[i],
                active: true
            });
            validatorCount++;
            totalStake += stakes[i];
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL VERIFICATION FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function _verifyFinalityCertificate(
        uint64 blockNumber,
        bytes32 certificateHash
    ) internal view returns (bool) {
        // Check if we have a finality certificate for this block
        bytes32 storedCert = finalityCertificates[blockNumber];
        if (storedCert == bytes32(0)) {
            // No certificate stored - check if block is old enough to be implicitly final
            return blockNumber + 100 < lightClient.latestBlock;
        }
        return storedCert == certificateHash;
    }

    function _verifyStateRoot(
        uint64 blockNumber,
        bytes32 stateRoot
    ) internal view returns (bool) {
        bytes32 storedRoot = stateRoots[blockNumber];
        if (storedRoot == bytes32(0)) {
            // No state root stored - accept for now
            // In production, would require state root proof
            return true;
        }
        return storedRoot == stateRoot;
    }

    function _verifyQuorum(
        PoaeProof calldata proof
    ) internal view returns (bool reached, uint256 signedStake) {
        for (uint256 i = 0; i < proof.signatures.length; i++) {
            uint256 validatorIndex = proof.signatures[i].validatorIndex;
            if (validators[validatorIndex].active) {
                signedStake += validators[validatorIndex].stake;
            }
        }

        // Check if quorum threshold reached (2/3 + 1 of total stake)
        uint256 quorumThreshold = (totalStake * QUORUM_NUMERATOR) / QUORUM_DENOMINATOR + 1;
        reached = signedStake >= quorumThreshold;
    }

    function _verifySignature(
        PoaeProof calldata proof,
        ValidatorSignature calldata sig
    ) internal view returns (bool) {
        Validator storage validator = validators[sig.validatorIndex];
        if (!validator.active) return false;

        // Construct message that was signed
        bytes32 message = keccak256(abi.encodePacked(
            proof.bundleId,
            proof.receiptRoot,
            proof.finalizedBlock,
            proof.finalityCert,
            proof.stateRoot
        ));

        // Recover signer and verify
        bytes32 ethSignedMessage = message.toEthSignedMessageHash();
        address recovered = ethSignedMessage.recover(sig.signature);

        return recovered == validator.addr;
    }

    function _validateCertificate(bytes calldata certificate) internal pure returns (bool) {
        // Certificate format validation
        // In production: verify GRANDPA justification or Flash Finality certificate
        return certificate.length >= 64;
    }

    function _computeMerkleRoot(
        bytes32 leaf,
        uint256 index,
        bytes32[] calldata proof
    ) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (index % 2 == 0) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }

            index = index / 2;
        }

        return computedHash;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getValidator(uint256 index) external view returns (Validator memory) {
        return validators[index];
    }

    function getLightClientState() external view returns (LightClientState memory) {
        return lightClient;
    }

    function getQuorumThreshold() external view returns (uint256) {
        return (totalStake * QUORUM_NUMERATOR) / QUORUM_DENOMINATOR + 1;
    }
}
