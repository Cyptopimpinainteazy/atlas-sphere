// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IInterestRateStrategy
 * @notice Interest rate model interface
 * @dev Implements kinked rate model with optimal utilization
 */
interface IInterestRateStrategy {
    /**
     * @notice Returns base variable borrow rate
     */
    function getBaseVariableBorrowRate() external view returns (uint256);

    /**
     * @notice Returns the max variable borrow rate
     */
    function getMaxVariableBorrowRate() external view returns (uint256);

    /**
     * @notice Calculates interest rates based on reserve state
     * @param unbacked Amount of unbacked aTokens
     * @param liquidityAdded Liquidity being added
     * @param liquidityTaken Liquidity being removed
     * @param totalStableDebt Total stable debt
     * @param totalVariableDebt Total variable debt
     * @param averageStableBorrowRate Average stable rate
     * @param reserveFactor Reserve factor (protocol fee %)
     * @param reserve Reserve address
     * @param aToken aToken address
     * @return currentLiquidityRate Supply APY
     * @return currentStableBorrowRate Stable borrow APY
     * @return currentVariableBorrowRate Variable borrow APY
     */
    function calculateInterestRates(
        uint256 unbacked,
        uint256 liquidityAdded,
        uint256 liquidityTaken,
        uint256 totalStableDebt,
        uint256 totalVariableDebt,
        uint256 averageStableBorrowRate,
        uint256 reserveFactor,
        address reserve,
        address aToken
    )
        external
        view
        returns (
            uint256 currentLiquidityRate,
            uint256 currentStableBorrowRate,
            uint256 currentVariableBorrowRate
        );
}

/**
 * @title IPriceOracle
 * @notice Price oracle interface for asset valuation
 */
interface IPriceOracle {
    /**
     * @notice Returns the asset price in base currency
     * @param asset The asset address
     * @return The price with 8 decimals
     */
    function getAssetPrice(address asset) external view returns (uint256);

    /**
     * @notice Returns prices for multiple assets
     * @param assets Array of asset addresses
     * @return Array of prices
     */
    function getAssetsPrices(
        address[] calldata assets
    ) external view returns (uint256[] memory);

    /**
     * @notice Returns the base currency unit (for USD = 1e8)
     */
    function BASE_CURRENCY_UNIT() external view returns (uint256);
}

/**
 * @title IPriceOracleGetter
 * @notice Extended oracle interface with source info
 */
interface IPriceOracleGetter is IPriceOracle {
    /**
     * @notice Returns the price source for an asset
     */
    function getSourceOfAsset(address asset) external view returns (address);

    /**
     * @notice Returns the fallback oracle
     */
    function getFallbackOracle() external view returns (address);
}

/**
 * @title IPoolConfigurator
 * @notice Pool configuration interface
 */
interface IPoolConfigurator {
    // ============ Events ============

    event ReserveInitialized(
        address indexed asset,
        address indexed aToken,
        address stableDebtToken,
        address variableDebtToken,
        address interestRateStrategyAddress
    );

    event CollateralConfigurationChanged(
        address indexed asset,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    );

    event ReserveActive(address indexed asset, bool active);
    event ReserveFrozen(address indexed asset, bool frozen);
    event ReservePaused(address indexed asset, bool paused);
    event ReserveBorrowing(address indexed asset, bool enabled);
    event ReserveStableRateBorrowing(address indexed asset, bool enabled);
    event ReserveFactorChanged(
        address indexed asset,
        uint256 oldFactor,
        uint256 newFactor
    );
    event BorrowCapChanged(
        address indexed asset,
        uint256 oldBorrowCap,
        uint256 newBorrowCap
    );
    event SupplyCapChanged(
        address indexed asset,
        uint256 oldSupplyCap,
        uint256 newSupplyCap
    );
    event LiquidationProtocolFeeChanged(
        address indexed asset,
        uint256 oldFee,
        uint256 newFee
    );
    event FlashloanPremiumTotalUpdated(uint128 oldPremium, uint128 newPremium);

    // ============ Admin Functions ============

    /**
     * @notice Initializes a new reserve
     */
    function initReserve(
        address aTokenImpl,
        address stableDebtTokenImpl,
        address variableDebtTokenImpl,
        uint8 underlyingAssetDecimals,
        address interestRateStrategyAddress,
        address underlying,
        address treasury,
        address incentivesController,
        string calldata aTokenName,
        string calldata aTokenSymbol,
        string calldata variableDebtTokenName,
        string calldata variableDebtTokenSymbol,
        string calldata stableDebtTokenName,
        string calldata stableDebtTokenSymbol,
        bytes calldata params
    ) external;

    /**
     * @notice Configures reserve as collateral
     * @param asset The reserve address
     * @param ltv Loan-to-Value (in bps, max 10000)
     * @param liquidationThreshold Liquidation threshold (in bps)
     * @param liquidationBonus Liquidation bonus (in bps, 10500 = 5% bonus)
     */
    function configureReserveAsCollateral(
        address asset,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) external;

    /**
     * @notice Sets the reserve factor (protocol fee)
     * @param asset The reserve address
     * @param newReserveFactor Reserve factor (in bps)
     */
    function setReserveFactor(address asset, uint256 newReserveFactor) external;

    /**
     * @notice Sets borrow cap (max borrows in underlying units)
     */
    function setBorrowCap(address asset, uint256 newBorrowCap) external;

    /**
     * @notice Sets supply cap (max deposits in underlying units)
     */
    function setSupplyCap(address asset, uint256 newSupplyCap) external;

    /**
     * @notice Enables/disables borrowing
     */
    function setReserveBorrowing(address asset, bool enabled) external;

    /**
     * @notice Enables/disables stable rate borrowing
     */
    function setReserveStableRateBorrowing(
        address asset,
        bool enabled
    ) external;

    /**
     * @notice Sets reserve active/inactive
     */
    function setReserveActive(address asset, bool active) external;

    /**
     * @notice Freezes/unfreezes reserve (no new deposits/borrows)
     */
    function setReserveFreeze(address asset, bool freeze) external;

    /**
     * @notice Pauses/unpauses reserve (no operations at all)
     */
    function setReservePause(address asset, bool paused) external;

    /**
     * @notice Updates the interest rate strategy
     */
    function setReserveInterestRateStrategyAddress(
        address asset,
        address newRateStrategyAddress
    ) external;
}

/**
 * @title IFlashLoanReceiver
 * @notice Interface for flash loan receivers
 */
interface IFlashLoanReceiver {
    /**
     * @notice Executes an operation after receiving flash-borrowed assets
     * @param assets The addresses of the assets being flash-borrowed
     * @param amounts The amounts being flash-borrowed
     * @param premiums The fees for each asset
     * @param initiator The msg.sender to Pool.flashLoan()
     * @param params Arbitrary bytes passed from flashLoan call
     * @return True if the operation was successful
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/**
 * @title ILiquidationCallback
 * @notice Callback interface for liquidation receivers
 */
interface ILiquidationCallback {
    /**
     * @notice Called after liquidation is executed
     * @param collateralAsset The collateral being seized
     * @param debtAsset The debt being repaid
     * @param user The liquidated user
     * @param debtToCover Amount of debt covered
     * @param liquidatedCollateral Amount of collateral received
     * @param params Arbitrary data
     */
    function onLiquidation(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        uint256 liquidatedCollateral,
        bytes calldata params
    ) external;
}
