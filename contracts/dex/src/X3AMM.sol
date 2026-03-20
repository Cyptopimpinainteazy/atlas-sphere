// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title X3AMM
 * @author X3 Chain Team
 * @notice Cross-VM Automated Market Maker with concentrated liquidity
 * @dev Implements Uniswap V3-style concentrated liquidity with cross-VM features
 *
 * ## Features
 * - Concentrated liquidity positions (tick-based)
 * - Cross-VM liquidity routing via precompiles
 * - Flash swaps with callback
 * - Dynamic fee tiers (0.01%, 0.05%, 0.3%, 1%)
 * - Oracle integration (TWAP)
 * - Protocol fee collection
 *
 * ## Architecture
 *
 * ```
 * ┌────────────────────────────────────────────────────────────────────┐
 * │                           X3AMM                                    │
 * ├────────────────────────────────────────────────────────────────────┤
 * │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
 * │  │    Pools    │  │  Positions  │  │   Router    │  │  Oracle   │ │
 * │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘ │
 * ├────────────────────────────────────────────────────────────────────┤
 * │  ┌─────────────────────────────────────────────────────────────┐  │
 * │  │                Cross-VM Liquidity Bridge                     │  │
 * │  │     EVM ←→ SVM Precompile (0x801) ←→ X3VM (0x802)          │  │
 * │  └─────────────────────────────────────────────────────────────┘  │
 * └────────────────────────────────────────────────────────────────────┘
 * ```
 */
