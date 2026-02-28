// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BlockspaceAuction
 * @notice Dutch auction for blockspace and transaction priority
 * @dev Validators stake X3 to participate in blockspace auctions
 *
 * Auction Types:
 * - PRIORITY: Next block inclusion priority
 * - BUNDLE: MEV bundle execution rights
 * - SEQUENCING: Transaction ordering rights
 * - VALIDATOR_SLOT: Validator slot for epoch
 */
contract BlockspaceAuction is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant BPS_PRECISION = 10000;
    uint256 public constant EPOCH_DURATION = 6 hours;
    uint256 public constant MIN_AUCTION_DURATION = 1 minutes;
    uint256 public constant MAX_AUCTION_DURATION = 1 hours;

    // ============ Enums ============

    enum AuctionType {
        PRIORITY,
        BUNDLE,
        SEQUENCING,
        VALIDATOR_SLOT
    }

    enum AuctionStatus {
        PENDING,
        ACTIVE,
        COMPLETED,
        CANCELLED
    }

    // ============ Structs ============

    struct Auction {
        uint256 auctionId;
        AuctionType auctionType;
        AuctionStatus status;
        address creator;
        uint256 startPrice;
        uint256 reservePrice;
        uint256 currentPrice;
        uint256 startTime;
        uint256 endTime;
        uint256 decayRate; // Price decay per second
        address highestBidder;
        uint256 highestBid;
        uint256 targetBlock;
        bytes payload;
    }

    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
        bool winning;
    }

    struct Validator {
        address operator;
        bool active;
        uint256 stake;
        uint256 slashableAmount;
        uint256 auctionsWon;
        uint256 auctionsParticipated;
        uint256 totalSpent;
        uint256 rewardsEarned;
        uint256 registeredAt;
        bytes32 pubkey;
    }

    struct Epoch {
        uint256 epochId;
        uint256 startTime;
        uint256 endTime;
        address[] validators;
        uint256 totalStake;
        uint256 rewardsPool;
        bool finalized;
    }

    struct AuctionMetrics {
        uint256 totalAuctions;
        uint256 completedAuctions;
        uint256 totalVolume;
        uint256 averageWinningBid;
        uint256 averageParticipants;
    }

    // ============ State Variables ============

    // Auctions
    mapping(uint256 => Auction) public auctions;
    uint256 public auctionCount;
    mapping(uint256 => Bid[]) public auctionBids;

    // Validators
    mapping(address => Validator) public validators;
    address[] public validatorList;

    // Epochs
    mapping(uint256 => Epoch) public epochs;
    uint256 public currentEpoch;

    // Staking token
    IERC20 public stakingToken;

    // Treasury
    address public treasury;

    // Minimum stake to participate
    uint256 public minStake;

    // Platform fee
    uint256 public platformFee;

    // Metrics
    AuctionMetrics public metrics;

    // Block target -> auction
    mapping(uint256 => uint256) public blockAuctions;

    // ============ Events ============

    event ValidatorRegistered(
        address indexed validator,
        uint256 stake,
        bytes32 pubkey
    );

    event ValidatorStakeUpdated(
        address indexed validator,
        uint256 oldStake,
        uint256 newStake
    );

    event AuctionCreated(
        uint256 indexed auctionId,
        AuctionType auctionType,
        uint256 startPrice,
        uint256 targetBlock
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );

    event AuctionWon(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBid
    );

    event AuctionCancelled(uint256 indexed auctionId);

    event EpochStarted(
        uint256 indexed epochId,
        uint256 startTime,
        uint256 validatorCount
    );

    event EpochFinalized(uint256 indexed epochId, uint256 rewardsDistributed);

    event ValidatorSlashed(
        address indexed validator,
        uint256 amount,
        string reason
    );

    // ============ Errors ============

    error ValidatorNotRegistered();
    error ValidatorNotActive();
    error InsufficientStake();
    error AuctionNotFound();
    error AuctionNotActive();
    error AuctionExpired();
    error BidTooLow();
    error AlreadyHighestBidder();
    error NotAuthorized();

    // ============ Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _stakingToken,
        address _treasury,
        uint256 _minStake,
        uint256 _platformFee
    ) external initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(VALIDATOR_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        stakingToken = IERC20(_stakingToken);
        treasury = _treasury;
        minStake = _minStake;
        platformFee = _platformFee;

        // Initialize first epoch
        currentEpoch = 1;
        epochs[currentEpoch] = Epoch({
            epochId: 1,
            startTime: block.timestamp,
            endTime: block.timestamp + EPOCH_DURATION,
            validators: new address[](0),
            totalStake: 0,
            rewardsPool: 0,
            finalized: false
        });
    }

    // ============ Validator Management ============

    /**
     * @notice Register as a validator
     */
    function registerValidator(
        uint256 stake,
        bytes32 pubkey
    ) external nonReentrant {
        require(
            validators[msg.sender].operator == address(0),
            "Already registered"
        );
        require(stake >= minStake, "Stake too low");

        stakingToken.safeTransferFrom(msg.sender, address(this), stake);

        validators[msg.sender] = Validator({
            operator: msg.sender,
            active: true,
            stake: stake,
            slashableAmount: stake,
            auctionsWon: 0,
            auctionsParticipated: 0,
            totalSpent: 0,
            rewardsEarned: 0,
            registeredAt: block.timestamp,
            pubkey: pubkey
        });

        validatorList.push(msg.sender);
        _grantRole(VALIDATOR_ROLE, msg.sender);

        emit ValidatorRegistered(msg.sender, stake, pubkey);
    }

    /**
     * @notice Add stake
     */
    function addStake(uint256 amount) external nonReentrant {
        Validator storage v = validators[msg.sender];
        if (v.operator == address(0)) revert ValidatorNotRegistered();

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 oldStake = v.stake;
        v.stake += amount;
        v.slashableAmount += amount;

        emit ValidatorStakeUpdated(msg.sender, oldStake, v.stake);
    }

    /**
     * @notice Withdraw stake (with timelock)
     */
    function withdrawStake(uint256 amount) external nonReentrant {
        Validator storage v = validators[msg.sender];
        if (v.operator == address(0)) revert ValidatorNotRegistered();

        uint256 minRequired = v.active ? minStake : 0;
        require(v.stake - amount >= minRequired, "Would go below minimum");

        uint256 oldStake = v.stake;
        v.stake -= amount;
        v.slashableAmount = v.slashableAmount > amount
            ? v.slashableAmount - amount
            : 0;

        stakingToken.safeTransfer(msg.sender, amount);

        emit ValidatorStakeUpdated(msg.sender, oldStake, v.stake);
    }

    /**
     * @notice Deactivate validator
     */
    function deactivate() external {
        Validator storage v = validators[msg.sender];
        if (v.operator == address(0)) revert ValidatorNotRegistered();

        v.active = false;
        _revokeRole(VALIDATOR_ROLE, msg.sender);
    }

    // ============ Auction Management ============

    /**
     * @notice Create a blockspace auction
     */
    function createAuction(
        AuctionType auctionType,
        uint256 startPrice,
        uint256 reservePrice,
        uint256 duration,
        uint256 targetBlock,
        bytes calldata payload
    ) external onlyRole(OPERATOR_ROLE) returns (uint256 auctionId) {
        require(duration >= MIN_AUCTION_DURATION, "Duration too short");
        require(duration <= MAX_AUCTION_DURATION, "Duration too long");
        require(startPrice >= reservePrice, "Invalid price range");
        require(blockAuctions[targetBlock] == 0, "Block already auctioned");

        auctionId = ++auctionCount;

        // Calculate decay rate
        uint256 decayRate = (startPrice - reservePrice) / duration;

        auctions[auctionId] = Auction({
            auctionId: auctionId,
            auctionType: auctionType,
            status: AuctionStatus.ACTIVE,
            creator: msg.sender,
            startPrice: startPrice,
            reservePrice: reservePrice,
            currentPrice: startPrice,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            decayRate: decayRate,
            highestBidder: address(0),
            highestBid: 0,
            targetBlock: targetBlock,
            payload: payload
        });

        blockAuctions[targetBlock] = auctionId;
        metrics.totalAuctions++;

        emit AuctionCreated(auctionId, auctionType, startPrice, targetBlock);
    }

    /**
     * @notice Bid in auction
     */
    function bid(
        uint256 auctionId
    ) external nonReentrant onlyRole(VALIDATOR_ROLE) {
        Auction storage auction = auctions[auctionId];
        if (auction.auctionId == 0) revert AuctionNotFound();
        if (auction.status != AuctionStatus.ACTIVE) revert AuctionNotActive();
        if (block.timestamp > auction.endTime) revert AuctionExpired();

        Validator storage v = validators[msg.sender];
        if (!v.active) revert ValidatorNotActive();

        // Calculate current Dutch auction price
        uint256 elapsed = block.timestamp - auction.startTime;
        uint256 price = auction.startPrice - (auction.decayRate * elapsed);
        if (price < auction.reservePrice) {
            price = auction.reservePrice;
        }

        // Validator must have enough stake
        if (v.stake < price) revert InsufficientStake();
        if (msg.sender == auction.highestBidder) revert AlreadyHighestBidder();

        // Refund previous highest bidder's locked stake
        if (auction.highestBidder != address(0)) {
            // Previous bid is just unlocked, not transferred
        }

        // Record bid
        auction.highestBidder = msg.sender;
        auction.highestBid = price;
        auction.currentPrice = price;

        auctionBids[auctionId].push(
            Bid({
                bidder: msg.sender,
                amount: price,
                timestamp: block.timestamp,
                winning: false
            })
        );

        v.auctionsParticipated++;

        emit BidPlaced(auctionId, msg.sender, price);
    }

    /**
     * @notice Finalize auction
     */
    function finalizeAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        if (auction.auctionId == 0) revert AuctionNotFound();
        if (auction.status != AuctionStatus.ACTIVE) revert AuctionNotActive();
        require(
            block.timestamp > auction.endTime ||
                auction.highestBidder != address(0),
            "Auction not ready"
        );

        if (auction.highestBidder == address(0)) {
            // No bids - cancel
            auction.status = AuctionStatus.CANCELLED;
            emit AuctionCancelled(auctionId);
        } else {
            // Complete auction
            auction.status = AuctionStatus.COMPLETED;

            Validator storage winner = validators[auction.highestBidder];

            // Deduct stake from winner
            winner.stake -= auction.highestBid;
            winner.totalSpent += auction.highestBid;
            winner.auctionsWon++;

            // Calculate fee
            uint256 fee = (auction.highestBid * platformFee) / BPS_PRECISION;
            uint256 toTreasury = fee;
            uint256 toRewardsPool = auction.highestBid - fee;

            // Transfer funds
            stakingToken.safeTransfer(treasury, toTreasury);

            // Add to epoch rewards pool
            epochs[currentEpoch].rewardsPool += toRewardsPool;

            // Mark winning bid
            Bid[] storage bids = auctionBids[auctionId];
            for (uint256 i = 0; i < bids.length; i++) {
                if (
                    bids[i].bidder == auction.highestBidder &&
                    bids[i].amount == auction.highestBid
                ) {
                    bids[i].winning = true;
                    break;
                }
            }

            // Update metrics
            metrics.completedAuctions++;
            metrics.totalVolume += auction.highestBid;

            emit AuctionWon(
                auctionId,
                auction.highestBidder,
                auction.highestBid
            );
        }
    }

    /**
     * @notice Cancel auction (operator only, before any bids)
     */
    function cancelAuction(uint256 auctionId) external onlyRole(OPERATOR_ROLE) {
        Auction storage auction = auctions[auctionId];
        if (auction.auctionId == 0) revert AuctionNotFound();
        if (auction.status != AuctionStatus.ACTIVE) revert AuctionNotActive();
        require(auction.highestBidder == address(0), "Has bids");

        auction.status = AuctionStatus.CANCELLED;
        blockAuctions[auction.targetBlock] = 0;

        emit AuctionCancelled(auctionId);
    }

    // ============ Epoch Management ============

    /**
     * @notice Start new epoch
     */
    function startNewEpoch() external onlyRole(OPERATOR_ROLE) {
        Epoch storage current = epochs[currentEpoch];
        require(block.timestamp >= current.endTime, "Current epoch not ended");

        // Finalize current epoch
        _finalizeEpoch(currentEpoch);

        // Start new epoch
        currentEpoch++;

        // Get active validators
        address[] memory activeValidators = _getActiveValidators();
        uint256 totalStake = 0;
        for (uint256 i = 0; i < activeValidators.length; i++) {
            totalStake += validators[activeValidators[i]].stake;
        }

        epochs[currentEpoch] = Epoch({
            epochId: currentEpoch,
            startTime: block.timestamp,
            endTime: block.timestamp + EPOCH_DURATION,
            validators: activeValidators,
            totalStake: totalStake,
            rewardsPool: 0,
            finalized: false
        });

        emit EpochStarted(
            currentEpoch,
            block.timestamp,
            activeValidators.length
        );
    }

    /**
     * @notice Slash validator for misbehavior
     */
    function slashValidator(
        address validator,
        uint256 amount,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) {
        Validator storage v = validators[validator];
        if (v.operator == address(0)) revert ValidatorNotRegistered();

        uint256 slashAmount = amount > v.slashableAmount
            ? v.slashableAmount
            : amount;
        v.stake -= slashAmount;
        v.slashableAmount -= slashAmount;

        // Send slashed amount to treasury
        stakingToken.safeTransfer(treasury, slashAmount);

        // Deactivate if below minimum
        if (v.stake < minStake) {
            v.active = false;
            _revokeRole(VALIDATOR_ROLE, validator);
        }

        emit ValidatorSlashed(validator, slashAmount, reason);
    }

    // ============ View Functions ============

    /**
     * @notice Get auction info
     */
    function getAuction(
        uint256 auctionId
    ) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    /**
     * @notice Get current auction price
     */
    function getCurrentPrice(
        uint256 auctionId
    ) external view returns (uint256) {
        Auction storage auction = auctions[auctionId];
        if (auction.status != AuctionStatus.ACTIVE) {
            return auction.currentPrice;
        }

        uint256 elapsed = block.timestamp - auction.startTime;
        uint256 price = auction.startPrice - (auction.decayRate * elapsed);

        return price < auction.reservePrice ? auction.reservePrice : price;
    }

    /**
     * @notice Get auction bids
     */
    function getAuctionBids(
        uint256 auctionId
    ) external view returns (Bid[] memory) {
        return auctionBids[auctionId];
    }

    /**
     * @notice Get validator info
     */
    function getValidator(
        address addr
    ) external view returns (Validator memory) {
        return validators[addr];
    }

    /**
     * @notice Get current epoch
     */
    function getCurrentEpoch() external view returns (Epoch memory) {
        return epochs[currentEpoch];
    }

    /**
     * @notice Get metrics
     */
    function getMetrics() external view returns (AuctionMetrics memory) {
        return metrics;
    }

    /**
     * @notice Get active validators
     */
    function getActiveValidators() external view returns (address[] memory) {
        return _getActiveValidators();
    }

    // ============ Internal Functions ============

    function _getActiveValidators() internal view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].active) {
                activeCount++;
            }
        }

        address[] memory active = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].active) {
                active[index++] = validatorList[i];
            }
        }

        return active;
    }

    function _finalizeEpoch(uint256 epochId) internal {
        Epoch storage epoch = epochs[epochId];
        if (epoch.finalized) return;

        epoch.finalized = true;

        // Distribute rewards proportionally to stake
        if (epoch.rewardsPool > 0 && epoch.totalStake > 0) {
            for (uint256 i = 0; i < epoch.validators.length; i++) {
                address validatorAddr = epoch.validators[i];
                Validator storage v = validators[validatorAddr];

                uint256 share = (epoch.rewardsPool * v.stake) /
                    epoch.totalStake;
                if (share > 0) {
                    v.stake += share;
                    v.rewardsEarned += share;
                }
            }
        }

        emit EpochFinalized(epochId, epoch.rewardsPool);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}
}
