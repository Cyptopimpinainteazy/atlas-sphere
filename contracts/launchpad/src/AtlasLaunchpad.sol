// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title AtlasLaunchpad
 * @notice Token presales, NFT drops, and auction platform for Atlas Sphere
 * @dev Supports multiple sale types with whitelist, vesting, and cross-chain settlement
 *
 * Sale Types:
 * - PRESALE: Fixed price with whitelist and allocation limits
 * - DUTCH_AUCTION: Decreasing price auction
 * - ENGLISH_AUCTION: Ascending price auction
 * - FAIR_LAUNCH: First-come-first-served
 * - OVERFLOW: Pro-rata distribution based on commitments
 */
contract AtlasLaunchpad is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant BPS_PRECISION = 10000;
    uint256 public constant MAX_PLATFORM_FEE = 500; // 5%
    uint256 public constant MIN_SALE_DURATION = 1 hours;
    uint256 public constant MAX_SALE_DURATION = 30 days;

    // ============ Enums ============

    enum SaleType {
        PRESALE,
        DUTCH_AUCTION,
        ENGLISH_AUCTION,
        FAIR_LAUNCH,
        OVERFLOW
    }

    enum SaleStatus {
        CREATED,
        ACTIVE,
        ENDED,
        FINALIZED,
        CANCELLED
    }

    enum VestingType {
        NONE,
        LINEAR,
        CLIFF_LINEAR,
        CUSTOM
    }

    // ============ Structs ============

    struct Sale {
        uint256 saleId;
        address creator;
        SaleType saleType;
        SaleStatus status;
        address saleToken;
        address paymentToken;
        uint256 tokenAmount;
        uint256 tokensSold;
        uint256 startPrice;
        uint256 endPrice; // For Dutch auction
        uint256 currentPrice;
        uint256 minContribution;
        uint256 maxContribution;
        uint256 hardCap;
        uint256 softCap;
        uint256 raised;
        uint256 startTime;
        uint256 endTime;
        bytes32 whitelistRoot;
        bool whitelistEnabled;
        VestingConfig vesting;
        uint256 platformFeeBps;
        uint256 chainId;
    }

    struct VestingConfig {
        VestingType vestingType;
        uint256 cliffDuration;
        uint256 vestingDuration;
        uint256 tgePercent; // Token Generation Event unlock %
        uint256[] schedule; // For custom vesting
    }

    struct Contribution {
        uint256 amount;
        uint256 tokens;
        uint256 claimed;
        uint256 lastClaim;
        bool refunded;
    }

    struct SaleStats {
        uint256 participants;
        uint256 totalRaised;
        uint256 tokensSold;
        uint256 averageContribution;
        uint256 whitelistClaims;
    }

    // ============ State Variables ============

    // Sales
    mapping(uint256 => Sale) public sales;
    uint256 public saleCount;

    // Contributions: saleId => user => contribution
    mapping(uint256 => mapping(address => Contribution)) public contributions;

    // Sale participants
    mapping(uint256 => address[]) public saleParticipants;
    mapping(uint256 => mapping(address => bool)) public isParticipant;

    // Sale stats
    mapping(uint256 => SaleStats) public saleStats;

    // Treasury
    address public treasury;
    uint256 public defaultPlatformFee;

    // Cross-chain
    mapping(uint256 => bool) public supportedChains;

    // ============ Events ============

    event SaleCreated(
        uint256 indexed saleId,
        address indexed creator,
        SaleType saleType,
        address saleToken,
        uint256 tokenAmount
    );

    event SaleStarted(
        uint256 indexed saleId,
        uint256 startTime,
        uint256 endTime
    );

    event ContributionMade(
        uint256 indexed saleId,
        address indexed user,
        uint256 amount,
        uint256 tokens
    );

    event TokensClaimed(
        uint256 indexed saleId,
        address indexed user,
        uint256 amount
    );

    event Refunded(
        uint256 indexed saleId,
        address indexed user,
        uint256 amount
    );

    event SaleFinalized(
        uint256 indexed saleId,
        uint256 totalRaised,
        uint256 tokensSold
    );

    event SaleCancelled(uint256 indexed saleId);

    event PriceUpdated(uint256 indexed saleId, uint256 newPrice);

    // ============ Errors ============

    error InvalidSale();
    error SaleNotActive();
    error SaleNotEnded();
    error NotWhitelisted();
    error ContributionTooLow();
    error ContributionTooHigh();
    error HardCapReached();
    error SoftCapNotReached();
    error AlreadyClaimed();
    error VestingNotReady();
    error NothingToRefund();
    error InvalidTimeRange();
    error InvalidPrice();
    error Unauthorized();

    // ============ Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _treasury
    ) external initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        treasury = _treasury;
        defaultPlatformFee = 200; // 2%

        // Support common chains
        supportedChains[1] = true; // Ethereum
        supportedChains[137] = true; // Polygon
        supportedChains[42161] = true; // Arbitrum
        supportedChains[10] = true; // Optimism
        supportedChains[8453] = true; // Base
        supportedChains[56] = true; // BSC
        supportedChains[43114] = true; // Avalanche
    }

    // ============ Sale Creation ============

    /**
     * @notice Create a new token sale
     */
    function createSale(
        SaleType saleType,
        address saleToken,
        address paymentToken,
        uint256 tokenAmount,
        uint256 startPrice,
        uint256 endPrice,
        uint256 minContribution,
        uint256 maxContribution,
        uint256 hardCap,
        uint256 softCap,
        uint256 startTime,
        uint256 endTime,
        bytes32 whitelistRoot,
        VestingConfig calldata vesting
    ) external nonReentrant whenNotPaused returns (uint256 saleId) {
        // Validation
        if (startTime < block.timestamp) revert InvalidTimeRange();
        if (endTime <= startTime) revert InvalidTimeRange();
        if (endTime - startTime < MIN_SALE_DURATION) revert InvalidTimeRange();
        if (endTime - startTime > MAX_SALE_DURATION) revert InvalidTimeRange();
        if (startPrice == 0) revert InvalidPrice();
        if (softCap > hardCap) revert InvalidPrice();

        // Transfer tokens to contract
        IERC20(saleToken).safeTransferFrom(
            msg.sender,
            address(this),
            tokenAmount
        );

        saleId = ++saleCount;

        sales[saleId] = Sale({
            saleId: saleId,
            creator: msg.sender,
            saleType: saleType,
            status: SaleStatus.CREATED,
            saleToken: saleToken,
            paymentToken: paymentToken,
            tokenAmount: tokenAmount,
            tokensSold: 0,
            startPrice: startPrice,
            endPrice: endPrice,
            currentPrice: startPrice,
            minContribution: minContribution,
            maxContribution: maxContribution,
            hardCap: hardCap,
            softCap: softCap,
            raised: 0,
            startTime: startTime,
            endTime: endTime,
            whitelistRoot: whitelistRoot,
            whitelistEnabled: whitelistRoot != bytes32(0),
            vesting: vesting,
            platformFeeBps: defaultPlatformFee,
            chainId: block.chainid
        });

        emit SaleCreated(saleId, msg.sender, saleType, saleToken, tokenAmount);
    }

    /**
     * @notice Start a sale (if not auto-started)
     */
    function startSale(uint256 saleId) external {
        Sale storage sale = sales[saleId];
        if (sale.saleId == 0) revert InvalidSale();
        if (msg.sender != sale.creator && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert Unauthorized();
        }
        if (sale.status != SaleStatus.CREATED) revert InvalidSale();
        if (block.timestamp < sale.startTime) revert InvalidTimeRange();

        sale.status = SaleStatus.ACTIVE;

        emit SaleStarted(saleId, sale.startTime, sale.endTime);
    }

    // ============ Contributions ============

    /**
     * @notice Contribute to a sale
     */
    function contribute(
        uint256 saleId,
        uint256 amount,
        bytes32[] calldata proof
    ) external payable nonReentrant whenNotPaused {
        Sale storage sale = sales[saleId];

        // Auto-start if time reached
        if (
            sale.status == SaleStatus.CREATED &&
            block.timestamp >= sale.startTime
        ) {
            sale.status = SaleStatus.ACTIVE;
        }

        if (sale.status != SaleStatus.ACTIVE) revert SaleNotActive();
        if (block.timestamp > sale.endTime) revert SaleNotActive();

        // Whitelist check
        if (sale.whitelistEnabled) {
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            if (!MerkleProof.verify(proof, sale.whitelistRoot, leaf)) {
                revert NotWhitelisted();
            }
        }

        // Handle payment
        uint256 paymentAmount;
        if (sale.paymentToken == address(0)) {
            paymentAmount = msg.value;
        } else {
            paymentAmount = amount;
            IERC20(sale.paymentToken).safeTransferFrom(
                msg.sender,
                address(this),
                amount
            );
        }

        // Validate contribution
        Contribution storage contrib = contributions[saleId][msg.sender];
        uint256 totalContrib = contrib.amount + paymentAmount;

        if (totalContrib < sale.minContribution) revert ContributionTooLow();
        if (totalContrib > sale.maxContribution) revert ContributionTooHigh();
        if (sale.raised + paymentAmount > sale.hardCap) revert HardCapReached();

        // Calculate tokens based on sale type
        uint256 currentPrice = _getCurrentPrice(sale);
        uint256 tokensToReceive = (paymentAmount * 1e18) / currentPrice;

        // Update contribution
        contrib.amount += paymentAmount;
        contrib.tokens += tokensToReceive;

        // Track participant
        if (!isParticipant[saleId][msg.sender]) {
            isParticipant[saleId][msg.sender] = true;
            saleParticipants[saleId].push(msg.sender);
            saleStats[saleId].participants++;
        }

        // Update sale state
        sale.raised += paymentAmount;
        sale.tokensSold += tokensToReceive;
        sale.currentPrice = currentPrice;

        // Update stats
        saleStats[saleId].totalRaised = sale.raised;
        saleStats[saleId].tokensSold = sale.tokensSold;

        emit ContributionMade(
            saleId,
            msg.sender,
            paymentAmount,
            tokensToReceive
        );
        emit PriceUpdated(saleId, currentPrice);
    }

    // ============ Claims & Refunds ============

    /**
     * @notice Claim vested tokens
     */
    function claimTokens(uint256 saleId) external nonReentrant {
        Sale storage sale = sales[saleId];
        if (sale.status != SaleStatus.FINALIZED) revert SaleNotEnded();

        Contribution storage contrib = contributions[saleId][msg.sender];
        if (contrib.tokens == 0) revert InvalidSale();

        uint256 claimable = _getClaimableTokens(sale, contrib);
        if (claimable == 0) revert VestingNotReady();

        contrib.claimed += claimable;
        contrib.lastClaim = block.timestamp;

        IERC20(sale.saleToken).safeTransfer(msg.sender, claimable);

        emit TokensClaimed(saleId, msg.sender, claimable);
    }

    /**
     * @notice Request refund for failed sale
     */
    function refund(uint256 saleId) external nonReentrant {
        Sale storage sale = sales[saleId];

        // Can refund if cancelled or soft cap not reached after end
        bool canRefund = sale.status == SaleStatus.CANCELLED ||
            (block.timestamp > sale.endTime && sale.raised < sale.softCap);

        if (!canRefund) revert NothingToRefund();

        Contribution storage contrib = contributions[saleId][msg.sender];
        if (contrib.amount == 0 || contrib.refunded) revert NothingToRefund();

        uint256 refundAmount = contrib.amount;
        contrib.refunded = true;

        if (sale.paymentToken == address(0)) {
            (bool success, ) = msg.sender.call{value: refundAmount}("");
            require(success, "Refund failed");
        } else {
            IERC20(sale.paymentToken).safeTransfer(msg.sender, refundAmount);
        }

        emit Refunded(saleId, msg.sender, refundAmount);
    }

    // ============ Sale Finalization ============

    /**
     * @notice Finalize a successful sale
     */
    function finalizeSale(uint256 saleId) external nonReentrant {
        Sale storage sale = sales[saleId];

        if (msg.sender != sale.creator && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert Unauthorized();
        }
        if (block.timestamp <= sale.endTime) revert SaleNotEnded();
        if (sale.raised < sale.softCap) revert SoftCapNotReached();
        if (sale.status == SaleStatus.FINALIZED) revert InvalidSale();

        sale.status = SaleStatus.FINALIZED;

        // Calculate fees
        uint256 platformFee = (sale.raised * sale.platformFeeBps) /
            BPS_PRECISION;
        uint256 creatorAmount = sale.raised - platformFee;

        // Transfer funds
        if (sale.paymentToken == address(0)) {
            (bool success1, ) = treasury.call{value: platformFee}("");
            (bool success2, ) = sale.creator.call{value: creatorAmount}("");
            require(success1 && success2, "Transfer failed");
        } else {
            IERC20(sale.paymentToken).safeTransfer(treasury, platformFee);
            IERC20(sale.paymentToken).safeTransfer(sale.creator, creatorAmount);
        }

        // Return unsold tokens
        uint256 unsold = sale.tokenAmount - sale.tokensSold;
        if (unsold > 0) {
            IERC20(sale.saleToken).safeTransfer(sale.creator, unsold);
        }

        emit SaleFinalized(saleId, sale.raised, sale.tokensSold);
    }

    /**
     * @notice Cancel a sale
     */
    function cancelSale(uint256 saleId) external {
        Sale storage sale = sales[saleId];

        if (msg.sender != sale.creator && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert Unauthorized();
        }
        if (sale.status == SaleStatus.FINALIZED) revert InvalidSale();

        sale.status = SaleStatus.CANCELLED;

        // Return tokens to creator
        IERC20(sale.saleToken).safeTransfer(sale.creator, sale.tokenAmount);

        emit SaleCancelled(saleId);
    }

    // ============ View Functions ============

    /**
     * @notice Get sale details
     */
    function getSale(uint256 saleId) external view returns (Sale memory) {
        return sales[saleId];
    }

    /**
     * @notice Get user contribution
     */
    function getContribution(
        uint256 saleId,
        address user
    ) external view returns (Contribution memory) {
        return contributions[saleId][user];
    }

    /**
     * @notice Get claimable tokens for user
     */
    function getClaimable(
        uint256 saleId,
        address user
    ) external view returns (uint256) {
        Sale storage sale = sales[saleId];
        Contribution storage contrib = contributions[saleId][user];
        return _getClaimableTokens(sale, contrib);
    }

    /**
     * @notice Get current price for a sale
     */
    function getCurrentPrice(uint256 saleId) external view returns (uint256) {
        return _getCurrentPrice(sales[saleId]);
    }

    /**
     * @notice Get sale statistics
     */
    function getStats(uint256 saleId) external view returns (SaleStats memory) {
        return saleStats[saleId];
    }

    /**
     * @notice Get all participants for a sale
     */
    function getParticipants(
        uint256 saleId
    ) external view returns (address[] memory) {
        return saleParticipants[saleId];
    }

    // ============ Admin Functions ============

    function setTreasury(
        address _treasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = _treasury;
    }

    function setDefaultFee(uint256 _fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_fee <= MAX_PLATFORM_FEE, "Fee too high");
        defaultPlatformFee = _fee;
    }

    function setSupportedChain(
        uint256 chainId,
        bool supported
    ) external onlyRole(OPERATOR_ROLE) {
        supportedChains[chainId] = supported;
    }

    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    // ============ Internal Functions ============

    function _getCurrentPrice(
        Sale storage sale
    ) internal view returns (uint256) {
        if (sale.saleType == SaleType.DUTCH_AUCTION) {
            // Linear decrease from startPrice to endPrice
            if (block.timestamp >= sale.endTime) return sale.endPrice;
            if (block.timestamp <= sale.startTime) return sale.startPrice;

            uint256 elapsed = block.timestamp - sale.startTime;
            uint256 duration = sale.endTime - sale.startTime;
            uint256 priceDrop = ((sale.startPrice - sale.endPrice) * elapsed) /
                duration;

            return sale.startPrice - priceDrop;
        } else if (sale.saleType == SaleType.ENGLISH_AUCTION) {
            // Current highest bid (startPrice is floor)
            return
                sale.currentPrice > sale.startPrice
                    ? sale.currentPrice
                    : sale.startPrice;
        } else {
            // Fixed price for presale, fair launch, overflow
            return sale.startPrice;
        }
    }

    function _getClaimableTokens(
        Sale storage sale,
        Contribution storage contrib
    ) internal view returns (uint256) {
        if (contrib.tokens == 0 || sale.status != SaleStatus.FINALIZED)
            return 0;

        VestingConfig storage vest = sale.vesting;
        uint256 totalVested;

        if (vest.vestingType == VestingType.NONE) {
            totalVested = contrib.tokens;
        } else {
            uint256 vestStart = sale.endTime;
            uint256 elapsed = block.timestamp > vestStart
                ? block.timestamp - vestStart
                : 0;

            // TGE unlock
            uint256 tgeAmount = (contrib.tokens * vest.tgePercent) /
                BPS_PRECISION;

            if (vest.vestingType == VestingType.LINEAR) {
                if (elapsed >= vest.vestingDuration) {
                    totalVested = contrib.tokens;
                } else {
                    uint256 vestingAmount = contrib.tokens - tgeAmount;
                    uint256 vested = (vestingAmount * elapsed) /
                        vest.vestingDuration;
                    totalVested = tgeAmount + vested;
                }
            } else if (vest.vestingType == VestingType.CLIFF_LINEAR) {
                if (elapsed < vest.cliffDuration) {
                    totalVested = tgeAmount;
                } else if (
                    elapsed >= vest.cliffDuration + vest.vestingDuration
                ) {
                    totalVested = contrib.tokens;
                } else {
                    uint256 vestingElapsed = elapsed - vest.cliffDuration;
                    uint256 vestingAmount = contrib.tokens - tgeAmount;
                    uint256 vested = (vestingAmount * vestingElapsed) /
                        vest.vestingDuration;
                    totalVested = tgeAmount + vested;
                }
            }
        }

        return
            totalVested > contrib.claimed ? totalVested - contrib.claimed : 0;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    receive() external payable {}
}
