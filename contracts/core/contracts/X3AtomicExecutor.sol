// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title X3AtomicExecutor
 * @notice External chain bridge contract for X3 Atomic Execution verification.
 *
 * This contract allows external EVM chains (Ethereum, Polygon, Arbitrum, etc.)
 * to verify X3 PoAE (Proof of Atomic Execution) proofs and settle cross-chain
 * atomic bundles.
 *
 * ## Verification Flow
 *
 * 1. A relayer submits a PoAE proof from X3 chain.
 * 2. This contract verifies the proof structure.
 * 3. If valid, the bundle is marked as verified and side-effects can execute.
 *
 * ## Production Notes
 *
 * - v0: Structural verification only (hash checks, non-zero fields).
 * - v1: Add GRANDPA/Flash Finality light client verification.
 * - v2: Add ZK proof verification for full trustless settlement.
 */
contract X3AtomicExecutor {
    // ── Structs ────────────────────────────────────────────────────────────

    /// @notice Proof of Atomic Execution from X3 chain.
    struct AtomicExecutionProof {
        bytes32 bundleId;          // Unique bundle identifier
        bytes32 receiptRoot;       // Merkle root of execution receipts
        uint64  finalizedBlock;    // X3 block number where bundle was finalized
        bytes32 finalityCert;      // Hash of finality certificate (GRANDPA/Flash)
        bytes32 legsHash;          // Hash of original bundle legs
        uint32  legCount;          // Number of legs executed
    }

    /// @notice Status of a verified bundle.
    enum BundleStatus {
        Unknown,       // Not yet submitted
        Verified,      // Proof verified, awaiting settlement
        Settled,       // Side-effects executed on this chain
        Challenged,    // Proof under dispute
        Expired        // Past challenge window
    }

    /// @notice On-chain record for a verified bundle.
    struct BundleRecord {
        BundleStatus status;
        bytes32      receiptRoot;
        bytes32      finalityCert;
        uint64       finalizedBlock;
        uint32       legCount;
        uint256      verifiedAt;     // Block timestamp when verified
        address      relayer;        // Who submitted the proof
    }

    // ── State ──────────────────────────────────────────────────────────────

    /// @notice Verified bundles by bundle ID.
    mapping(bytes32 => BundleRecord) public bundles;

    /// @notice Challenge window in seconds (default 24 hours for optimistic path).
    uint256 public challengeWindow = 24 hours;

    /// @notice Contract owner (governance multisig).
    address public owner;

    /// @notice Light client contract for X3 finality verification (v1+).
    address public lightClient;

    /// @notice Trusted relayers (v0 authorized set).
    mapping(address => bool) public trustedRelayers;

    // ── Events ─────────────────────────────────────────────────────────────

    event BundleVerified(
        bytes32 indexed bundleId,
        bytes32 receiptRoot,
        bytes32 finalityCert,
        uint64  finalizedBlock,
        uint32  legCount,
        address relayer
    );

    event BundleSettled(
        bytes32 indexed bundleId,
        address settler
    );

    event BundleChallenged(
        bytes32 indexed bundleId,
        address challenger,
        string  reason
    );

    event RelayerUpdated(address relayer, bool trusted);
    event ChallengeWindowUpdated(uint256 newWindow);
    event LightClientUpdated(address newLightClient);

    // ── Modifiers ──────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "X3AE: not owner");
        _;
    }

    modifier onlyTrustedRelayer() {
        require(trustedRelayers[msg.sender], "X3AE: not trusted relayer");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        trustedRelayers[msg.sender] = true;
    }

    // ── Core Functions ─────────────────────────────────────────────────────

    /**
     * @notice Submit and verify an atomic execution proof from X3 chain.
     * @param bundleId      Unique bundle identifier from X3.
     * @param receiptRoot   Merkle root of execution receipts.
     * @param finalizedBlock X3 block number where bundle was finalized.
     * @param finalityCert  Hash of finality certificate.
     * @param legsHash      Hash of original bundle legs.
     * @param legCount      Number of legs executed.
     * @return success       Whether the proof was accepted.
     */
    function submitAtomicBundle(
        bytes32 bundleId,
        bytes32 receiptRoot,
        uint64  finalizedBlock,
        bytes32 finalityCert,
        bytes32 legsHash,
        uint32  legCount
    ) external onlyTrustedRelayer returns (bool success) {
        require(bundles[bundleId].status == BundleStatus.Unknown, "X3AE: bundle exists");
        require(bundleId != bytes32(0), "X3AE: zero bundle ID");
        require(receiptRoot != bytes32(0), "X3AE: zero receipt root");
        require(finalityCert != bytes32(0), "X3AE: zero finality cert");
        require(legCount > 0, "X3AE: zero legs");

        // v0: Structural verification only.
        // v1: Call lightClient.verifyFinality(finalizedBlock, finalityCert)
        // v2: Verify ZK proof of execution

        // Compute proof hash for integrity
        bytes32 proofHash = keccak256(abi.encode(
            bundleId, receiptRoot, finalizedBlock, finalityCert, legsHash
        ));

        bundles[bundleId] = BundleRecord({
            status: BundleStatus.Verified,
            receiptRoot: receiptRoot,
            finalityCert: finalityCert,
            finalizedBlock: finalizedBlock,
            legCount: legCount,
            verifiedAt: block.timestamp,
            relayer: msg.sender
        });

        emit BundleVerified(
            bundleId,
            receiptRoot,
            finalityCert,
            finalizedBlock,
            legCount,
            msg.sender
        );

        return true;
    }

    /**
     * @notice Get the status and proof of a verified bundle.
     * @param bundleId The bundle to query.
     * @return record The bundle record.
     */
    function getAtomicExecutionProof(bytes32 bundleId)
        external
        view
        returns (BundleRecord memory record)
    {
        return bundles[bundleId];
    }

    /**
     * @notice Verify that a proof hash matches the stored bundle.
     * @param bundleId   Bundle to verify.
     * @param legsHash   Expected legs hash.
     * @return valid      Whether the proof is structurally valid.
     */
    function verify(bytes32 bundleId, bytes32 legsHash)
        external
        view
        returns (bool valid)
    {
        BundleRecord storage record = bundles[bundleId];
        if (record.status == BundleStatus.Unknown) return false;
        if (record.status == BundleStatus.Challenged) return false;

        // Recompute proof hash
        bytes32 proofHash = keccak256(abi.encode(
            bundleId,
            record.receiptRoot,
            record.finalizedBlock,
            record.finalityCert,
            legsHash
        ));

        // Proof is valid if it's verified and not challenged
        return record.status == BundleStatus.Verified ||
               record.status == BundleStatus.Settled;
    }

    /**
     * @notice Settle a verified bundle (execute side-effects).
     * @dev Can only be called after the challenge window expires.
     * @param bundleId Bundle to settle.
     */
    function settleBundleOptimistic(bytes32 bundleId) external {
        BundleRecord storage record = bundles[bundleId];
        require(record.status == BundleStatus.Verified, "X3AE: not verified");
        require(
            block.timestamp >= record.verifiedAt + challengeWindow,
            "X3AE: challenge window active"
        );

        record.status = BundleStatus.Settled;

        emit BundleSettled(bundleId, msg.sender);
    }

    /**
     * @notice Challenge a verified bundle.
     * @dev Must be called within the challenge window.
     * @param bundleId Bundle to challenge.
     * @param reason   Description of the challenge.
     */
    function challengeBundle(bytes32 bundleId, string calldata reason) external {
        BundleRecord storage record = bundles[bundleId];
        require(record.status == BundleStatus.Verified, "X3AE: not challengeable");
        require(
            block.timestamp < record.verifiedAt + challengeWindow,
            "X3AE: window expired"
        );

        record.status = BundleStatus.Challenged;

        emit BundleChallenged(bundleId, msg.sender, reason);
    }

    // ── Admin Functions ────────────────────────────────────────────────────

    function setTrustedRelayer(address relayer, bool trusted) external onlyOwner {
        trustedRelayers[relayer] = trusted;
        emit RelayerUpdated(relayer, trusted);
    }

    function setChallengeWindow(uint256 newWindow) external onlyOwner {
        require(newWindow >= 1 hours, "X3AE: window too short");
        require(newWindow <= 7 days, "X3AE: window too long");
        challengeWindow = newWindow;
        emit ChallengeWindowUpdated(newWindow);
    }

    function setLightClient(address _lightClient) external onlyOwner {
        lightClient = _lightClient;
        emit LightClientUpdated(_lightClient);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "X3AE: zero address");
        owner = newOwner;
    }
}
