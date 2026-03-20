// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PredictionMarket
 * @notice AI-powered prediction market for DeFi outcomes
 * @dev Allows AI agents to create and trade on market predictions
 *
 * Market Types:
 * - PRICE: Token price will be above/below X
 * - YIELD: APY will reach X
 * - TVL: Protocol TVL will reach X
 * - GOVERNANCE: Proposal will pass
 * - CUSTOM: Custom binary outcome
 */
contract PredictionMarket is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant BPS_PRECISION = 10000;
    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant MIN_LIQUIDITY = 1000e18;

    // ============ Enums ============

    enum MarketType {
        PRICE,
        YIELD,
        TVL,
        GOVERNANCE,
        CUSTOM
    }

    enum MarketStatus {
        CREATED,
        ACTIVE,
        RESOLVED,
        CANCELLED,
        DISPUTED
    }

    enum Outcome {
        UNRESOLVED,
        YES,
        NO,
        INVALID
    }

    // ============ Structs ============

    struct Market {
        uint256 marketId;
        MarketType marketType;
        MarketStatus status;
        Outcome resolution;
        string question;
        bytes32 questionHash;
        address creator;
        uint256 resolutionTime;
        uint256 createdAt;
        uint256 resolvedAt;
        // Liquidity
        uint256 totalLiquidity;
        uint256 yesShares;
        uint256 noShares;
        // Prices (in PRICE_PRECISION)
        uint256 yesPrice;
        uint256 noPrice;
        // Fee
        uint256 fee;
        // Oracle data
        address oracle;
        bytes oracleData;
    }

    struct Position {
        uint256 yesShares;
        uint256 noShares;
        uint256 costBasis;
        bool claimed;
    }

    struct MarketMetrics {
        uint256 totalVolume;
        uint256 uniqueTraders;
        uint256 maxPrice;
        uint256 minPrice;
        uint256 lastTradeTime;
    }

    struct Trade {
        address trader;
        bool isYes;
        uint256 shares;
        uint256 price;
        uint256 timestamp;
    }

    struct AISignal {
        address agent;
        bool prediction;
        uint256 confidence;
        string reasoning;
        uint256 timestamp;
    }

    // ============ State Variables ============

    // Markets
    mapping(uint256 => Market) public markets;
    uint256 public marketCount;

    // Positions
    mapping(uint256 => mapping(address => Position)) public positions;

    // Metrics
    mapping(uint256 => MarketMetrics) public marketMetrics;

    // Trade history
    mapping(uint256 => Trade[]) public trades;

    // AI signals
    mapping(uint256 => AISignal[]) public aiSignals;

    // Payment token
    IERC20 public collateralToken;

    // Treasury
    address public treasury;

    // Platform fee
    uint256 public platformFee;

    // Minimum market duration
    uint256 public minDuration;

    // Maximum market duration
    uint256 public maxDuration;

    // ============ Events ============

    event MarketCreated(
        uint256 indexed marketId,
        MarketType marketType,
        string question,
        uint256 resolutionTime
    );

    event MarketActivated(uint256 indexed marketId, uint256 initialLiquidity);

    event TradeExecuted(
        uint256 indexed marketId,
        address indexed trader,
        bool isYes,
        uint256 shares,
        uint256 price,
        uint256 cost
    );

    event LiquidityAdded(
        uint256 indexed marketId,
        address indexed provider,
        uint256 amount
    );

    event MarketResolved(uint256 indexed marketId, Outcome outcome);

    event RewardClaimed(
        uint256 indexed marketId,
        address indexed trader,
        uint256 amount
    );

    event AISignalSubmitted(
        uint256 indexed marketId,
        address indexed agent,
        bool prediction,
        uint256 confidence
    );

    // ============ Errors ============

    error MarketNotFound();
    error MarketNotActive();
    error MarketNotResolved();
    error InvalidMarketStatus();
    error InsufficientLiquidity();
    error InsufficientShares();
    error ResolutionTimePassed();
    error ResolutionTimeNotReached();
    error AlreadyClaimed();
    error InvalidPrice();

    // ============ Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _collateralToken,
        address _treasury,
        uint256 _platformFee
    ) external initializer {
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ORACLE_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        collateralToken = IERC20(_collateralToken);
        treasury = _treasury;
        platformFee = _platformFee;

        minDuration = 1 hours;
        maxDuration = 365 days;
    }

    // ============ Market Management ============

    /**
     * @notice Create a new prediction market
     */
    function createMarket(
        MarketType marketType,
        string calldata question,
        uint256 resolutionTime,
        uint256 fee,
        address oracle,
        bytes calldata oracleData
    ) external returns (uint256 marketId) {
        require(
            resolutionTime > block.timestamp + minDuration,
            "Resolution too soon"
        );
        require(
            resolutionTime <= block.timestamp + maxDuration,
            "Resolution too far"
        );
        require(fee <= 500, "Fee too high"); // Max 5%

        marketId = ++marketCount;

        markets[marketId] = Market({
            marketId: marketId,
            marketType: marketType,
            status: MarketStatus.CREATED,
            resolution: Outcome.UNRESOLVED,
            question: question,
            questionHash: keccak256(bytes(question)),
            creator: msg.sender,
            resolutionTime: resolutionTime,
            createdAt: block.timestamp,
            resolvedAt: 0,
            totalLiquidity: 0,
            yesShares: 0,
            noShares: 0,
            yesPrice: PRICE_PRECISION / 2, // Start at 50%
            noPrice: PRICE_PRECISION / 2,
            fee: fee,
            oracle: oracle,
            oracleData: oracleData
        });

        emit MarketCreated(marketId, marketType, question, resolutionTime);
    }

    /**
     * @notice Add initial liquidity and activate market
     */
    function seedMarket(
        uint256 marketId,
        uint256 amount
    ) external nonReentrant {
        Market storage market = markets[marketId];
        if (market.marketId == 0) revert MarketNotFound();
        if (market.status != MarketStatus.CREATED) revert InvalidMarketStatus();

        require(amount >= MIN_LIQUIDITY, "Insufficient seed liquidity");

        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        market.totalLiquidity = amount;
        market.yesShares = amount;
        market.noShares = amount;
        market.status = MarketStatus.ACTIVE;

        // Give LP shares to seeder
        positions[marketId][msg.sender] = Position({
            yesShares: amount / 2,
            noShares: amount / 2,
            costBasis: amount,
            claimed: false
        });

        emit MarketActivated(marketId, amount);
        emit LiquidityAdded(marketId, msg.sender, amount);
    }

    /**
     * @notice Buy YES or NO shares
     */
    function buy(
        uint256 marketId,
        bool isYes,
        uint256 maxCost,
        uint256 minShares
    ) external nonReentrant returns (uint256 shares, uint256 cost) {
        Market storage market = markets[marketId];
        if (market.marketId == 0) revert MarketNotFound();
        if (market.status != MarketStatus.ACTIVE) revert MarketNotActive();
        if (block.timestamp >= market.resolutionTime)
            revert ResolutionTimePassed();

        // Calculate shares using CPMM
        (shares, cost) = _calculateBuy(market, isYes, maxCost);
        require(shares >= minShares, "Slippage exceeded");

        // Transfer collateral
        collateralToken.safeTransferFrom(msg.sender, address(this), cost);

        // Update market state
        if (isYes) {
            market.yesShares -= shares;
            positions[marketId][msg.sender].yesShares += shares;
        } else {
            market.noShares -= shares;
            positions[marketId][msg.sender].noShares += shares;
        }

        positions[marketId][msg.sender].costBasis += cost;
        market.totalLiquidity += cost;

        // Update prices
        _updatePrices(market);

        // Record trade
        trades[marketId].push(
            Trade({
                trader: msg.sender,
                isYes: isYes,
                shares: shares,
                price: isYes ? market.yesPrice : market.noPrice,
                timestamp: block.timestamp
            })
        );

        // Update metrics
        MarketMetrics storage metrics = marketMetrics[marketId];
        metrics.totalVolume += cost;
        metrics.lastTradeTime = block.timestamp;
        if (isYes && market.yesPrice > metrics.maxPrice)
            metrics.maxPrice = market.yesPrice;
        if (!isYes && market.noPrice < metrics.minPrice)
            metrics.minPrice = market.noPrice;

        emit TradeExecuted(
            marketId,
            msg.sender,
            isYes,
            shares,
            isYes ? market.yesPrice : market.noPrice,
            cost
        );
    }

    /**
     * @notice Sell shares back to market
     */
    function sell(
        uint256 marketId,
        bool isYes,
        uint256 shares,
        uint256 minReturn
    ) external nonReentrant returns (uint256 returnAmount) {
        Market storage market = markets[marketId];
        if (market.marketId == 0) revert MarketNotFound();
        if (market.status != MarketStatus.ACTIVE) revert MarketNotActive();

        Position storage pos = positions[marketId][msg.sender];
        if (isYes && pos.yesShares < shares) revert InsufficientShares();
        if (!isYes && pos.noShares < shares) revert InsufficientShares();

        // Calculate return using CPMM
        returnAmount = _calculateSell(market, isYes, shares);
        require(returnAmount >= minReturn, "Slippage exceeded");

        // Deduct fee
        uint256 fee = (returnAmount * market.fee) / BPS_PRECISION;
        returnAmount -= fee;

        // Update market state
        if (isYes) {
            market.yesShares += shares;
            pos.yesShares -= shares;
        } else {
            market.noShares += shares;
            pos.noShares -= shares;
        }

        market.totalLiquidity -= returnAmount;

        // Update prices
        _updatePrices(market);

        // Transfer return
        collateralToken.safeTransfer(msg.sender, returnAmount);
        if (fee > 0) {
            collateralToken.safeTransfer(treasury, fee);
        }

        // Record trade
        trades[marketId].push(
            Trade({
                trader: msg.sender,
                isYes: isYes,
                shares: shares,
                price: isYes ? market.yesPrice : market.noPrice,
                timestamp: block.timestamp
            })
        );

        emit TradeExecuted(
            marketId,
            msg.sender,
            isYes,
            shares,
            isYes ? market.yesPrice : market.noPrice,
            returnAmount
        );
    }

    /**
     * @notice Resolve market (oracle only)
     */
    function resolveMarket(
        uint256 marketId,
        Outcome outcome
    ) external onlyRole(ORACLE_ROLE) {
        Market storage market = markets[marketId];
        if (market.marketId == 0) revert MarketNotFound();
        if (market.status != MarketStatus.ACTIVE) revert InvalidMarketStatus();
        if (block.timestamp < market.resolutionTime)
            revert ResolutionTimeNotReached();
        require(outcome != Outcome.UNRESOLVED, "Invalid outcome");

        market.status = MarketStatus.RESOLVED;
        market.resolution = outcome;
        market.resolvedAt = block.timestamp;

        emit MarketResolved(marketId, outcome);
    }

    /**
     * @notice Claim winnings after resolution
     */
    function claim(
        uint256 marketId
    ) external nonReentrant returns (uint256 payout) {
        Market storage market = markets[marketId];
        if (market.marketId == 0) revert MarketNotFound();
        if (market.status != MarketStatus.RESOLVED) revert MarketNotResolved();

        Position storage pos = positions[marketId][msg.sender];
        if (pos.claimed) revert AlreadyClaimed();

        if (market.resolution == Outcome.YES) {
            payout = pos.yesShares;
        } else if (market.resolution == Outcome.NO) {
            payout = pos.noShares;
        } else if (market.resolution == Outcome.INVALID) {
            // Refund based on cost basis
            payout = pos.costBasis;
        }

        if (payout > 0) {
            pos.claimed = true;
            collateralToken.safeTransfer(msg.sender, payout);

            emit RewardClaimed(marketId, msg.sender, payout);
        }
    }

    /**
     * @notice Submit AI signal
     */
    function submitAISignal(
        uint256 marketId,
        bool prediction,
        uint256 confidence,
        string calldata reasoning
    ) external {
        Market storage market = markets[marketId];
        if (market.marketId == 0) revert MarketNotFound();
        if (market.status != MarketStatus.ACTIVE) revert MarketNotActive();

        require(confidence <= 1000, "Invalid confidence");

        aiSignals[marketId].push(
            AISignal({
                agent: msg.sender,
                prediction: prediction,
                confidence: confidence,
                reasoning: reasoning,
                timestamp: block.timestamp
            })
        );

        emit AISignalSubmitted(marketId, msg.sender, prediction, confidence);
    }

    // ============ View Functions ============

    /**
     * @notice Get market info
     */
    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    /**
     * @notice Get position
     */
    function getPosition(
        uint256 marketId,
        address trader
    ) external view returns (Position memory) {
        return positions[marketId][trader];
    }

    /**
     * @notice Get current prices
     */
    function getPrices(
        uint256 marketId
    ) external view returns (uint256 yesPrice, uint256 noPrice) {
        Market storage market = markets[marketId];
        return (market.yesPrice, market.noPrice);
    }

    /**
     * @notice Get market metrics
     */
    function getMetrics(
        uint256 marketId
    ) external view returns (MarketMetrics memory) {
        return marketMetrics[marketId];
    }

    /**
     * @notice Get AI signals
     */
    function getAISignals(
        uint256 marketId
    ) external view returns (AISignal[] memory) {
        return aiSignals[marketId];
    }

    /**
     * @notice Get aggregated AI consensus
     */
    function getAIConsensus(
        uint256 marketId
    )
        external
        view
        returns (uint256 yesVotes, uint256 noVotes, uint256 avgConfidence)
    {
        AISignal[] storage signals = aiSignals[marketId];
        uint256 totalConfidence = 0;

        for (uint256 i = 0; i < signals.length; i++) {
            if (signals[i].prediction) {
                yesVotes++;
            } else {
                noVotes++;
            }
            totalConfidence += signals[i].confidence;
        }

        avgConfidence = signals.length > 0
            ? totalConfidence / signals.length
            : 0;
    }

    /**
     * @notice Calculate buy cost
     */
    function quoteBuy(
        uint256 marketId,
        bool isYes,
        uint256 maxCost
    ) external view returns (uint256 shares, uint256 cost) {
        Market storage market = markets[marketId];
        return _calculateBuy(market, isYes, maxCost);
    }

    /**
     * @notice Calculate sell return
     */
    function quoteSell(
        uint256 marketId,
        bool isYes,
        uint256 shares
    ) external view returns (uint256 returnAmount) {
        Market storage market = markets[marketId];
        return _calculateSell(market, isYes, shares);
    }

    // ============ Internal Functions ============

    /**
     * @notice Calculate buy using CPMM (Constant Product Market Maker)
     */
    function _calculateBuy(
        Market storage market,
        bool isYes,
        uint256 maxCost
    ) internal view returns (uint256 shares, uint256 cost) {
        // x * y = k
        uint256 k = market.yesShares * market.noShares;

        if (isYes) {
            // Buy YES: spend collateral, reduce yesShares pool
            // new_yes * no = k
            // new_yes = k / no
            // shares = yes - new_yes
            uint256 newNo = market.noShares + maxCost;
            uint256 newYes = k / newNo;
            shares = market.yesShares - newYes;
            cost = maxCost;
        } else {
            // Buy NO: spend collateral, reduce noShares pool
            uint256 newYes = market.yesShares + maxCost;
            uint256 newNo = k / newYes;
            shares = market.noShares - newNo;
            cost = maxCost;
        }

        // Deduct fee from shares
        uint256 fee = (shares * market.fee) / BPS_PRECISION;
        shares -= fee;
    }

    /**
     * @notice Calculate sell return using CPMM
     */
    function _calculateSell(
        Market storage market,
        bool isYes,
        uint256 shares
    ) internal view returns (uint256 returnAmount) {
        uint256 k = market.yesShares * market.noShares;

        if (isYes) {
            // Sell YES: increase yesShares pool, get collateral
            uint256 newYes = market.yesShares + shares;
            uint256 newNo = k / newYes;
            returnAmount = market.noShares - newNo;
        } else {
            // Sell NO: increase noShares pool, get collateral
            uint256 newNo = market.noShares + shares;
            uint256 newYes = k / newNo;
            returnAmount = market.yesShares - newYes;
        }
    }

    /**
     * @notice Update prices based on pool ratio
     */
    function _updatePrices(Market storage market) internal {
        uint256 total = market.yesShares + market.noShares;
        if (total == 0) return;

        // Price = opposite side / total (inverse because more shares = lower price)
        market.yesPrice = (market.noShares * PRICE_PRECISION) / total;
        market.noPrice = (market.yesShares * PRICE_PRECISION) / total;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}
}
