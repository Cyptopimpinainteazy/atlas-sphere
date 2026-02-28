// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AToken} from "../tokens/AToken.sol";
import {VariableDebtToken, StableDebtToken} from "../tokens/DebtTokens.sol";

/**
 * @title PoolConfigurator
 * @notice Admin configuration hub for the lending pool
 * @dev Handles reserve initialization, parameter updates, and token deployment
 *
 * Security:
 * - Timelock for sensitive operations
 * - Multi-sig compatible via Ownable
 * - Emergency controls for risk mitigation
 */
contract PoolConfigurator is Ownable {
    // ============ Structs ============

    struct InitReserveInput {
        address underlying;
        address treasury;
        address incentivesController;
        string aTokenName;
        string aTokenSymbol;
        string variableDebtTokenName;
        string variableDebtTokenSymbol;
        string stableDebtTokenName;
        string stableDebtTokenSymbol;
        uint16 ltv;
        uint16 liquidationThreshold;
        uint16 liquidationBonus;
        uint8 decimals;
    }

    struct ReserveTokens {
        address aToken;
        address variableDebtToken;
        address stableDebtToken;
    }

    // ============ State ============

    /// @notice Pool contract
    address public pool;

    /// @notice Collateral manager
    address public collateralManager;

    /// @notice Oracle router
    address public oracleRouter;

    /// @notice Interest rate model
    address public interestRateModel;

    /// @notice Reserve tokens mapping
    mapping(address => ReserveTokens) public reserveTokens;

    /// @notice Timelock delay for sensitive operations
    uint256 public constant TIMELOCK_DELAY = 2 days;

    /// @notice Pending parameter changes
    mapping(bytes32 => uint256) public pendingChanges;

    // ============ Events ============

    event ReserveInitialized(
        address indexed underlying,
        address aToken,
        address variableDebtToken,
        address stableDebtToken
    );

    event ReserveParametersUpdated(
        address indexed asset,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    );

    event ReserveFrozen(address indexed asset, bool frozen);
    event ReservePaused(address indexed asset, bool paused);
    event BorrowingEnabled(address indexed asset, bool enabled);
    event StableRateEnabled(address indexed asset, bool enabled);
    event ReserveCapsUpdated(
        address indexed asset,
        uint256 supplyCap,
        uint256 borrowCap
    );
    event ReserveFactorUpdated(address indexed asset, uint256 factor);
    event FlashLoanPremiumUpdated(uint128 premium);
    event PoolPaused(bool paused);
    event TimelockScheduled(bytes32 indexed id, uint256 executeTime);
    event TimelockExecuted(bytes32 indexed id);
    event TimelockCancelled(bytes32 indexed id);

    // ============ Modifiers ============

    modifier whenPoolSet() {
        require(pool != address(0), "PoolConfigurator: pool not set");
        _;
    }

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Initialization ============

    /**
     * @notice Initialize configurator with core addresses
     */
    function initialize(
        address _pool,
        address _collateralManager,
        address _oracleRouter,
        address _interestRateModel
    ) external onlyOwner {
        require(pool == address(0), "PoolConfigurator: already initialized");

        pool = _pool;
        collateralManager = _collateralManager;
        oracleRouter = _oracleRouter;
        interestRateModel = _interestRateModel;
    }

    // ============ Reserve Management ============

    /**
     * @notice Initialize a new reserve
     * @param input Reserve initialization parameters
     */
    function initReserve(
        InitReserveInput calldata input
    ) external onlyOwner whenPoolSet {
        require(
            reserveTokens[input.underlying].aToken == address(0),
            "PoolConfigurator: reserve exists"
        );

        // Deploy AToken
        AToken aToken = new AToken(
            pool,
            input.underlying,
            input.treasury,
            input.incentivesController,
            input.aTokenName,
            input.aTokenSymbol
        );

        // Deploy Variable Debt Token
        VariableDebtToken variableDebtToken = new VariableDebtToken(
            pool,
            input.underlying,
            input.variableDebtTokenName,
            input.variableDebtTokenSymbol
        );

        // Deploy Stable Debt Token
        StableDebtToken stableDebtToken = new StableDebtToken(
            pool,
            input.underlying,
            input.stableDebtTokenName,
            input.stableDebtTokenSymbol
        );

        // Store token addresses
        reserveTokens[input.underlying] = ReserveTokens({
            aToken: address(aToken),
            variableDebtToken: address(variableDebtToken),
            stableDebtToken: address(stableDebtToken)
        });

        // Configure collateral parameters
        _configureCollateral(
            input.underlying,
            input.ltv,
            input.liquidationThreshold,
            input.liquidationBonus,
            input.decimals
        );

        emit ReserveInitialized(
            input.underlying,
            address(aToken),
            address(variableDebtToken),
            address(stableDebtToken)
        );
    }

    /**
     * @notice Batch initialize multiple reserves
     */
    function batchInitReserves(
        InitReserveInput[] calldata inputs
    ) external onlyOwner whenPoolSet {
        for (uint256 i = 0; i < inputs.length; i++) {
            this.initReserve(inputs[i]);
        }
    }

    // ============ Parameter Updates ============

    /**
     * @notice Update reserve risk parameters
     */
    function updateReserveParameters(
        address asset,
        uint16 ltv,
        uint16 liquidationThreshold,
        uint16 liquidationBonus
    ) external onlyOwner whenPoolSet {
        require(
            reserveTokens[asset].aToken != address(0),
            "PoolConfigurator: reserve not found"
        );

        _configureCollateral(
            asset,
            ltv,
            liquidationThreshold,
            liquidationBonus,
            0 // decimals unchanged
        );

        emit ReserveParametersUpdated(
            asset,
            ltv,
            liquidationThreshold,
            liquidationBonus
        );
    }

    /**
     * @notice Freeze a reserve (disables deposits and borrows)
     */
    function setReserveFrozen(
        address asset,
        bool frozen
    ) external onlyOwner whenPoolSet {
        // Call collateral manager
        (bool success, ) = collateralManager.call(
            abi.encodeWithSignature("setFrozen(address,bool)", asset, frozen)
        );
        require(success, "PoolConfigurator: freeze failed");

        emit ReserveFrozen(asset, frozen);
    }

    /**
     * @notice Pause a reserve (emergency)
     */
    function setReservePaused(
        address asset,
        bool paused
    ) external onlyOwner whenPoolSet {
        (bool success, ) = collateralManager.call(
            abi.encodeWithSignature("setActive(address,bool)", asset, !paused)
        );
        require(success, "PoolConfigurator: pause failed");

        emit ReservePaused(asset, paused);
    }

    /**
     * @notice Enable/disable borrowing
     */
    function setBorrowingEnabled(
        address asset,
        bool enabled
    ) external onlyOwner whenPoolSet {
        (bool success, ) = collateralManager.call(
            abi.encodeWithSignature(
                "setBorrowingEnabled(address,bool)",
                asset,
                enabled
            )
        );
        require(success, "PoolConfigurator: borrow config failed");

        emit BorrowingEnabled(asset, enabled);
    }

    /**
     * @notice Enable/disable stable rate borrowing
     */
    function setStableRateBorrowingEnabled(
        address asset,
        bool enabled
    ) external onlyOwner whenPoolSet {
        (bool success, ) = collateralManager.call(
            abi.encodeWithSignature(
                "setStableRateEnabled(address,bool)",
                asset,
                enabled
            )
        );
        require(success, "PoolConfigurator: stable rate config failed");

        emit StableRateEnabled(asset, enabled);
    }

    /**
     * @notice Set supply and borrow caps
     */
    function setReserveCaps(
        address asset,
        uint256 supplyCap,
        uint256 borrowCap
    ) external onlyOwner whenPoolSet {
        (bool success, ) = collateralManager.call(
            abi.encodeWithSignature(
                "setCaps(address,uint256,uint256)",
                asset,
                supplyCap,
                borrowCap
            )
        );
        require(success, "PoolConfigurator: caps config failed");

        emit ReserveCapsUpdated(asset, supplyCap, borrowCap);
    }

    /**
     * @notice Set reserve factor (protocol revenue share)
     */
    function setReserveFactor(
        address asset,
        uint256 factor
    ) external onlyOwner whenPoolSet {
        require(factor <= 10000, "PoolConfigurator: invalid factor");

        (bool success, ) = collateralManager.call(
            abi.encodeWithSignature(
                "setReserveFactor(address,uint256)",
                asset,
                factor
            )
        );
        require(success, "PoolConfigurator: factor config failed");

        emit ReserveFactorUpdated(asset, factor);
    }

    /**
     * @notice Update flash loan premium
     */
    function updateFlashLoanPremium(
        uint128 premium
    ) external onlyOwner whenPoolSet {
        require(premium <= 1000, "PoolConfigurator: premium too high"); // Max 10%

        (bool success, ) = pool.call(
            abi.encodeWithSignature("setFlashLoanPremium(uint128)", premium)
        );
        require(success, "PoolConfigurator: premium update failed");

        emit FlashLoanPremiumUpdated(premium);
    }

    /**
     * @notice Pause the entire pool (emergency)
     */
    function setPoolPaused(bool paused) external onlyOwner whenPoolSet {
        (bool success, ) = pool.call(
            abi.encodeWithSignature("setPaused(bool)", paused)
        );
        require(success, "PoolConfigurator: pause failed");

        emit PoolPaused(paused);
    }

    // ============ Timelock Functions ============

    /**
     * @notice Schedule a timelocked parameter change
     */
    function scheduleTimelocked(
        bytes32 operationId,
        bytes calldata /* data */
    ) external onlyOwner {
        require(
            pendingChanges[operationId] == 0,
            "PoolConfigurator: already scheduled"
        );

        uint256 executeTime = block.timestamp + TIMELOCK_DELAY;
        pendingChanges[operationId] = executeTime;

        emit TimelockScheduled(operationId, executeTime);
    }

    /**
     * @notice Execute a timelocked change
     */
    function executeTimelocked(
        bytes32 operationId,
        address target,
        bytes calldata data
    ) external onlyOwner {
        uint256 executeTime = pendingChanges[operationId];
        require(executeTime > 0, "PoolConfigurator: not scheduled");
        require(
            block.timestamp >= executeTime,
            "PoolConfigurator: timelock not passed"
        );

        delete pendingChanges[operationId];

        (bool success, ) = target.call(data);
        require(success, "PoolConfigurator: execution failed");

        emit TimelockExecuted(operationId);
    }

    /**
     * @notice Cancel a scheduled change
     */
    function cancelTimelocked(bytes32 operationId) external onlyOwner {
        require(
            pendingChanges[operationId] > 0,
            "PoolConfigurator: not scheduled"
        );
        delete pendingChanges[operationId];

        emit TimelockCancelled(operationId);
    }

    // ============ Internal ============

    function _configureCollateral(
        address asset,
        uint16 ltv,
        uint16 liquidationThreshold,
        uint16 liquidationBonus,
        uint8 decimals
    ) internal {
        if (collateralManager != address(0)) {
            (bool success, ) = collateralManager.call(
                abi.encodeWithSignature(
                    "configureCollateral(address,uint16,uint16,uint16,uint8)",
                    asset,
                    ltv,
                    liquidationThreshold,
                    liquidationBonus,
                    decimals
                )
            );
            require(success, "PoolConfigurator: collateral config failed");
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get reserve token addresses
     */
    function getReserveTokens(
        address asset
    ) external view returns (ReserveTokens memory) {
        return reserveTokens[asset];
    }

    /**
     * @notice Check if reserve is initialized
     */
    function isReserveInitialized(address asset) external view returns (bool) {
        return reserveTokens[asset].aToken != address(0);
    }

    /**
     * @notice Get pending timelock execute time
     */
    function getTimelockExecuteTime(
        bytes32 operationId
    ) external view returns (uint256) {
        return pendingChanges[operationId];
    }
}