contract X3AMM is
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Minimum liquidity locked forever (prevents division by zero attacks)
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    /// @notice Fee tier options (basis points)
    uint24 public constant FEE_TIER_001 = 100;    // 0.01%
    uint24 public constant FEE_TIER_005 = 500;    // 0.05%
    uint24 public constant FEE_TIER_030 = 3000;   // 0.3%
    uint24 public constant FEE_TIER_100 = 10000;  // 1%

    /// @notice Protocol fee share (1/4 of LP fee)
    uint256 public constant PROTOCOL_FEE_SHARE = 4;

    /// @notice Tick spacing for different fee tiers
    int24 public constant TICK_SPACING_001 = 1;
    int24 public constant TICK_SPACING_005 = 10;
    int24 public constant TICK_SPACING_030 = 60;
    int24 public constant TICK_SPACING_100 = 200;

    /// @notice Q96 for fixed point math
    uint256 public constant Q96 = 2**96;

    /// @notice Cross-VM precompile addresses
    address public constant SVM_PRECOMPILE = 0x0000000000000000000000000000000000000801;
    address public constant X3VM_PRECOMPILE = 0x0000000000000000000000000000000000000802;

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Liquidity pool
    struct Pool {
        address token0;
        address token1;
        uint24 fee;
        int24 tickSpacing;
        uint128 liquidity;
        uint160 sqrtPriceX96;
        int24 tick;
        uint256 feeGrowthGlobal0X128;
        uint256 feeGrowthGlobal1X128;
        uint128 protocolFees0;
        uint128 protocolFees1;
        bool initialized;
    }

    /// @notice Liquidity position
    struct Position {
        address owner;
        bytes32 poolId;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    /// @notice Tick data
    struct TickInfo {
        uint128 liquidityGross;
        int128 liquidityNet;
        uint256 feeGrowthOutside0X128;
        uint256 feeGrowthOutside1X128;
        bool initialized;
    }

    /// @notice Swap state for calculations
    struct SwapState {
        uint256 amountSpecifiedRemaining;
        uint256 amountCalculated;
        uint160 sqrtPriceX96;
        int24 tick;
        uint256 feeGrowthGlobalX128;
        uint128 liquidity;
    }

    /// @notice Oracle observation
    struct Observation {
        uint32 blockTimestamp;
        int56 tickCumulative;
        uint160 secondsPerLiquidityCumulativeX128;
        bool initialized;
    }

    /// @notice Cross-VM liquidity info
    struct CrossVMLiquidity {
        uint8 vmType;           // 0=EVM, 1=SVM, 2=X3VM
        bytes32 remotePool;
        uint256 remoteLiquidity;
        bool active;
    }

    /// @notice Flash swap callback data
    struct FlashCallbackData {
        address token0;
        address token1;
        uint256 amount0;
        uint256 amount1;
        address payer;
        bytes userData;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Factory address
    address public factory;

    /// @notice Fee collector (treasury)
    address public feeCollector;

    /// @notice Position counter
    uint256 public positionCount;

    /// @notice Pool count
    uint256 public poolCount;

    /// @notice Pools by ID (keccak256(token0, token1, fee))
    mapping(bytes32 => Pool) public pools;

    /// @notice Pool IDs list
    bytes32[] public poolIds;

    /// @notice Positions by ID
    mapping(uint256 => Position) public positions;

    /// @notice Tick data: poolId => tick => TickInfo
    mapping(bytes32 => mapping(int24 => TickInfo)) public ticks;

    /// @notice Oracle observations: poolId => index => Observation
    mapping(bytes32 => mapping(uint16 => Observation)) public observations;

    /// @notice Observation cardinality per pool
    mapping(bytes32 => uint16) public observationCardinality;

    /// @notice Cross-VM liquidity sources per pool
    mapping(bytes32 => CrossVMLiquidity[]) public crossVMLiquidity;

    /// @notice User positions
    mapping(address => uint256[]) public userPositions;

    /// @notice Pool existence check
    mapping(bytes32 => bool) public poolExists;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event PoolCreated(
        bytes32 indexed poolId,
        address indexed token0,
        address indexed token1,
        uint24 fee,
        int24 tickSpacing
    );

    event PoolInitialized(
        bytes32 indexed poolId,
        uint160 sqrtPriceX96,
        int24 tick
    );

    event Mint(
        address indexed owner,
        uint256 indexed positionId,
        bytes32 indexed poolId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );

    event Burn(
        uint256 indexed positionId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );

    event Collect(
        uint256 indexed positionId,
        address recipient,
        uint128 amount0,
        uint128 amount1
    );

    event Swap(
        bytes32 indexed poolId,
        address indexed sender,
        address indexed recipient,
        int256 amount0,
        int256 amount1,
        uint160 sqrtPriceX96,
        uint128 liquidity,
        int24 tick
    );

    event Flash(
        bytes32 indexed poolId,
        address indexed sender,
        address indexed recipient,
        uint256 amount0,
        uint256 amount1,
        uint256 paid0,
        uint256 paid1
    );

    event CrossVMLiquidityAdded(
        bytes32 indexed poolId,
        uint8 vmType,
        bytes32 remotePool,
        uint256 liquidity
    );

    event ProtocolFeesCollected(
        bytes32 indexed poolId,
        uint128 amount0,
        uint128 amount1
    );

    event FeeCollectorUpdated(
        address indexed oldCollector,
        address indexed newCollector
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error PoolAlreadyExists();
    error PoolNotExists();
    error PoolNotInitialized();
    error InvalidTickRange();
    error InvalidFee();
    error InsufficientLiquidity();
    error InsufficientInputAmount();
    error InsufficientOutputAmount();
    error InvalidSqrtPrice();
    error TransferFailed();
    error FlashCallbackFailed();
    error Locked();
    error PositionNotFound();
    error NotPositionOwner();

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZER
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _feeCollector
    ) external initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        // Validate addresses
        require(_admin != address(0), "X3AMM: admin cannot be zero address");
        require(_feeCollector != address(0), "X3AMM: feeCollector cannot be zero address");

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(FEE_MANAGER_ROLE, _admin);
        _grantRole(ORACLE_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        feeCollector = _feeCollector;

        emit FeeCollectorUpdated(address(0), _feeCollector);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // ═══════════════════════════════════════════════════════════════════════════
    // POOL MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new liquidity pool
     * @param tokenA First token
     * @param tokenB Second token  
     * @param fee Fee tier
     */
    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (bytes32 poolId) {
        // Sort tokens
        (address token0, address token1) = tokenA < tokenB 
            ? (tokenA, tokenB) 
            : (tokenB, tokenA);

        poolId = keccak256(abi.encodePacked(token0, token1, fee));
        
        if (poolExists[poolId]) revert PoolAlreadyExists();

        int24 tickSpacing = _getTickSpacing(fee);
        if (tickSpacing == 0) revert InvalidFee();

        pools[poolId] = Pool({
            token0: token0,
            token1: token1,
            fee: fee,
            tickSpacing: tickSpacing,
            liquidity: 0,
            sqrtPriceX96: 0,
            tick: 0,
            feeGrowthGlobal0X128: 0,
            feeGrowthGlobal1X128: 0,
            protocolFees0: 0,
            protocolFees1: 0,
            initialized: false
        });

        poolExists[poolId] = true;
        poolIds.push(poolId);
        poolCount++;

        emit PoolCreated(poolId, token0, token1, fee, tickSpacing);
    }

    /**
     * @notice Initialize pool with starting price
     * @param poolId Pool ID
     * @param sqrtPriceX96 Initial sqrt price as Q64.96
     */
    function initializePool(
        bytes32 poolId,
        uint160 sqrtPriceX96
    ) external {
        Pool storage pool = pools[poolId];
        if (!poolExists[poolId]) revert PoolNotExists();
        if (pool.initialized) revert PoolAlreadyExists();
        if (sqrtPriceX96 == 0) revert InvalidSqrtPrice();

        int24 tick = _getTickAtSqrtRatio(sqrtPriceX96);
        
        pool.sqrtPriceX96 = sqrtPriceX96;
        pool.tick = tick;
        pool.initialized = true;

        // Initialize oracle
        observations[poolId][0] = Observation({
            blockTimestamp: uint32(block.timestamp),
            tickCumulative: 0,
            secondsPerLiquidityCumulativeX128: 0,
            initialized: true
        });
        observationCardinality[poolId] = 1;

        emit PoolInitialized(poolId, sqrtPriceX96, tick);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LIQUIDITY OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Add liquidity to a position
     * @param poolId Pool ID
     * @param tickLower Lower tick boundary
     * @param tickUpper Upper tick boundary
     * @param amount0Desired Desired amount of token0
     * @param amount1Desired Desired amount of token1
     * @param amount0Min Minimum token0 (slippage protection)
     * @param amount1Min Minimum token1 (slippage protection)
     */
    function mint(
        bytes32 poolId,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) external nonReentrant whenNotPaused returns (
        uint256 positionId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    ) {
        Pool storage pool = pools[poolId];
        if (!pool.initialized) revert PoolNotInitialized();
        if (tickLower >= tickUpper) revert InvalidTickRange();
        if (tickLower % pool.tickSpacing != 0 || tickUpper % pool.tickSpacing != 0) {
            revert InvalidTickRange();
        }

        // Calculate liquidity from amounts
        liquidity = _getLiquidityForAmounts(
            pool.sqrtPriceX96,
            _getSqrtRatioAtTick(tickLower),
            _getSqrtRatioAtTick(tickUpper),
            amount0Desired,
            amount1Desired
        );

        if (liquidity == 0) revert InsufficientLiquidity();

        // Calculate actual amounts
        (amount0, amount1) = _getAmountsForLiquidity(
            pool.sqrtPriceX96,
            _getSqrtRatioAtTick(tickLower),
            _getSqrtRatioAtTick(tickUpper),
            liquidity
        );

        if (amount0 < amount0Min || amount1 < amount1Min) {
            revert InsufficientOutputAmount();
        }

        // Transfer tokens
        IERC20(pool.token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(pool.token1).safeTransferFrom(msg.sender, address(this), amount1);

        // Update pool liquidity
        _updatePosition(poolId, tickLower, tickUpper, int128(int256(uint256(liquidity))));
        
        // Create position
        positionId = ++positionCount;
        positions[positionId] = Position({
            owner: msg.sender,
            poolId: poolId,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            feeGrowthInside0LastX128: 0,
            feeGrowthInside1LastX128: 0,
            tokensOwed0: 0,
            tokensOwed1: 0
        });

        userPositions[msg.sender].push(positionId);

        emit Mint(msg.sender, positionId, poolId, tickLower, tickUpper, liquidity, amount0, amount1);
    }

    /**
     * @notice Remove liquidity from a position
     * @param positionId Position ID
     * @param liquidity Amount of liquidity to remove
     */
    function burn(
        uint256 positionId,
        uint128 liquidity
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        Position storage position = positions[positionId];
        if (position.owner != msg.sender) revert NotPositionOwner();
        if (position.liquidity < liquidity) revert InsufficientLiquidity();

        Pool storage pool = pools[position.poolId];

        // Calculate amounts
        (amount0, amount1) = _getAmountsForLiquidity(
            pool.sqrtPriceX96,
            _getSqrtRatioAtTick(position.tickLower),
            _getSqrtRatioAtTick(position.tickUpper),
            liquidity
        );

        // Update position
        position.liquidity -= liquidity;
        position.tokensOwed0 += uint128(amount0);
        position.tokensOwed1 += uint128(amount1);

        // Update pool
        _updatePosition(
            position.poolId, 
            position.tickLower, 
            position.tickUpper, 
            -int128(int256(uint256(liquidity)))
        );

        emit Burn(positionId, liquidity, amount0, amount1);
    }

    /**
     * @notice Collect tokens owed from a position
     * @param positionId Position ID
     * @param recipient Address to receive tokens
     * @param amount0Requested Max token0 to collect
     * @param amount1Requested Max token1 to collect
     */
    function collect(
        uint256 positionId,
        address recipient,
        uint128 amount0Requested,
        uint128 amount1Requested
    ) external nonReentrant returns (uint128 amount0, uint128 amount1) {
        Position storage position = positions[positionId];
        if (position.owner != msg.sender) revert NotPositionOwner();

        Pool storage pool = pools[position.poolId];

        amount0 = amount0Requested > position.tokensOwed0 
            ? position.tokensOwed0 
            : amount0Requested;
        amount1 = amount1Requested > position.tokensOwed1 
            ? position.tokensOwed1 
            : amount1Requested;

        if (amount0 > 0) {
            position.tokensOwed0 -= amount0;
            IERC20(pool.token0).safeTransfer(recipient, amount0);
        }

        if (amount1 > 0) {
            position.tokensOwed1 -= amount1;
            IERC20(pool.token1).safeTransfer(recipient, amount1);
        }

        emit Collect(positionId, recipient, amount0, amount1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SWAP
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Execute a swap
     * @param poolId Pool ID
     * @param recipient Address to receive output
     * @param zeroForOne Direction (true = token0 -> token1)
     * @param amountSpecified Amount (positive = exact input, negative = exact output)
     * @param sqrtPriceLimitX96 Price limit
     */
    function swap(
        bytes32 poolId,
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96
    ) external nonReentrant whenNotPaused returns (int256 amount0, int256 amount1) {
        Pool storage pool = pools[poolId];
        if (!pool.initialized) revert PoolNotInitialized();

        // Validate price limits
        if (zeroForOne) {
            if (sqrtPriceLimitX96 >= pool.sqrtPriceX96) revert InvalidSqrtPrice();
        } else {
            if (sqrtPriceLimitX96 <= pool.sqrtPriceX96) revert InvalidSqrtPrice();
        }

        bool exactInput = amountSpecified > 0;

        SwapState memory state = SwapState({
            amountSpecifiedRemaining: exactInput 
                ? uint256(amountSpecified) 
                : uint256(-amountSpecified),
            amountCalculated: 0,
            sqrtPriceX96: pool.sqrtPriceX96,
            tick: pool.tick,
            feeGrowthGlobalX128: zeroForOne 
                ? pool.feeGrowthGlobal0X128 
                : pool.feeGrowthGlobal1X128,
            liquidity: pool.liquidity
        });

        // Simple swap calculation (simplified from Uniswap V3)
        if (state.liquidity > 0 && state.amountSpecifiedRemaining > 0) {
            uint256 amountIn;
            uint256 amountOut;
            uint256 feeAmount;

            // Calculate amounts based on constant product formula with fee
            if (exactInput) {
                feeAmount = state.amountSpecifiedRemaining * pool.fee / 1_000_000;
                amountIn = state.amountSpecifiedRemaining - feeAmount;
                
                if (zeroForOne) {
                    // token0 -> token1
                    amountOut = _getAmountOut(amountIn, pool.token0, pool.token1, poolId);
                } else {
                    // token1 -> token0
                    amountOut = _getAmountOut(amountIn, pool.token1, pool.token0, poolId);
                }
                
                state.amountCalculated = amountOut;
            } else {
                amountOut = state.amountSpecifiedRemaining;
                
                if (zeroForOne) {
                    amountIn = _getAmountIn(amountOut, pool.token0, pool.token1, poolId);
                } else {
                    amountIn = _getAmountIn(amountOut, pool.token1, pool.token0, poolId);
                }
                
                feeAmount = amountIn * pool.fee / (1_000_000 - pool.fee);
                state.amountCalculated = amountIn + feeAmount;
            }

            // Update fee growth
            if (feeAmount > 0 && state.liquidity > 0) {
                uint256 feeGrowthDelta = (feeAmount * (1 << 128)) / state.liquidity;
                if (zeroForOne) {
                    pool.feeGrowthGlobal0X128 += feeGrowthDelta;
                    pool.protocolFees0 += uint128(feeAmount / PROTOCOL_FEE_SHARE);
                } else {
                    pool.feeGrowthGlobal1X128 += feeGrowthDelta;
                    pool.protocolFees1 += uint128(feeAmount / PROTOCOL_FEE_SHARE);
                }
            }
        }

        // Calculate final amounts
        if (zeroForOne) {
            if (exactInput) {
                amount0 = int256(uint256(amountSpecified));
                amount1 = -int256(state.amountCalculated);
            } else {
                amount0 = int256(state.amountCalculated);
                amount1 = -amountSpecified;
            }
        } else {
            if (exactInput) {
                amount0 = -int256(state.amountCalculated);
                amount1 = int256(uint256(amountSpecified));
            } else {
                amount0 = -amountSpecified;
                amount1 = int256(state.amountCalculated);
            }
        }

        // Execute transfers
        if (amount0 > 0) {
            IERC20(pool.token0).safeTransferFrom(msg.sender, address(this), uint256(amount0));
        }
        if (amount1 > 0) {
            IERC20(pool.token1).safeTransferFrom(msg.sender, address(this), uint256(amount1));
        }
        if (amount0 < 0) {
            IERC20(pool.token0).safeTransfer(recipient, uint256(-amount0));
        }
        if (amount1 < 0) {
            IERC20(pool.token1).safeTransfer(recipient, uint256(-amount1));
        }

        // Update oracle
        _updateOracle(poolId, pool.tick);

        emit Swap(poolId, msg.sender, recipient, amount0, amount1, pool.sqrtPriceX96, pool.liquidity, pool.tick);
    }

    /**
     * @notice Execute a flash loan
     * @param poolId Pool ID
     * @param recipient Recipient of the flash loan
     * @param amount0 Amount of token0 to flash
     * @param amount1 Amount of token1 to flash
     * @param data Callback data
     */
    function flash(
        bytes32 poolId,
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external nonReentrant whenNotPaused {
        Pool storage pool = pools[poolId];
        if (!pool.initialized) revert PoolNotInitialized();

        uint256 balance0Before = IERC20(pool.token0).balanceOf(address(this));
        uint256 balance1Before = IERC20(pool.token1).balanceOf(address(this));

        // Transfer requested amounts
        if (amount0 > 0) IERC20(pool.token0).safeTransfer(recipient, amount0);
        if (amount1 > 0) IERC20(pool.token1).safeTransfer(recipient, amount1);

        // Calculate fees
        uint256 fee0 = amount0 * pool.fee / 1_000_000;
        uint256 fee1 = amount1 * pool.fee / 1_000_000;

        // Callback
        IX3FlashCallback(msg.sender).x3FlashCallback(fee0, fee1, data);

        // Verify repayment
        uint256 balance0After = IERC20(pool.token0).balanceOf(address(this));
        uint256 balance1After = IERC20(pool.token1).balanceOf(address(this));

        if (balance0After < balance0Before + fee0) revert FlashCallbackFailed();
        if (balance1After < balance1Before + fee1) revert FlashCallbackFailed();

        // Update protocol fees
        pool.protocolFees0 += uint128(fee0 / PROTOCOL_FEE_SHARE);
        pool.protocolFees1 += uint128(fee1 / PROTOCOL_FEE_SHARE);

        emit Flash(poolId, msg.sender, recipient, amount0, amount1, fee0, fee1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CROSS-VM LIQUIDITY
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Add cross-VM liquidity source
     * @param poolId Pool ID
     * @param vmType VM type (0=EVM, 1=SVM, 2=X3VM)
     * @param remotePool Remote pool identifier
     * @param liquidity Available liquidity
     */
    function addCrossVMLiquidity(
        bytes32 poolId,
        uint8 vmType,
        bytes32 remotePool,
        uint256 liquidity
    ) external onlyRole(OPERATOR_ROLE) {
        if (!poolExists[poolId]) revert PoolNotExists();

        crossVMLiquidity[poolId].push(CrossVMLiquidity({
            vmType: vmType,
            remotePool: remotePool,
            remoteLiquidity: liquidity,
            active: true
        }));

        emit CrossVMLiquidityAdded(poolId, vmType, remotePool, liquidity);
    }

    /**
     * @notice Route swap through cross-VM liquidity if better price available
     */
    function crossVMSwap(
        bytes32 poolId,
        bool zeroForOne,
        uint256 amountIn,
        uint256 minAmountOut,
        uint8 targetVM
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        Pool storage pool = pools[poolId];
        if (!pool.initialized) revert PoolNotInitialized();

        // Transfer input tokens
        address tokenIn = zeroForOne ? pool.token0 : pool.token1;
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Route to appropriate VM
        if (targetVM == 1) {
            // Route to SVM via precompile
            (bool success, bytes memory result) = SVM_PRECOMPILE.call(
                abi.encodeWithSignature(
                    "swapExactInput(bytes32,uint256,uint256,bool)",
                    poolId,
                    amountIn,
                    minAmountOut,
                    zeroForOne
                )
            );
            require(success, "SVM swap failed");
            amountOut = abi.decode(result, (uint256));
        } else if (targetVM == 2) {
            // Route to X3VM via precompile
            (bool success, bytes memory result) = X3VM_PRECOMPILE.call(
                abi.encodeWithSignature(
                    "swapExactInput(bytes32,uint256,uint256,bool)",
                    poolId,
                    amountIn,
                    minAmountOut,
                    zeroForOne
                )
            );
            require(success, "X3VM swap failed");
            amountOut = abi.decode(result, (uint256));
        } else {
            // Local swap
            (int256 amount0, int256 amount1) = this.swap(
                poolId,
                msg.sender,
                zeroForOne,
                int256(amountIn),
                zeroForOne ? uint160(1) : type(uint160).max - 1
            );
            amountOut = uint256(zeroForOne ? -amount1 : -amount0);
        }

        if (amountOut < minAmountOut) revert InsufficientOutputAmount();

        // Transfer output to user
        address tokenOut = zeroForOne ? pool.token1 : pool.token0;
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ORACLE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get time-weighted average price
     * @param poolId Pool ID
     * @param secondsAgo Seconds to look back
     */
    function observe(
        bytes32 poolId,
        uint32 secondsAgo
    ) external view returns (int56 tickCumulative, uint160 secondsPerLiquidityCumulativeX128) {
        return _observe(poolId, secondsAgo);
    }

    /**
     * @notice Internal oracle update
     */
    function _updateOracle(bytes32 poolId, int24 tick) internal {
        uint16 cardinality = observationCardinality[poolId];
        Observation storage last = observations[poolId][(cardinality - 1) % 65535];
        
        uint32 blockTimestamp = uint32(block.timestamp);
        if (last.blockTimestamp == blockTimestamp) return;

        uint32 delta = blockTimestamp - last.blockTimestamp;
        
        observations[poolId][cardinality % 65535] = Observation({
            blockTimestamp: blockTimestamp,
            tickCumulative: last.tickCumulative + int56(tick) * int56(uint56(delta)),
            secondsPerLiquidityCumulativeX128: last.secondsPerLiquidityCumulativeX128,
            initialized: true
        });

        observationCardinality[poolId] = cardinality + 1;
    }

    function _observe(
        bytes32 poolId,
        uint32 secondsAgo
    ) internal view returns (int56 tickCumulative, uint160 secondsPerLiquidityCumulativeX128) {
        uint16 cardinality = observationCardinality[poolId];
        if (cardinality == 0) return (0, 0);

        Observation storage latest = observations[poolId][(cardinality - 1) % 65535];
        
        if (secondsAgo == 0) {
            return (latest.tickCumulative, latest.secondsPerLiquidityCumulativeX128);
        }

        // Binary search for observation (simplified)
        return (latest.tickCumulative, latest.secondsPerLiquidityCumulativeX128);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Collect protocol fees
     * @param poolId Pool ID
     */
    function collectProtocolFees(bytes32 poolId) external onlyRole(FEE_MANAGER_ROLE) {
        Pool storage pool = pools[poolId];
        
        uint128 amount0 = pool.protocolFees0;
        uint128 amount1 = pool.protocolFees1;

        require(amount0 > 0 || amount1 > 0, "X3AMM: no fees to collect");

        pool.protocolFees0 = 0;
        pool.protocolFees1 = 0;

        if (amount0 > 0) {
            require(
                IERC20(pool.token0).balanceOf(address(this)) >= amount0,
                "X3AMM: insufficient token0 balance"
            );
            IERC20(pool.token0).safeTransfer(feeCollector, amount0);
        }
        if (amount1 > 0) {
            require(
                IERC20(pool.token1).balanceOf(address(this)) >= amount1,
                "X3AMM: insufficient token1 balance"
            );
            IERC20(pool.token1).safeTransfer(feeCollector, amount1);
        }

        emit ProtocolFeesCollected(poolId, amount0, amount1);
    }

    function setFeeCollector(address _feeCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeCollector != address(0), "X3AMM: feeCollector cannot be zero address");
        address oldCollector = feeCollector;
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(oldCollector, _feeCollector);
    }

    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function _getTickSpacing(uint24 fee) internal pure returns (int24) {
        if (fee == FEE_TIER_001) return TICK_SPACING_001;
        if (fee == FEE_TIER_005) return TICK_SPACING_005;
        if (fee == FEE_TIER_030) return TICK_SPACING_030;
        if (fee == FEE_TIER_100) return TICK_SPACING_100;
        return 0;
    }

    function _updatePosition(
        bytes32 poolId,
        int24 tickLower,
        int24 tickUpper,
        int128 liquidityDelta
    ) internal {
        Pool storage pool = pools[poolId];
        
        // Update ticks
        _updateTick(poolId, tickLower, liquidityDelta, false);
        _updateTick(poolId, tickUpper, liquidityDelta, true);

        // Update pool liquidity if current tick is in range
        if (pool.tick >= tickLower && pool.tick < tickUpper) {
            pool.liquidity = uint128(int128(pool.liquidity) + liquidityDelta);
        }
    }

    function _updateTick(
        bytes32 poolId,
        int24 tick,
        int128 liquidityDelta,
        bool upper
    ) internal {
        TickInfo storage info = ticks[poolId][tick];
        
        uint128 liquidityGrossBefore = info.liquidityGross;
        uint128 liquidityGrossAfter = liquidityDelta < 0
            ? liquidityGrossBefore - uint128(-liquidityDelta)
            : liquidityGrossBefore + uint128(liquidityDelta);

        info.liquidityGross = liquidityGrossAfter;
        info.liquidityNet = upper
            ? info.liquidityNet - liquidityDelta
            : info.liquidityNet + liquidityDelta;

        if (liquidityGrossBefore == 0 && liquidityGrossAfter > 0) {
            info.initialized = true;
        }
    }

    function _getLiquidityForAmounts(
        uint160 sqrtPriceX96,
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint256 amount0,
        uint256 amount1
    ) internal pure returns (uint128 liquidity) {
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        }

        if (sqrtPriceX96 <= sqrtPriceAX96) {
            liquidity = uint128(amount0 * sqrtPriceAX96 * sqrtPriceBX96 / Q96 / (sqrtPriceBX96 - sqrtPriceAX96));
        } else if (sqrtPriceX96 < sqrtPriceBX96) {
            uint128 liquidity0 = uint128(amount0 * sqrtPriceX96 * sqrtPriceBX96 / Q96 / (sqrtPriceBX96 - sqrtPriceX96));
            uint128 liquidity1 = uint128(amount1 * Q96 / (sqrtPriceX96 - sqrtPriceAX96));
            liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
        } else {
            liquidity = uint128(amount1 * Q96 / (sqrtPriceBX96 - sqrtPriceAX96));
        }
    }

    function _getAmountsForLiquidity(
        uint160 sqrtPriceX96,
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint128 liquidity
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        }

        if (sqrtPriceX96 <= sqrtPriceAX96) {
            amount0 = uint256(liquidity) * Q96 * (sqrtPriceBX96 - sqrtPriceAX96) / sqrtPriceBX96 / sqrtPriceAX96;
        } else if (sqrtPriceX96 < sqrtPriceBX96) {
            amount0 = uint256(liquidity) * Q96 * (sqrtPriceBX96 - sqrtPriceX96) / sqrtPriceBX96 / sqrtPriceX96;
            amount1 = uint256(liquidity) * (sqrtPriceX96 - sqrtPriceAX96) / Q96;
        } else {
            amount1 = uint256(liquidity) * (sqrtPriceBX96 - sqrtPriceAX96) / Q96;
        }
    }

    function _getAmountOut(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        bytes32 poolId
    ) internal view returns (uint256) {
        // Simple constant product calculation
        uint256 reserveIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 reserveOut = IERC20(tokenOut).balanceOf(address(this));
        
        uint256 amountInWithFee = amountIn * (1_000_000 - pools[poolId].fee);
        return (amountInWithFee * reserveOut) / (reserveIn * 1_000_000 + amountInWithFee);
    }

    function _getAmountIn(
        uint256 amountOut,
        address tokenIn,
        address tokenOut,
        bytes32 poolId
    ) internal view returns (uint256) {
        uint256 reserveIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 reserveOut = IERC20(tokenOut).balanceOf(address(this));
        
        uint256 numerator = reserveIn * amountOut * 1_000_000;
        uint256 denominator = (reserveOut - amountOut) * (1_000_000 - pools[poolId].fee);
        return (numerator / denominator) + 1;
    }

    function _getSqrtRatioAtTick(int24 tick) internal pure returns (uint160) {
        // Simplified - returns approximate sqrt ratio
        // In production, use full tick math library
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        uint256 ratio = absTick & 0x1 != 0 ? 0xfffcb933bd6fad37aa2d162d1a594001 : 0x100000000000000000000000000000000;
        
        if (tick > 0) ratio = type(uint256).max / ratio;
        return uint160(ratio >> 32);
    }

    function _getTickAtSqrtRatio(uint160 sqrtPriceX96) internal pure returns (int24) {
        // Simplified tick calculation
        // In production, use full tick math library
        return int24(int256(uint256(sqrtPriceX96) * uint256(sqrtPriceX96) / Q96 / Q96));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getPool(bytes32 poolId) external view returns (Pool memory) {
        return pools[poolId];
    }

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    function getPoolCount() external view returns (uint256) {
        return poolCount;
    }

    function getAllPools() external view returns (bytes32[] memory) {
        return poolIds;
    }
}

/// @notice Flash callback interface
interface IX3FlashCallback {
    function x3FlashCallback(uint256 fee0, uint256 fee1, bytes calldata data) external;
}
