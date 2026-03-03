// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CrossChainMessageRouter
 * @author X3 Chain Team
 * @notice Routes messages between chains and VMs in the X3 ecosystem
 * @dev Implements a general messaging protocol for cross-chain communication
 *
 * Message Flow:
 * ```
 * Source Chain                     X3 Chain                      Dest Chain
 *     |                               |                               |
 *     |-- sendMessage() ---------->   |                               |
 *     |                               |-- relayMessage() -->          |
 *     |                               |                               |-- executeMessage()
 *     |                               |                               |
 *     |                               |<-- acknowledgement -----------|
 *     |<-- confirmDelivery -----------|                               |
 * ```
 */
contract CrossChainMessageRouter is AccessControl, ReentrancyGuard, Pausable {

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS & ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    /// @notice Maximum message data size (64KB)
    uint256 public constant MAX_MESSAGE_SIZE = 65536;

    /// @notice Maximum gas for message execution
    uint256 public constant MAX_GAS_LIMIT = 5_000_000;

    /// @notice Message expiry time (24 hours)
    uint256 public constant MESSAGE_EXPIRY = 24 hours;

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Supported chain identifiers
    enum ChainId {
        X3_MAINNET,        // 0
        X3_TESTNET,        // 1
        ETHEREUM,          // 2
        POLYGON,           // 3
        ARBITRUM,          // 4
        OPTIMISM,          // 5
        BASE,              // 6
        SOLANA,            // 7
        AVALANCHE,         // 8
        BSC                // 9
    }

    /// @notice Message status
    enum MessageStatus {
        Pending,           // 0 - Sent, awaiting relay
        Relayed,           // 1 - Relayed to destination
        Executed,          // 2 - Successfully executed
        Failed,            // 3 - Execution failed
        Expired,           // 4 - Message expired
        Refunded           // 5 - Fees refunded
    }

    /// @notice Cross-chain message structure
    struct Message {
        bytes32 id;
        ChainId sourceChain;
        ChainId destChain;
        address sender;
        bytes32 receiver;          // 32 bytes to support all address formats
        bytes data;
        uint256 value;
        uint256 gasLimit;
        uint256 fee;
        uint256 nonce;
        uint256 timestamp;
        MessageStatus status;
    }

    /// @notice Message receipt from destination
    struct MessageReceipt {
        bytes32 messageId;
        bool success;
        bytes returnData;
        uint256 gasUsed;
        bytes32 txHash;
    }

    /// @notice Chain configuration
    struct ChainConfig {
        bool enabled;
        uint256 gasPrice;          // Base gas price estimate
        uint256 baseFee;           // Base fee for messages
        uint256 feeMultiplier;     // Fee multiplier (basis points)
        address adapter;           // Chain-specific adapter contract
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice All messages by ID
    mapping(bytes32 => Message) public messages;

    /// @notice Message receipts by message ID
    mapping(bytes32 => MessageReceipt) public receipts;

    /// @notice Chain configurations
    mapping(ChainId => ChainConfig) public chainConfigs;

    /// @notice User nonces for replay protection
    mapping(address => uint256) public nonces;

    /// @notice Pending messages by destination chain
    mapping(ChainId => bytes32[]) public pendingMessages;

    /// @notice Total fees collected
    uint256 public totalFeesCollected;

    /// @notice Fee treasury address
    address public feeTreasury;

    /// @notice Message counter
    uint256 private _messageCount;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event MessageSent(
        bytes32 indexed messageId,
        ChainId indexed sourceChain,
        ChainId indexed destChain,
        address sender,
        bytes32 receiver,
        uint256 value,
        uint256 fee
    );

    event MessageRelayed(
        bytes32 indexed messageId,
        ChainId destChain,
        address relayer
    );

    event MessageExecuted(
        bytes32 indexed messageId,
        bool success,
        bytes returnData,
        uint256 gasUsed
    );

    event MessageFailed(
        bytes32 indexed messageId,
        string reason
    );

    event MessageExpired(
        bytes32 indexed messageId
    );

    event FeeRefunded(
        bytes32 indexed messageId,
        address indexed sender,
        uint256 amount
    );

    event ChainConfigUpdated(
        ChainId indexed chainId,
        bool enabled,
        uint256 baseFee
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error ChainNotEnabled();
    error MessageTooLarge();
    error InsufficientFee();
    error InvalidGasLimit();
    error MessageNotFound();
    error MessageAlreadyProcessed();
    error MessageExpiredError();
    error InvalidReceiver();
    error RelayFailed();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(address _feeTreasury) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);
        _grantRole(FEE_MANAGER_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);

        feeTreasury = _feeTreasury;

        // Initialize X3 Chain configs
        chainConfigs[ChainId.X3_MAINNET] = ChainConfig({
            enabled: true,
            gasPrice: 1 gwei,
            baseFee: 0.001 ether,
            feeMultiplier: 10000, // 100%
            adapter: address(0)
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MESSAGE SENDING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Send a cross-chain message
     * @param destChain Destination chain
     * @param receiver Receiver address (32 bytes)
     * @param data Message data
     * @param gasLimit Gas limit for execution
     * @return messageId Unique message identifier
     */
    function sendMessage(
        ChainId destChain,
        bytes32 receiver,
        bytes calldata data,
        uint256 gasLimit
    ) external payable nonReentrant whenNotPaused returns (bytes32 messageId) {
        // Validations
        ChainConfig storage config = chainConfigs[destChain];
        if (!config.enabled) revert ChainNotEnabled();
        if (data.length > MAX_MESSAGE_SIZE) revert MessageTooLarge();
        if (gasLimit == 0 || gasLimit > MAX_GAS_LIMIT) revert InvalidGasLimit();
        if (receiver == bytes32(0)) revert InvalidReceiver();

        // Calculate fee
        uint256 fee = calculateFee(destChain, gasLimit, data.length);
        if (msg.value < fee) revert InsufficientFee();

        // Generate message ID
        uint256 nonce = nonces[msg.sender]++;
        _messageCount++;
        
        messageId = keccak256(abi.encodePacked(
            msg.sender,
            destChain,
            receiver,
            nonce,
            block.chainid,
            _messageCount
        ));

        // Create message
        messages[messageId] = Message({
            id: messageId,
            sourceChain: ChainId.X3_MAINNET, // Assuming deployment on X3
            destChain: destChain,
            sender: msg.sender,
            receiver: receiver,
            data: data,
            value: msg.value - fee,
            gasLimit: gasLimit,
            fee: fee,
            nonce: nonce,
            timestamp: block.timestamp,
            status: MessageStatus.Pending
        });

        // Add to pending queue
        pendingMessages[destChain].push(messageId);

        // Collect fee
        totalFeesCollected += fee;

        emit MessageSent(
            messageId,
            ChainId.X3_MAINNET,
            destChain,
            msg.sender,
            receiver,
            msg.value - fee,
            fee
        );

        // Refund excess
        if (msg.value > fee) {
            // Value is passed with message
        }
    }

    /**
     * @notice Send message to EVM chain with address
     */
    function sendMessageToEVM(
        ChainId destChain,
        address receiver,
        bytes calldata data,
        uint256 gasLimit
    ) external payable returns (bytes32) {
        return this.sendMessage{value: msg.value}(
            destChain,
            bytes32(uint256(uint160(receiver))),
            data,
            gasLimit
        );
    }

    /**
     * @notice Batch send messages
     */
    function batchSendMessages(
        ChainId[] calldata destChains,
        bytes32[] calldata receivers,
        bytes[] calldata dataArray,
        uint256[] calldata gasLimits
    ) external payable nonReentrant whenNotPaused returns (bytes32[] memory messageIds) {
        require(
            destChains.length == receivers.length &&
            receivers.length == dataArray.length &&
            dataArray.length == gasLimits.length,
            "Array length mismatch"
        );

        messageIds = new bytes32[](destChains.length);
        uint256 totalFee = 0;

        // Calculate total fee
        for (uint256 i = 0; i < destChains.length; i++) {
            totalFee += calculateFee(destChains[i], gasLimits[i], dataArray[i].length);
        }

        require(msg.value >= totalFee, "Insufficient total fee");

        // Send each message
        for (uint256 i = 0; i < destChains.length; i++) {
            uint256 fee = calculateFee(destChains[i], gasLimits[i], dataArray[i].length);
            messageIds[i] = this.sendMessage{value: fee}(
                destChains[i],
                receivers[i],
                dataArray[i],
                gasLimits[i]
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MESSAGE RELAYING (Relayer functions)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Relay a message to destination chain
     * @dev Called by relayers after message is confirmed
     */
    function relayMessage(
        bytes32 messageId
    ) external onlyRole(RELAYER_ROLE) whenNotPaused {
        Message storage message = messages[messageId];
        
        if (message.id == bytes32(0)) revert MessageNotFound();
        if (message.status != MessageStatus.Pending) revert MessageAlreadyProcessed();
        if (block.timestamp > message.timestamp + MESSAGE_EXPIRY) {
            message.status = MessageStatus.Expired;
            emit MessageExpired(messageId);
            revert MessageExpiredError();
        }

        message.status = MessageStatus.Relayed;

        emit MessageRelayed(messageId, message.destChain, msg.sender);
    }

    /**
     * @notice Submit execution receipt from destination chain
     */
    function submitReceipt(
        bytes32 messageId,
        bool success,
        bytes calldata returnData,
        uint256 gasUsed,
        bytes32 txHash
    ) external onlyRole(RELAYER_ROLE) {
        Message storage message = messages[messageId];
        
        if (message.id == bytes32(0)) revert MessageNotFound();
        if (message.status != MessageStatus.Relayed) revert MessageAlreadyProcessed();

        receipts[messageId] = MessageReceipt({
            messageId: messageId,
            success: success,
            returnData: returnData,
            gasUsed: gasUsed,
            txHash: txHash
        });

        message.status = success ? MessageStatus.Executed : MessageStatus.Failed;

        emit MessageExecuted(messageId, success, returnData, gasUsed);
    }

    /**
     * @notice Execute an incoming message (on destination chain)
     * @dev This would be called on the destination chain's router
     */
    function executeMessage(
        bytes32 messageId,
        ChainId sourceChain,
        address sender,
        bytes32 receiver,
        bytes calldata data,
        uint256 value,
        bytes calldata proof
    ) external onlyRole(RELAYER_ROLE) nonReentrant returns (bool success, bytes memory returnData) {
        // Verify proof (from source chain)
        require(_verifyMessageProof(messageId, sourceChain, proof), "Invalid proof");

        // Execute call to receiver
        address receiverAddr = address(uint160(uint256(receiver)));
        
        (success, returnData) = receiverAddr.call{value: value, gas: gasleft() - 10000}(data);

        emit MessageExecuted(messageId, success, returnData, gasleft());
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FEE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Calculate fee for a message
     */
    function calculateFee(
        ChainId destChain,
        uint256 gasLimit,
        uint256 dataSize
    ) public view returns (uint256) {
        ChainConfig storage config = chainConfigs[destChain];
        
        // Base fee + gas cost + data cost
        uint256 gasCost = gasLimit * config.gasPrice;
        uint256 dataCost = dataSize * 16; // 16 gas per byte
        uint256 totalCost = config.baseFee + gasCost + dataCost;

        // Apply multiplier
        return (totalCost * config.feeMultiplier) / 10000;
    }

    /**
     * @notice Request refund for expired message
     */
    function requestRefund(bytes32 messageId) external nonReentrant {
        Message storage message = messages[messageId];
        
        if (message.id == bytes32(0)) revert MessageNotFound();
        if (message.sender != msg.sender) revert MessageNotFound();
        if (message.status != MessageStatus.Expired) {
            if (block.timestamp <= message.timestamp + MESSAGE_EXPIRY) {
                revert MessageExpiredError();
            }
            message.status = MessageStatus.Expired;
        }

        uint256 refundAmount = message.value + message.fee;
        message.status = MessageStatus.Refunded;

        payable(msg.sender).transfer(refundAmount);

        emit FeeRefunded(messageId, msg.sender, refundAmount);
    }

    /**
     * @notice Withdraw collected fees
     */
    function withdrawFees(uint256 amount) external onlyRole(FEE_MANAGER_ROLE) {
        require(amount <= totalFeesCollected, "Insufficient fees");
        totalFeesCollected -= amount;
        payable(feeTreasury).transfer(amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Configure a chain
     */
    function setChainConfig(
        ChainId chainId,
        bool enabled,
        uint256 gasPrice,
        uint256 baseFee,
        uint256 feeMultiplier,
        address adapter
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        chainConfigs[chainId] = ChainConfig({
            enabled: enabled,
            gasPrice: gasPrice,
            baseFee: baseFee,
            feeMultiplier: feeMultiplier,
            adapter: adapter
        });

        emit ChainConfigUpdated(chainId, enabled, baseFee);
    }

    /**
     * @notice Set fee treasury
     */
    function setFeeTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeTreasury = _treasury;
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getMessage(bytes32 messageId) external view returns (Message memory) {
        return messages[messageId];
    }

    function getReceipt(bytes32 messageId) external view returns (MessageReceipt memory) {
        return receipts[messageId];
    }

    function getPendingMessages(ChainId chainId) external view returns (bytes32[] memory) {
        return pendingMessages[chainId];
    }

    function getChainConfig(ChainId chainId) external view returns (ChainConfig memory) {
        return chainConfigs[chainId];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function _verifyMessageProof(
        bytes32 messageId,
        ChainId sourceChain,
        bytes calldata proof
    ) internal pure returns (bool) {
        // In production: verify Merkle proof or signature from source chain
        // For now: basic validation
        return proof.length >= 32 && messageId != bytes32(0);
    }

    receive() external payable {}
}
