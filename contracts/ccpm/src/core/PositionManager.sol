// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

/**
 * @title CrossChainPositionManager (CCPM)
 * @notice Unified position tracking and management across 103 chains
 * @dev Core infrastructure for Atlas Sphere DeFi ecosystem
 *
 * Position Types:
 * - TOKENS: Raw token holdings
 * - LP: Liquidity provider positions
 * - LENDING: Supply/borrow positions
 * - STAKED: Staking positions
 * - DERIVATIVES: Options, perps, futures
 * - STRATEGIES: Automated yield strategies
 * - PORTFOLIOS: Aggregated multi-position bundles
 */
contract CrossChainPositionManager is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    // ============ Constants ============

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant MAX_CHAINS = 200;
    uint256 public constant MAX_POSITIONS_PER_USER = 1000;
    uint256 public constant SLIPPAGE_PRECISION = 10000; // 100.00%
    uint256 public constant MAX_SLIPPAGE = 100; // 1%

    // ============ Enums ============

    enum PositionType {
        TOKENS,
        LP,
        LENDING,
        STAKED,
        DERIVATIVES,
        STRATEGIES,
        PORTFOLIOS
    }

    enum PositionStatus {
        ACTIVE,
        PENDING,
        MIGRATING,
        UNWINDING,
        CLOSED,
        LIQUIDATED
    }

    enum RiskLevel {
        MINIMAL, // 0-20 risk score
        LOW, // 21-40
        MEDIUM, // 41-60
        HIGH, // 61-80
        CRITICAL // 81-100
    }

    // ============ Structs ============

    struct Position {
        bytes32 positionId;
        address owner;
        PositionType positionType;
        PositionStatus status;
        uint256 chainId;
        address protocol;
        address[] assets;
        uint256[] amounts;
        uint256 valueUSD;
        uint256 entryPrice;
        uint256 currentPrice;
        int256 pnlUSD;
        uint256 riskScore;
        uint256 createdAt;
        uint256 updatedAt;
        bytes metadata;
    }

    struct LPPosition {
        bytes32 positionId;
        address pool;
        address token0;
        address token1;
        uint256 liquidity;
        int24 tickLower;
        int24 tickUpper;
        uint256 fees0Earned;
        uint256 fees1Earned;
        bool isConcentrated;
    }

    struct LendingPosition {
        bytes32 positionId;
        address protocol;
        address supplyAsset;
        address borrowAsset;
        uint256 supplyAmount;
        uint256 borrowAmount;
        uint256 healthFactor;
        uint256 supplyAPY;
        uint256 borrowAPY;
        uint256 netAPY;
    }

    struct StakedPosition {
        bytes32 positionId;
        address stakingContract;
        address stakedToken;
        address rewardToken;
        uint256 stakedAmount;
        uint256 pendingRewards;
        uint256 lockEndTime;
        uint256 apy;
    }

    struct DerivativePosition {
        bytes32 positionId;
        address protocol;
        address underlying;
        bool isLong;
        uint256 size;
        uint256 collateral;
        uint256 leverage;
        uint256 entryPrice;
        uint256 liquidationPrice;
        uint256 fundingRate;
        uint256 expiryTimestamp;
    }

    struct StrategyPosition {
        bytes32 positionId;
        bytes32 strategyId;
        address vault;
        uint256 shares;
        uint256 depositedValue;
        uint256 currentValue;
        uint256 apy;
        bool autoCompound;
        uint256 lastHarvest;
    }

    struct Portfolio {
        bytes32 portfolioId;
        address owner;
        string name;
        bytes32[] positionIds;
        uint256 totalValueUSD;
        uint256 totalPnLUSD;
        uint256 weightedRiskScore;
        uint256 targetAllocations;
        bool autoRebalance;
        uint256 rebalanceThreshold;
    }

    struct ChainConfig {
        uint256 chainId;
        string name;
        string rpcUrl;
        string rpcFallback;
        address bridge;
        address swapRouter;
        address lendingPool;
        uint256 gasMultiplier;
        bool active;
    }

    struct RiskAssessment {
        uint256 volatilityScore;
        uint256 liquidityScore;
        uint256 protocolScore;
        uint256 concentrationScore;
        uint256 correlationScore;
        uint256 totalScore;
        RiskLevel level;
        bool killSwitchTriggered;
        string[] warnings;
    }

    struct ExecutionBundle {
        bytes32 bundleId;
        address initiator;
        bytes32[] positionIds;
        uint256[] chainIds;
        bytes[] callData;
        uint256 maxSlippage;
        uint256 deadline;
        bool atomic;
        ExecutionStatus status;
    }

    enum ExecutionStatus {
        PENDING,
        EXECUTING,
        COMPLETED,
        FAILED,
        ROLLED_BACK
    }

    // ============ State Variables ============

    // Core mappings
    mapping(bytes32 => Position) public positions;
    mapping(address => bytes32[]) public userPositions;
    mapping(uint256 => ChainConfig) public chainConfigs;
    mapping(bytes32 => Portfolio) public portfolios;
    mapping(address => bytes32[]) public userPortfolios;

    // Position type specific
    mapping(bytes32 => LPPosition) public lpPositions;
    mapping(bytes32 => LendingPosition) public lendingPositions;
    mapping(bytes32 => StakedPosition) public stakedPositions;
    mapping(bytes32 => DerivativePosition) public derivativePositions;
    mapping(bytes32 => StrategyPosition) public strategyPositions;

    // Risk management
    mapping(bytes32 => RiskAssessment) public riskAssessments;
    mapping(address => bool) public ruggedProtocols;
    mapping(address => uint256) public protocolTVL;
    mapping(bytes32 => bool) public killSwitchActive;

    // Execution
    mapping(bytes32 => ExecutionBundle) public bundles;
    mapping(bytes32 => bytes32) public bundleReceipts;

    // Counters
    uint256 public totalPositions;
    uint256 public totalPortfolios;
    uint256 public totalBundles;
    uint256 public activeChains;

    // Protocol addresses
    address public treasury;
    address public swapRouter;
    address public oracleRouter;
    address public evolutionCore;

    // ============ Events ============

    event PositionCreated(
        bytes32 indexed positionId,
        address indexed owner,
        PositionType positionType,
        uint256 chainId,
        uint256 valueUSD
    );

    event PositionUpdated(
        bytes32 indexed positionId,
        PositionStatus newStatus,
        uint256 newValueUSD,
        int256 pnlUSD
    );

    event PositionClosed(
        bytes32 indexed positionId,
        address indexed owner,
        int256 finalPnL
    );

    event PortfolioCreated(
        bytes32 indexed portfolioId,
        address indexed owner,
        string name
    );

    event PortfolioRebalanced(
        bytes32 indexed portfolioId,
        uint256 newTotalValue,
        uint256 gasUsed
    );

    event BundleExecuted(
        bytes32 indexed bundleId,
        address indexed initiator,
        ExecutionStatus status,
        uint256 gasUsed
    );

    event RiskAlertTriggered(
        bytes32 indexed positionId,
        RiskLevel level,
        string reason
    );

    event KillSwitchActivated(
        bytes32 indexed positionId,
        address indexed protocol,
        string reason
    );

    event ProtocolRugDetected(
        address indexed protocol,
        uint256 tvlBefore,
        uint256 tvlAfter
    );

    event ChainConfigUpdated(uint256 indexed chainId, bool active);

    // ============ Errors ============

    error PositionNotFound(bytes32 positionId);
    error PositionNotOwned(bytes32 positionId, address caller);
    error InvalidPositionType();
    error ChainNotSupported(uint256 chainId);
    error SlippageExceeded(uint256 expected, uint256 actual);
    error DeadlineExpired(uint256 deadline);
    error KillSwitchActive(bytes32 positionId);
    error MaxPositionsReached(address user);
    error BundleExecutionFailed(bytes32 bundleId);
    error InvalidAssets();
    error InsufficientLiquidity();

    // ============ Modifiers ============

    modifier onlyPositionOwner(bytes32 positionId) {
        if (positions[positionId].owner != msg.sender) {
            revert PositionNotOwned(positionId, msg.sender);
        }
        _;
    }

    modifier positionExists(bytes32 positionId) {
        if (positions[positionId].owner == address(0)) {
            revert PositionNotFound(positionId);
        }
        _;
    }

    modifier checkKillSwitch(bytes32 positionId) {
        if (killSwitchActive[positionId]) {
            revert KillSwitchActive(positionId);
        }
        _;
    }

    modifier validChain(uint256 chainId) {
        if (!chainConfigs[chainId].active) {
            revert ChainNotSupported(chainId);
        }
        _;
    }

    // ============ Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _treasury,
        address _swapRouter,
        address _oracleRouter
    ) external initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        treasury = _treasury;
        swapRouter = _swapRouter;
        oracleRouter = _oracleRouter;
    }

    // ============ Position Management ============

    /**
     * @notice Create a new tracked position
     * @param positionType Type of position
     * @param chainId Chain where position exists
     * @param protocol Protocol address
     * @param assets Array of asset addresses
     * @param amounts Array of asset amounts
     * @param metadata Additional position-specific data
     */
    function createPosition(
        PositionType positionType,
        uint256 chainId,
        address protocol,
        address[] calldata assets,
        uint256[] calldata amounts,
        bytes calldata metadata
    )
        external
        nonReentrant
        whenNotPaused
        validChain(chainId)
        returns (bytes32)
    {
        if (userPositions[msg.sender].length >= MAX_POSITIONS_PER_USER) {
            revert MaxPositionsReached(msg.sender);
        }
        if (assets.length != amounts.length || assets.length == 0) {
            revert InvalidAssets();
        }

        bytes32 positionId = _generatePositionId(
            msg.sender,
            positionType,
            chainId,
            totalPositions
        );

        uint256 valueUSD = _calculatePositionValue(assets, amounts, chainId);

        positions[positionId] = Position({
            positionId: positionId,
            owner: msg.sender,
            positionType: positionType,
            status: PositionStatus.ACTIVE,
            chainId: chainId,
            protocol: protocol,
            assets: assets,
            amounts: amounts,
            valueUSD: valueUSD,
            entryPrice: valueUSD,
            currentPrice: valueUSD,
            pnlUSD: 0,
            riskScore: 0,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            metadata: metadata
        });

        userPositions[msg.sender].push(positionId);
        totalPositions++;

        // Initialize risk assessment
        _assessRisk(positionId);

        emit PositionCreated(
            positionId,
            msg.sender,
            positionType,
            chainId,
            valueUSD
        );

        return positionId;
    }

    /**
     * @notice Create LP position with detailed tracking
     */
    function createLPPosition(
        uint256 chainId,
        address pool,
        address token0,
        address token1,
        uint256 liquidity,
        int24 tickLower,
        int24 tickUpper,
        bool isConcentrated
    )
        external
        nonReentrant
        whenNotPaused
        validChain(chainId)
        returns (bytes32)
    {
        address[] memory assets = new address[](2);
        assets[0] = token0;
        assets[1] = token1;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = liquidity;

        bytes32 positionId = _generatePositionId(
            msg.sender,
            PositionType.LP,
            chainId,
            totalPositions
        );

        uint256 valueUSD = _calculateLPValue(pool, liquidity, chainId);

        positions[positionId] = Position({
            positionId: positionId,
            owner: msg.sender,
            positionType: PositionType.LP,
            status: PositionStatus.ACTIVE,
            chainId: chainId,
            protocol: pool,
            assets: assets,
            amounts: amounts,
            valueUSD: valueUSD,
            entryPrice: valueUSD,
            currentPrice: valueUSD,
            pnlUSD: 0,
            riskScore: 0,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            metadata: ""
        });

        lpPositions[positionId] = LPPosition({
            positionId: positionId,
            pool: pool,
            token0: token0,
            token1: token1,
            liquidity: liquidity,
            tickLower: tickLower,
            tickUpper: tickUpper,
            fees0Earned: 0,
            fees1Earned: 0,
            isConcentrated: isConcentrated
        });

        userPositions[msg.sender].push(positionId);
        totalPositions++;

        _assessRisk(positionId);

        emit PositionCreated(
            positionId,
            msg.sender,
            PositionType.LP,
            chainId,
            valueUSD
        );

        return positionId;
    }

    /**
     * @notice Create lending position
     */
    function createLendingPosition(
        uint256 chainId,
        address protocol,
        address supplyAsset,
        address borrowAsset,
        uint256 supplyAmount,
        uint256 borrowAmount
    )
        external
        nonReentrant
        whenNotPaused
        validChain(chainId)
        returns (bytes32)
    {
        bytes32 positionId = _generatePositionId(
            msg.sender,
            PositionType.LENDING,
            chainId,
            totalPositions
        );

        address[] memory assets = new address[](2);
        assets[0] = supplyAsset;
        assets[1] = borrowAsset;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = supplyAmount;
        amounts[1] = borrowAmount;

        uint256 valueUSD = _calculateLendingValue(
            supplyAsset,
            borrowAsset,
            supplyAmount,
            borrowAmount,
            chainId
        );

        positions[positionId] = Position({
            positionId: positionId,
            owner: msg.sender,
            positionType: PositionType.LENDING,
            status: PositionStatus.ACTIVE,
            chainId: chainId,
            protocol: protocol,
            assets: assets,
            amounts: amounts,
            valueUSD: valueUSD,
            entryPrice: valueUSD,
            currentPrice: valueUSD,
            pnlUSD: 0,
            riskScore: 0,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            metadata: ""
        });

        // Calculate health factor - simplified
        uint256 healthFactor = borrowAmount > 0
            ? (((supplyAmount * 8500) / 10000) * 1e18) / borrowAmount
            : type(uint256).max;

        lendingPositions[positionId] = LendingPosition({
            positionId: positionId,
            protocol: protocol,
            supplyAsset: supplyAsset,
            borrowAsset: borrowAsset,
            supplyAmount: supplyAmount,
            borrowAmount: borrowAmount,
            healthFactor: healthFactor,
            supplyAPY: 0,
            borrowAPY: 0,
            netAPY: 0
        });

        userPositions[msg.sender].push(positionId);
        totalPositions++;

        _assessRisk(positionId);

        emit PositionCreated(
            positionId,
            msg.sender,
            PositionType.LENDING,
            chainId,
            valueUSD
        );

        return positionId;
    }

    /**
     * @notice Create staking position
     */
    function createStakedPosition(
        uint256 chainId,
        address stakingContract,
        address stakedToken,
        address rewardToken,
        uint256 stakedAmount,
        uint256 lockEndTime
    )
        external
        nonReentrant
        whenNotPaused
        validChain(chainId)
        returns (bytes32)
    {
        bytes32 positionId = _generatePositionId(
            msg.sender,
            PositionType.STAKED,
            chainId,
            totalPositions
        );

        address[] memory assets = new address[](2);
        assets[0] = stakedToken;
        assets[1] = rewardToken;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = stakedAmount;

        uint256 valueUSD = _getAssetValue(stakedToken, stakedAmount, chainId);

        positions[positionId] = Position({
            positionId: positionId,
            owner: msg.sender,
            positionType: PositionType.STAKED,
            status: PositionStatus.ACTIVE,
            chainId: chainId,
            protocol: stakingContract,
            assets: assets,
            amounts: amounts,
            valueUSD: valueUSD,
            entryPrice: valueUSD,
            currentPrice: valueUSD,
            pnlUSD: 0,
            riskScore: 0,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            metadata: ""
        });

        stakedPositions[positionId] = StakedPosition({
            positionId: positionId,
            stakingContract: stakingContract,
            stakedToken: stakedToken,
            rewardToken: rewardToken,
            stakedAmount: stakedAmount,
            pendingRewards: 0,
            lockEndTime: lockEndTime,
            apy: 0
        });

        userPositions[msg.sender].push(positionId);
        totalPositions++;

        _assessRisk(positionId);

        emit PositionCreated(
            positionId,
            msg.sender,
            PositionType.STAKED,
            chainId,
            valueUSD
        );

        return positionId;
    }

    /**
     * @notice Update position values and status
     */
    function updatePosition(
        bytes32 positionId,
        uint256[] calldata newAmounts,
        PositionStatus newStatus
    )
        external
        positionExists(positionId)
        onlyPositionOwner(positionId)
        checkKillSwitch(positionId)
    {
        Position storage pos = positions[positionId];

        pos.amounts = newAmounts;
        pos.status = newStatus;
        pos.updatedAt = block.timestamp;

        // Recalculate value
        uint256 newValueUSD = _calculatePositionValue(
            pos.assets,
            newAmounts,
            pos.chainId
        );
        pos.currentPrice = newValueUSD;
        pos.pnlUSD = int256(newValueUSD) - int256(pos.entryPrice);
        pos.valueUSD = newValueUSD;

        // Reassess risk
        _assessRisk(positionId);

        emit PositionUpdated(positionId, newStatus, newValueUSD, pos.pnlUSD);
    }

    /**
     * @notice Close a position
     */
    function closePosition(
        bytes32 positionId
    ) external positionExists(positionId) onlyPositionOwner(positionId) {
        Position storage pos = positions[positionId];

        int256 finalPnL = pos.pnlUSD;
        pos.status = PositionStatus.CLOSED;
        pos.updatedAt = block.timestamp;

        emit PositionClosed(positionId, msg.sender, finalPnL);
    }

    // ============ Portfolio Management ============

    /**
     * @notice Create a portfolio aggregating multiple positions
     */
    function createPortfolio(
        string calldata name,
        bytes32[] calldata positionIds,
        bool autoRebalance,
        uint256 rebalanceThreshold
    ) external nonReentrant returns (bytes32) {
        bytes32 portfolioId = keccak256(
            abi.encodePacked(msg.sender, name, block.timestamp, totalPortfolios)
        );

        uint256 totalValue = 0;
        int256 totalPnL = 0;
        uint256 weightedRisk = 0;

        for (uint256 i = 0; i < positionIds.length; i++) {
            Position storage pos = positions[positionIds[i]];
            if (pos.owner != msg.sender) {
                revert PositionNotOwned(positionIds[i], msg.sender);
            }
            totalValue += pos.valueUSD;
            totalPnL += pos.pnlUSD;
            weightedRisk += pos.riskScore * pos.valueUSD;
        }

        portfolios[portfolioId] = Portfolio({
            portfolioId: portfolioId,
            owner: msg.sender,
            name: name,
            positionIds: positionIds,
            totalValueUSD: totalValue,
            totalPnLUSD: uint256(totalPnL > 0 ? totalPnL : -totalPnL),
            weightedRiskScore: totalValue > 0 ? weightedRisk / totalValue : 0,
            targetAllocations: 0,
            autoRebalance: autoRebalance,
            rebalanceThreshold: rebalanceThreshold
        });

        userPortfolios[msg.sender].push(portfolioId);
        totalPortfolios++;

        emit PortfolioCreated(portfolioId, msg.sender, name);

        return portfolioId;
    }

    /**
     * @notice Rebalance portfolio positions
     */
    function rebalancePortfolio(
        bytes32 portfolioId,
        uint256[] calldata targetWeights
    ) external nonReentrant {
        Portfolio storage portfolio = portfolios[portfolioId];
        require(portfolio.owner == msg.sender, "Not owner");
        require(
            targetWeights.length == portfolio.positionIds.length,
            "Weight mismatch"
        );

        uint256 gasStart = gasleft();

        // Calculate current weights and rebalance
        // This would integrate with SwapRouter for actual rebalancing

        uint256 newTotalValue = 0;
        for (uint256 i = 0; i < portfolio.positionIds.length; i++) {
            newTotalValue += positions[portfolio.positionIds[i]].valueUSD;
        }

        portfolio.totalValueUSD = newTotalValue;

        uint256 gasUsed = gasStart - gasleft();

        emit PortfolioRebalanced(portfolioId, newTotalValue, gasUsed);
    }

    // ============ Bundle Execution ============

    /**
     * @notice Create atomic execution bundle across chains
     */
    function createBundle(
        bytes32[] calldata positionIds,
        uint256[] calldata chainIds,
        bytes[] calldata callData,
        uint256 maxSlippage,
        uint256 deadline,
        bool atomic
    ) external nonReentrant returns (bytes32) {
        require(positionIds.length == chainIds.length, "Length mismatch");
        require(positionIds.length == callData.length, "Calldata mismatch");
        require(maxSlippage <= MAX_SLIPPAGE, "Slippage too high");
        require(deadline > block.timestamp, "Invalid deadline");

        bytes32 bundleId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, totalBundles)
        );

        bundles[bundleId] = ExecutionBundle({
            bundleId: bundleId,
            initiator: msg.sender,
            positionIds: positionIds,
            chainIds: chainIds,
            callData: callData,
            maxSlippage: maxSlippage,
            deadline: deadline,
            atomic: atomic,
            status: ExecutionStatus.PENDING
        });

        totalBundles++;

        return bundleId;
    }

    /**
     * @notice Execute a bundle (called by operator/relayer)
     */
    function executeBundle(
        bytes32 bundleId
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        ExecutionBundle storage bundle = bundles[bundleId];
        require(bundle.status == ExecutionStatus.PENDING, "Invalid status");
        require(block.timestamp <= bundle.deadline, "Deadline expired");

        bundle.status = ExecutionStatus.EXECUTING;

        uint256 gasStart = gasleft();
        bool success = true;

        // Execute each position action
        for (uint256 i = 0; i < bundle.positionIds.length; i++) {
            // In production, this would make cross-chain calls
            // For now, mark as successful if position exists and not killed
            if (killSwitchActive[bundle.positionIds[i]]) {
                success = false;
                break;
            }
        }

        if (success) {
            bundle.status = ExecutionStatus.COMPLETED;
        } else {
            bundle.status = bundle.atomic
                ? ExecutionStatus.ROLLED_BACK
                : ExecutionStatus.FAILED;
        }

        uint256 gasUsed = gasStart - gasleft();

        emit BundleExecuted(bundleId, bundle.initiator, bundle.status, gasUsed);
    }

    // ============ Risk Management ============

    /**
     * @notice Assess risk for a position
     */
    function _assessRisk(bytes32 positionId) internal {
        Position storage pos = positions[positionId];

        uint256 volatilityScore = _calculateVolatilityScore(
            pos.assets[0],
            pos.chainId
        );
        uint256 liquidityScore = _calculateLiquidityScore(
            pos.protocol,
            pos.chainId
        );
        uint256 protocolScore = _calculateProtocolScore(pos.protocol);
        uint256 concentrationScore = _calculateConcentrationScore(
            pos.owner,
            pos.valueUSD
        );
        uint256 correlationScore = 50; // Default

        uint256 totalScore = (volatilityScore *
            25 +
            liquidityScore *
            25 +
            protocolScore *
            20 +
            concentrationScore *
            20 +
            correlationScore *
            10) / 100;

        RiskLevel level;
        if (totalScore <= 20) level = RiskLevel.MINIMAL;
        else if (totalScore <= 40) level = RiskLevel.LOW;
        else if (totalScore <= 60) level = RiskLevel.MEDIUM;
        else if (totalScore <= 80) level = RiskLevel.HIGH;
        else level = RiskLevel.CRITICAL;

        string[] memory warnings = new string[](0);

        riskAssessments[positionId] = RiskAssessment({
            volatilityScore: volatilityScore,
            liquidityScore: liquidityScore,
            protocolScore: protocolScore,
            concentrationScore: concentrationScore,
            correlationScore: correlationScore,
            totalScore: totalScore,
            level: level,
            killSwitchTriggered: false,
            warnings: warnings
        });

        pos.riskScore = totalScore;

        if (level == RiskLevel.CRITICAL) {
            emit RiskAlertTriggered(positionId, level, "Critical risk level");
        }
    }

    /**
     * @notice Activate kill switch for a position
     */
    function activateKillSwitch(
        bytes32 positionId,
        string calldata reason
    ) external onlyRole(GUARDIAN_ROLE) positionExists(positionId) {
        killSwitchActive[positionId] = true;
        riskAssessments[positionId].killSwitchTriggered = true;

        emit KillSwitchActivated(
            positionId,
            positions[positionId].protocol,
            reason
        );
    }

    /**
     * @notice Deactivate kill switch
     */
    function deactivateKillSwitch(
        bytes32 positionId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        killSwitchActive[positionId] = false;
        riskAssessments[positionId].killSwitchTriggered = false;
    }

    /**
     * @notice Report a rugged protocol
     */
    function reportRug(
        address protocol,
        uint256 tvlBefore,
        uint256 tvlAfter
    ) external onlyRole(GUARDIAN_ROLE) {
        ruggedProtocols[protocol] = true;
        emit ProtocolRugDetected(protocol, tvlBefore, tvlAfter);
    }

    // ============ Chain Configuration ============

    /**
     * @notice Add or update chain configuration
     */
    function setChainConfig(
        uint256 chainId,
        string calldata name,
        string calldata rpcUrl,
        string calldata rpcFallback,
        address bridge,
        address chainSwapRouter,
        address lendingPool,
        uint256 gasMultiplier,
        bool active
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (chainConfigs[chainId].chainId == 0) {
            activeChains++;
        }

        chainConfigs[chainId] = ChainConfig({
            chainId: chainId,
            name: name,
            rpcUrl: rpcUrl,
            rpcFallback: rpcFallback,
            bridge: bridge,
            swapRouter: chainSwapRouter,
            lendingPool: lendingPool,
            gasMultiplier: gasMultiplier,
            active: active
        });

        emit ChainConfigUpdated(chainId, active);
    }

    // ============ View Functions ============

    function getUserPositions(
        address user
    ) external view returns (bytes32[] memory) {
        return userPositions[user];
    }

    function getUserPortfolios(
        address user
    ) external view returns (bytes32[] memory) {
        return userPortfolios[user];
    }

    function getPosition(
        bytes32 positionId
    ) external view returns (Position memory) {
        return positions[positionId];
    }

    function getPortfolio(
        bytes32 portfolioId
    ) external view returns (Portfolio memory) {
        return portfolios[portfolioId];
    }

    function getRiskAssessment(
        bytes32 positionId
    ) external view returns (RiskAssessment memory) {
        return riskAssessments[positionId];
    }

    function getChainConfig(
        uint256 chainId
    ) external view returns (ChainConfig memory) {
        return chainConfigs[chainId];
    }

    function getTotalValueLocked(address user) external view returns (uint256) {
        uint256 total = 0;
        bytes32[] memory userPos = userPositions[user];
        for (uint256 i = 0; i < userPos.length; i++) {
            if (positions[userPos[i]].status == PositionStatus.ACTIVE) {
                total += positions[userPos[i]].valueUSD;
            }
        }
        return total;
    }

    // ============ Internal Functions ============

    function _generatePositionId(
        address owner,
        PositionType posType,
        uint256 chainId,
        uint256 nonce
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    owner,
                    posType,
                    chainId,
                    block.timestamp,
                    nonce
                )
            );
    }

    function _calculatePositionValue(
        address[] memory assets,
        uint256[] memory amounts,
        uint256 chainId
    ) internal view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < assets.length; i++) {
            total += _getAssetValue(assets[i], amounts[i], chainId);
        }
        return total;
    }

    function _calculateLPValue(
        address pool,
        uint256 liquidity,
        uint256 chainId
    ) internal view returns (uint256) {
        // Simplified - in production would query pool for reserves and prices
        return liquidity * 2; // Placeholder
    }

    function _calculateLendingValue(
        address supplyAsset,
        address borrowAsset,
        uint256 supplyAmount,
        uint256 borrowAmount,
        uint256 chainId
    ) internal view returns (uint256) {
        uint256 supplyValue = _getAssetValue(
            supplyAsset,
            supplyAmount,
            chainId
        );
        uint256 borrowValue = _getAssetValue(
            borrowAsset,
            borrowAmount,
            chainId
        );
        return supplyValue > borrowValue ? supplyValue - borrowValue : 0;
    }

    function _getAssetValue(
        address asset,
        uint256 amount,
        uint256 chainId
    ) internal view returns (uint256) {
        // In production, would call OracleRouter
        // Placeholder returns amount as USD (1:1)
        return amount;
    }

    function _calculateVolatilityScore(
        address asset,
        uint256 chainId
    ) internal view returns (uint256) {
        // Placeholder - would use oracle price history
        return 50;
    }

    function _calculateLiquidityScore(
        address protocol,
        uint256 chainId
    ) internal view returns (uint256) {
        // Placeholder - would check DEX liquidity
        return 50;
    }

    function _calculateProtocolScore(
        address protocol
    ) internal view returns (uint256) {
        if (ruggedProtocols[protocol]) return 100;
        return 30; // Default medium score
    }

    function _calculateConcentrationScore(
        address user,
        uint256 positionValue
    ) internal view returns (uint256) {
        uint256 totalValue = 0;
        bytes32[] memory userPos = userPositions[user];
        for (uint256 i = 0; i < userPos.length; i++) {
            totalValue += positions[userPos[i]].valueUSD;
        }
        if (totalValue == 0) return 0;
        return (positionValue * 100) / totalValue;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}
}
