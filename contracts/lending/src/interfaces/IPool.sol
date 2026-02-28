// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPool
 * @notice Core lending pool interface - Aave-style but X3-optimized
 * @dev All amounts use underlying token decimals
 */
interface IPool {
    // ============ Events ============

    event Deposit(
        address indexed reserve,
        address indexed user,
        address indexed onBehalfOf,
        uint256 amount,
        uint16 referralCode
    );

    event Withdraw(
        address indexed reserve,
        address indexed user,
        address indexed to,
        uint256 amount
    );

    event Borrow(
        address indexed reserve,
        address indexed user,
        address indexed onBehalfOf,
        uint256 amount,
        uint8 interestRateMode,
        uint256 borrowRate,
        uint16 referralCode
    );

    event Repay(
        address indexed reserve,
        address indexed user,
        address indexed repayer,
        uint256 amount,
        bool useATokens
    );

    event LiquidationCall(
        address indexed collateralAsset,
        address indexed debtAsset,
        address indexed user,
        uint256 debtToCover,
        uint256 liquidatedCollateralAmount,
        address liquidator,
        bool receiveAToken
    );

    event FlashLoan(
        address indexed target,
        address indexed initiator,
        address indexed asset,
        uint256 amount,
        uint8 interestRateMode,
        uint256 premium,
        uint16 referralCode
    );

    event ReserveDataUpdated(
        address indexed reserve,
        uint256 liquidityRate,
        uint256 stableBorrowRate,
        uint256 variableBorrowRate,
        uint256 liquidityIndex,
        uint256 variableBorrowIndex
    );

    // ============ Structs ============

    struct ReserveData {
        // Configuration bitmap
        uint256 configuration;
        // Liquidity index (ray)
        uint128 liquidityIndex;
        // Current supply rate (ray)
        uint128 currentLiquidityRate;
        // Variable borrow index (ray)
        uint128 variableBorrowIndex;
        // Current variable borrow rate (ray)
        uint128 currentVariableBorrowRate;
        // Current stable borrow rate (ray)
        uint128 currentStableBorrowRate;
        // Timestamp of last update
        uint40 lastUpdateTimestamp;
        // ID for the reserve
        uint16 id;
        // aToken address
        address aTokenAddress;
        // Stable debt token address
        address stableDebtTokenAddress;
        // Variable debt token address
        address variableDebtTokenAddress;
        // Interest rate strategy address
        address interestRateStrategyAddress;
        // Accumulated protocol fees
        uint128 accruedToTreasury;
        // Unbacked aTokens minted
        uint128 unbacked;
        // Isolation mode total debt
        uint128 isolationModeTotalDebt;
    }

    struct ReserveConfigurationMap {
        uint256 data;
    }

    struct UserConfigurationMap {
        uint256 data;
    }

    // ============ Core Functions ============

    /**
     * @notice Deposits an amount of underlying asset into the reserve
     * @param asset The address of the underlying asset
     * @param amount The amount to deposit
     * @param onBehalfOf The address that will receive the aTokens
     * @param referralCode Referral code for tracking
     */
    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /**
     * @notice Withdraws an amount of underlying asset from the reserve
     * @param asset The address of the underlying asset
     * @param amount The amount to withdraw (use type(uint256).max for full balance)
     * @param to Address receiving the underlying
     * @return The final amount withdrawn
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /**
     * @notice Borrows an amount of asset with variable or stable rate
     * @param asset The address of the underlying asset
     * @param amount The amount to borrow
     * @param interestRateMode 1 = Stable, 2 = Variable
     * @param referralCode Referral code
     * @param onBehalfOf Address receiving the debt (must have delegated credit)
     */
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;

    /**
     * @notice Repays a borrowed amount
     * @param asset The address of the borrowed asset
     * @param amount The amount to repay (use type(uint256).max for full debt)
     * @param interestRateMode 1 = Stable, 2 = Variable
     * @param onBehalfOf Address of the user who will get debt reduced
     * @return The final amount repaid
     */
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256);

    /**
     * @notice Liquidates a position if health factor < 1
     * @param collateralAsset The address of the collateral to liquidate
     * @param debtAsset The address of the debt to repay
     * @param user The address of the user to liquidate
     * @param debtToCover The amount of debt to cover
     * @param receiveAToken True to receive aTokens, false for underlying
     */
    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external;

    /**
     * @notice Execute a flash loan
     * @param receiverAddress The contract receiving the funds
     * @param assets Array of asset addresses
     * @param amounts Array of amounts to borrow
     * @param interestRateModes Array of rate modes (0 = no debt, 1 = stable, 2 = variable)
     * @param onBehalfOf Address receiving debt if modes != 0
     * @param params Arbitrary bytes to pass to receiver
     * @param referralCode Referral code
     */
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata interestRateModes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;

    // ============ View Functions ============

    /**
     * @notice Returns the reserve data for an asset
     */
    function getReserveData(
        address asset
    ) external view returns (ReserveData memory);

    /**
     * @notice Returns the user configuration bitmap
     */
    function getUserConfiguration(
        address user
    ) external view returns (UserConfigurationMap memory);

    /**
     * @notice Returns user account data across all reserves
     * @return totalCollateralBase Total collateral in base currency
     * @return totalDebtBase Total debt in base currency
     * @return availableBorrowsBase Available borrowing power
     * @return currentLiquidationThreshold Weighted liquidation threshold
     * @return ltv Weighted loan-to-value
     * @return healthFactor Current health factor
     */
    function getUserAccountData(
        address user
    )
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );

    /**
     * @notice Returns the normalized income (interest accumulated) for a reserve
     */
    function getReserveNormalizedIncome(
        address asset
    ) external view returns (uint256);

    /**
     * @notice Returns the normalized debt for a reserve
     */
    function getReserveNormalizedVariableDebt(
        address asset
    ) external view returns (uint256);

    /**
     * @notice Returns the list of initialized reserves
     */
    function getReservesList() external view returns (address[] memory);

    /**
     * @notice Returns the max number of reserves supported
     */
    function MAX_NUMBER_RESERVES() external view returns (uint16);

    /**
     * @notice Returns the flash loan premium (in bps)
     */
    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128);
}
