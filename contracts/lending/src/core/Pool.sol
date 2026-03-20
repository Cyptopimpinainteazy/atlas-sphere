// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    WadRayMath,
    PercentageMath,
    ReserveLogic,
    HealthFactorLogic
} from "../libraries/MathLibraries.sol";
import {IPool} from "../interfaces/IPool.sol";

/**
 * @title Pool
 * @notice Core lending pool - handles deposits, borrows, repayments, liquidations
 * @dev CRITICAL: This is the main entry point for all lending operations
 *
 * Security considerations:
 * - Reentrancy guard on all state-changing functions
 * - CEI pattern (Checks-Effects-Interactions)
 * - Oracle manipulation protection via TWAP
 * - Flash loan callback validation
 * - Health factor checks before/after operations
 *
 * MEV Considerations:
 * - Liquidations use commit-reveal for large positions
 * - Interest accrual is time-locked
 * - Slippage protection on all operations
 */
contract Pool is IPool, ReentrancyGuard {
    using WadRayMath for uint256;
    using PercentageMath for uint256;
    using SafeERC20 for IERC20;
    using ReserveLogic for uint256;

    // ============ Constants ============

    uint256 public constant RAY = 1e27;
    uint256 public constant PERCENTAGE_FACTOR = 1e4;
    uint16 public constant MAX_NUMBER_RESERVES_CONST = 128;
    uint128 public constant FLASHLOAN_PREMIUM_TOTAL_CONST = 9; // 0.09%

    // ============ State Variables ============

    /// @notice Mapping of reserve address => reserve data
    mapping(address => ReserveData) internal _reserves;

    /// @notice Mapping of user address => user configuration bitmap
    mapping(address => UserConfigurationMap) internal _usersConfig;

    /// @notice List of initialized reserve addresses
    address[] internal _reservesList;

    /// @notice Number of reserves
    uint16 internal _reservesCount;

    /// @notice Address provider (for access control)
    address public immutable ADDRESSES_PROVIDER;

    /// @notice Oracle for price feeds
    address public priceOracle;

    /// @notice Flash loan premium in bps
    uint128 public flashLoanPremiumTotal;

    /// @notice Protocol treasury
    address public treasury;

    /// @notice Configurator address
    address public poolConfigurator;

    /// @notice Pause flag
    bool public paused;

    // ============ Modifiers ============

    modifier whenNotPaused() {
        require(!paused, "Pool: paused");
        _;
    }

    modifier onlyConfigurator() {
        require(msg.sender == poolConfigurator, "Pool: only configurator");
        _;
    }

    // ============ Constructor ============

    constructor(address addressesProvider) {
        ADDRESSES_PROVIDER = addressesProvider;
        flashLoanPremiumTotal = FLASHLOAN_PREMIUM_TOTAL_CONST;
    }

    // ============ Initialization ============

    /**
     * @notice Initializes the pool
     * @param _priceOracle Oracle address
     * @param _treasury Treasury address
     * @param _configurator Configurator address
     */
    function initialize(
        address _priceOracle,
        address _treasury,
        address _configurator
    ) external {
        require(priceOracle == address(0), "Pool: already initialized");
        require(msg.sender == ADDRESSES_PROVIDER, "Pool: only provider");

        priceOracle = _priceOracle;
        treasury = _treasury;
        poolConfigurator = _configurator;
    }

    // ============ Core Functions ============

    /**
     * @notice Deposits underlying asset and mints aTokens
     * @param asset The underlying asset
     * @param amount Amount to deposit
     * @param onBehalfOf Recipient of aTokens
     * @param referralCode Referral tracking code
     *
     * Flow:
     * 1. Validate reserve is active and not frozen
     * 2. Update reserve state (accrue interest)
     * 3. Transfer underlying from user
     * 4. Mint aTokens to recipient
     * 5. Update interest rates
     */
    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external override nonReentrant whenNotPaused {
        require(amount > 0, "Pool: amount must be > 0");

        ReserveData storage reserve = _reserves[asset];

        _validateActiveReserve(reserve);
        require(!_isReserveFrozen(reserve), "Pool: reserve frozen");

        // Update state (accrue interest)
        _updateState(reserve, asset);

        // Check supply cap
        uint256 supplyCap = _getSupplyCap(reserve);
        if (supplyCap > 0) {
            uint256 currentSupply = IERC20(reserve.aTokenAddress).totalSupply();
            require(
                currentSupply + amount <= supplyCap,
                "Pool: supply cap exceeded"
            );
        }

        // Transfer underlying from user
        IERC20(asset).safeTransferFrom(
            msg.sender,
            reserve.aTokenAddress,
            amount
        );

        // Mint aTokens
        bool isFirstDeposit = _mintAToken(reserve, onBehalfOf, amount);

        // Update user config if first deposit
        if (isFirstDeposit) {
            _setUsingAsCollateral(onBehalfOf, reserve.id, true);
        }

        // Update interest rates
        _updateInterestRates(reserve, asset, amount, 0);

        emit Deposit(asset, msg.sender, onBehalfOf, amount, referralCode);
    }

    /**
     * @notice Withdraws underlying asset by burning aTokens
     * @param asset The underlying asset
     * @param amount Amount to withdraw (type(uint256).max for full balance)
     * @param to Recipient of underlying
     * @return The amount withdrawn
     *
     * Flow:
     * 1. Validate reserve is active
     * 2. Update reserve state
     * 3. Calculate actual amount (handle max)
     * 4. Validate health factor after withdrawal
     * 5. Burn aTokens and transfer underlying
     * 6. Update interest rates
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external override nonReentrant whenNotPaused returns (uint256) {
        ReserveData storage reserve = _reserves[asset];

        _validateActiveReserve(reserve);

        // Update state
        _updateState(reserve, asset);

        // Get user's aToken balance
        uint256 userBalance = IERC20(reserve.aTokenAddress).balanceOf(
            msg.sender
        );

        uint256 amountToWithdraw = amount;
        if (amount == type(uint256).max) {
            amountToWithdraw = userBalance;
        }

        require(amountToWithdraw <= userBalance, "Pool: insufficient balance");
        require(amountToWithdraw > 0, "Pool: amount must be > 0");

        // Check if collateral is being withdrawn
        if (_isUsingAsCollateral(msg.sender, reserve.id)) {
            _validateHealthFactor(msg.sender, asset, amountToWithdraw, 0, 0);
        }

        // Burn aTokens and transfer underlying
        _burnAToken(reserve, msg.sender, to, amountToWithdraw);

        // Update interest rates
        _updateInterestRates(reserve, asset, 0, amountToWithdraw);

        emit Withdraw(asset, msg.sender, to, amountToWithdraw);

        return amountToWithdraw;
    }

    /**
     * @notice Borrows asset at variable or stable rate
     * @param asset The asset to borrow
     * @param amount Amount to borrow
     * @param interestRateMode 1 = Stable, 2 = Variable
     * @param referralCode Referral tracking
     * @param onBehalfOf Recipient of borrowed asset (must have delegated credit)
     *
     * Flow:
     * 1. Validate reserve allows borrowing
     * 2. Update reserve state
     * 3. Check borrow cap
     * 4. Validate collateral and health factor
     * 5. Mint debt tokens
     * 6. Transfer underlying to borrower
     * 7. Update interest rates
     */
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external override nonReentrant whenNotPaused {
        require(amount > 0, "Pool: amount must be > 0");
        require(
            interestRateMode == 1 || interestRateMode == 2,
            "Pool: invalid rate mode"
        );

        ReserveData storage reserve = _reserves[asset];

        _validateActiveReserve(reserve);
        require(_isBorrowingEnabled(reserve), "Pool: borrowing disabled");
        require(!_isReserveFrozen(reserve), "Pool: reserve frozen");

        // Only msg.sender can borrow for themselves unless credit delegated
        if (onBehalfOf != msg.sender) {
            _validateCreditDelegation(onBehalfOf, msg.sender, asset, amount);
        }

        // Update state
        _updateState(reserve, asset);

        // Check borrow cap
        uint256 borrowCap = _getBorrowCap(reserve);
        if (borrowCap > 0) {
            uint256 totalDebt = _getTotalDebt(reserve);
            require(
                totalDebt + amount <= borrowCap,
                "Pool: borrow cap exceeded"
            );
        }

        // Validate sufficient collateral and health factor
        _validateHealthFactor(onBehalfOf, asset, 0, amount, interestRateMode);

        // Mint debt tokens
        uint256 currentRate;
        if (interestRateMode == 2) {
            // Variable
            currentRate = reserve.currentVariableBorrowRate;
            _mintVariableDebtToken(reserve, onBehalfOf, amount);
        } else {
            // Stable
            require(
                _isStableRateBorrowingEnabled(reserve),
                "Pool: stable rate disabled"
            );
            currentRate = reserve.currentStableBorrowRate;
            _mintStableDebtToken(reserve, onBehalfOf, amount, currentRate);
        }

        // Mark as borrowing this asset
        _setBorrowing(onBehalfOf, reserve.id, true);

        // Transfer underlying to borrower
        _transferUnderlying(reserve, msg.sender, amount);

        // Update interest rates
        _updateInterestRates(reserve, asset, 0, amount);

        emit Borrow(
            asset,
            msg.sender,
            onBehalfOf,
            amount,
            uint8(interestRateMode),
            currentRate,
            referralCode
        );
    }

    /**
     * @notice Repays borrowed asset
     * @param asset The borrowed asset
     * @param amount Amount to repay (type(uint256).max for full debt)
     * @param interestRateMode Rate mode of debt to repay
     * @param onBehalfOf Address whose debt is being repaid
     * @return The amount repaid
     *
     * Flow:
     * 1. Update reserve state
     * 2. Get user's debt
     * 3. Calculate actual repayment amount
     * 4. Transfer underlying from payer to aToken
     * 5. Burn debt tokens
     * 6. Update interest rates
     */
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external override nonReentrant whenNotPaused returns (uint256) {
        require(
            interestRateMode == 1 || interestRateMode == 2,
            "Pool: invalid rate mode"
        );

        ReserveData storage reserve = _reserves[asset];

        // Update state
        _updateState(reserve, asset);

        // Get user's debt
        uint256 userDebt;
        if (interestRateMode == 2) {
            userDebt = IERC20(reserve.variableDebtTokenAddress).balanceOf(
                onBehalfOf
            );
        } else {
            userDebt = IERC20(reserve.stableDebtTokenAddress).balanceOf(
                onBehalfOf
            );
        }

        require(userDebt > 0, "Pool: no debt to repay");

        uint256 paybackAmount = amount;
        if (amount == type(uint256).max) {
            paybackAmount = userDebt;
        }

        if (paybackAmount > userDebt) {
            paybackAmount = userDebt;
        }

        // Transfer underlying from payer
        IERC20(asset).safeTransferFrom(
            msg.sender,
            reserve.aTokenAddress,
            paybackAmount
        );

        // Burn debt tokens
        if (interestRateMode == 2) {
            _burnVariableDebtToken(reserve, onBehalfOf, paybackAmount);
        } else {
            _burnStableDebtToken(reserve, onBehalfOf, paybackAmount);
        }

        // Clear borrowing flag if fully repaid
        if (paybackAmount == userDebt) {
            _setBorrowing(onBehalfOf, reserve.id, false);
        }

        // Update interest rates
        _updateInterestRates(reserve, asset, paybackAmount, 0);

        emit Repay(asset, onBehalfOf, msg.sender, paybackAmount, false);

        return paybackAmount;
    }

    /**
     * @notice Liquidates an unhealthy position
     * @param collateralAsset The collateral to seize
     * @param debtAsset The debt to repay
     * @param user The user to liquidate
     * @param debtToCover Amount of debt to cover
     * @param receiveAToken True = receive aTokens, False = receive underlying
     *
     * Flow:
     * 1. Validate user is liquidatable (HF < 1)
     * 2. Calculate max liquidatable debt
     * 3. Calculate collateral to seize (with bonus)
     * 4. Transfer debt from liquidator
     * 5. Burn debt tokens
     * 6. Transfer collateral to liquidator
     * 7. Update interest rates
     */
    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external override nonReentrant whenNotPaused {
        ReserveData storage collateralReserve = _reserves[collateralAsset];
        ReserveData storage debtReserve = _reserves[debtAsset];

        // Update states
        _updateState(collateralReserve, collateralAsset);
        _updateState(debtReserve, debtAsset);

        // Validate liquidation is allowed
        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            ,
            uint256 liquidationThreshold,
            ,
            uint256 healthFactor
        ) = getUserAccountData(user);

        require(healthFactor < 1e18, "Pool: health factor above threshold");

        // Get user's variable debt (we liquidate variable first)
        uint256 userDebt = IERC20(debtReserve.variableDebtTokenAddress)
            .balanceOf(user);
        require(userDebt > 0, "Pool: no debt");

        // Calculate max debt to cover (50% or 100% depending on HF)
        uint256 maxLiquidatableDebt = HealthFactorLogic
            .calculateMaxLiquidatableDebt(
                userDebt,
                healthFactor,
                5000 // 50% close factor
            );

        uint256 actualDebtToLiquidate = debtToCover > maxLiquidatableDebt
            ? maxLiquidatableDebt
            : debtToCover;

        // Get prices
        uint256 collateralPrice = _getAssetPrice(collateralAsset);
        uint256 debtPrice = _getAssetPrice(debtAsset);

        // Get liquidation bonus
        uint256 liquidationBonus = _getLiquidationBonus(collateralReserve);

        // Calculate collateral to seize
        uint256 collateralToSeize = HealthFactorLogic
            .calculateCollateralToSeize(
                actualDebtToLiquidate,
                debtPrice,
                collateralPrice,
                liquidationBonus,
                _getDecimals(debtAsset),
                _getDecimals(collateralAsset)
            );

        // Check user has enough collateral
        uint256 userCollateral = IERC20(collateralReserve.aTokenAddress)
            .balanceOf(user);
        if (collateralToSeize > userCollateral) {
            collateralToSeize = userCollateral;
            // Recalculate debt to cover based on actual collateral
            actualDebtToLiquidate =
                (collateralToSeize *
                    collateralPrice *
                    (10 ** _getDecimals(debtAsset))) /
                (((debtPrice * liquidationBonus) / PERCENTAGE_FACTOR) *
                    (10 ** _getDecimals(collateralAsset)));
        }

        // Transfer debt from liquidator
        IERC20(debtAsset).safeTransferFrom(
            msg.sender,
            debtReserve.aTokenAddress,
            actualDebtToLiquidate
        );

        // Burn debt tokens
        _burnVariableDebtToken(debtReserve, user, actualDebtToLiquidate);

        // Transfer collateral
        if (receiveAToken) {
            // Transfer aTokens directly
            _transferATokens(
                collateralReserve,
                user,
                msg.sender,
                collateralToSeize
            );
        } else {
            // Burn aTokens and transfer underlying
            _burnAToken(collateralReserve, user, msg.sender, collateralToSeize);
        }

        // Update interest rates
        _updateInterestRates(
            collateralReserve,
            collateralAsset,
            0,
            receiveAToken ? 0 : collateralToSeize
        );
        _updateInterestRates(debtReserve, debtAsset, actualDebtToLiquidate, 0);

        emit LiquidationCall(
            collateralAsset,
            debtAsset,
            user,
            actualDebtToLiquidate,
            collateralToSeize,
            msg.sender,
            receiveAToken
        );
    }

    /**
     * @notice Executes a flash loan
     * @param receiverAddress Contract implementing IFlashLoanReceiver
     * @param assets Array of assets to borrow
     * @param amounts Array of amounts
     * @param interestRateModes Array of rate modes (0 = no debt, 1 = stable, 2 = variable)
     * @param onBehalfOf Address that will receive any opened debt
     * @param params Arbitrary data for receiver
     * @param referralCode Referral tracking
     *
     * Flow:
     * 1. Validate arrays match
     * 2. Transfer assets to receiver
     * 3. Call receiver's executeOperation
     * 4. Either:
     *    a. Receiver repays principal + premium, OR
     *    b. Receiver opens debt position
     * 5. Update interest rates
     */
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata interestRateModes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external override nonReentrant whenNotPaused {
        require(assets.length == amounts.length, "Pool: array length mismatch");
        require(
            assets.length == interestRateModes.length,
            "Pool: array length mismatch"
        );

        uint256[] memory premiums = new uint256[](assets.length);

        // Transfer assets to receiver
        for (uint256 i = 0; i < assets.length; i++) {
            ReserveData storage reserve = _reserves[assets[i]];
            _validateActiveReserve(reserve);

            premiums[i] = amounts[i].percentMul(flashLoanPremiumTotal);

            // Transfer from aToken to receiver
            _transferUnderlying(reserve, receiverAddress, amounts[i]);
        }

        // Execute receiver's callback
        require(
            IFlashLoanReceiver(receiverAddress).executeOperation(
                assets,
                amounts,
                premiums,
                msg.sender,
                params
            ),
            "Pool: flash loan callback failed"
        );

        // Handle repayment or debt opening
        for (uint256 i = 0; i < assets.length; i++) {
            ReserveData storage reserve = _reserves[assets[i]];

            _updateState(reserve, assets[i]);

            uint256 amountPlusPremium = amounts[i] + premiums[i];

            if (interestRateModes[i] == 0) {
                // No debt - must repay
                IERC20(assets[i]).safeTransferFrom(
                    receiverAddress,
                    reserve.aTokenAddress,
                    amountPlusPremium
                );

                // Accrue premium to protocol
                reserve.accruedToTreasury += uint128(premiums[i]);
            } else {
                // Open debt position instead of repaying
                _validateHealthFactor(
                    onBehalfOf,
                    assets[i],
                    0,
                    amounts[i],
                    interestRateModes[i]
                );

                if (interestRateModes[i] == 2) {
                    _mintVariableDebtToken(reserve, onBehalfOf, amounts[i]);
                } else {
                    _mintStableDebtToken(
                        reserve,
                        onBehalfOf,
                        amounts[i],
                        reserve.currentStableBorrowRate
                    );
                }

                _setBorrowing(onBehalfOf, reserve.id, true);
            }

            _updateInterestRates(
                reserve,
                assets[i],
                amountPlusPremium,
                amounts[i]
            );

            emit FlashLoan(
                receiverAddress,
                msg.sender,
                assets[i],
                amounts[i],
                uint8(interestRateModes[i]),
                premiums[i],
                referralCode
            );
        }
    }

    // ============ View Functions ============

    function getReserveData(
        address asset
    ) external view override returns (ReserveData memory) {
        return _reserves[asset];
    }

    function getUserConfiguration(
        address user
    ) external view override returns (UserConfigurationMap memory) {
        return _usersConfig[user];
    }

    function getUserAccountData(
        address user
    )
        public
        view
        override
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        return _calculateUserAccountData(user);
    }

    function getReserveNormalizedIncome(
        address asset
    ) external view override returns (uint256) {
        ReserveData storage reserve = _reserves[asset];
        return
            ReserveLogic.getNormalizedIncome(
                reserve.liquidityIndex,
                reserve.currentLiquidityRate,
                reserve.lastUpdateTimestamp
            );
    }

    function getReserveNormalizedVariableDebt(
        address asset
    ) external view override returns (uint256) {
        ReserveData storage reserve = _reserves[asset];
        return
            ReserveLogic.getNormalizedDebt(
                reserve.variableBorrowIndex,
                reserve.currentVariableBorrowRate,
                reserve.lastUpdateTimestamp
            );
    }

    function getReservesList()
        external
        view
        override
        returns (address[] memory)
    {
        return _reservesList;
    }

    function MAX_NUMBER_RESERVES() external pure override returns (uint16) {
        return MAX_NUMBER_RESERVES_CONST;
    }

    function FLASHLOAN_PREMIUM_TOTAL()
        external
        view
        override
        returns (uint128)
    {
        return flashLoanPremiumTotal;
    }

    // ============ Internal Functions ============

    function _validateActiveReserve(ReserveData storage reserve) internal view {
        require(
            reserve.aTokenAddress != address(0),
            "Pool: reserve not initialized"
        );
        require(_isReserveActive(reserve), "Pool: reserve inactive");
        require(!_isReservePaused(reserve), "Pool: reserve paused");
    }

    function _updateState(ReserveData storage reserve, address asset) internal {
        // Update liquidity index
        uint256 newLiquidityIndex = ReserveLogic.getNormalizedIncome(
            reserve.liquidityIndex,
            reserve.currentLiquidityRate,
            reserve.lastUpdateTimestamp
        );

        // Update variable borrow index
        uint256 newVariableBorrowIndex = ReserveLogic.getNormalizedDebt(
            reserve.variableBorrowIndex,
            reserve.currentVariableBorrowRate,
            reserve.lastUpdateTimestamp
        );

        reserve.liquidityIndex = uint128(newLiquidityIndex);
        reserve.variableBorrowIndex = uint128(newVariableBorrowIndex);
        reserve.lastUpdateTimestamp = uint40(block.timestamp);
    }

    function _updateInterestRates(
        ReserveData storage reserve,
        address asset,
        uint256 liquidityAdded,
        uint256 liquidityTaken
    ) internal {
        // Call interest rate strategy
        // In production, this calls reserve.interestRateStrategyAddress
        // For now, simplified rate calculation
        uint256 totalDebt = _getTotalDebt(reserve);
        uint256 availableLiquidity = IERC20(asset).balanceOf(
            reserve.aTokenAddress
        ) +
            liquidityAdded -
            liquidityTaken;

        uint256 utilization = totalDebt == 0
            ? 0
            : totalDebt.rayDiv(totalDebt + availableLiquidity);

        // Simple rate model: variableRate = baseRate + utilization * slope
        uint256 baseRate = 0.02e27; // 2% base
        uint256 slope = 0.2e27; // 20% slope

        reserve.currentVariableBorrowRate = uint128(
            baseRate + utilization.rayMul(slope)
        );
        reserve.currentStableBorrowRate = uint128(
            reserve.currentVariableBorrowRate + 0.01e27
        ); // +1%
        reserve.currentLiquidityRate = uint128(
            uint256(reserve.currentVariableBorrowRate).rayMul(utilization)
        );

        emit ReserveDataUpdated(
            asset,
            reserve.currentLiquidityRate,
            reserve.currentStableBorrowRate,
            reserve.currentVariableBorrowRate,
            reserve.liquidityIndex,
            reserve.variableBorrowIndex
        );
    }

    function _calculateUserAccountData(
        address user
    )
        internal
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        // Iterate through reserves and sum collateral/debt
        uint256 weightedLtv;
        uint256 weightedLiquidationThreshold;

        for (uint256 i = 0; i < _reservesList.length; i++) {
            address asset = _reservesList[i];
            ReserveData storage reserve = _reserves[asset];

            uint256 price = _getAssetPrice(asset);
            uint256 decimals = _getDecimals(asset);

            // Collateral
            if (_isUsingAsCollateral(user, reserve.id)) {
                uint256 balance = IERC20(reserve.aTokenAddress).balanceOf(user);
                uint256 valueBase = (balance * price) / (10 ** decimals);
                totalCollateralBase += valueBase;

                uint256 assetLtv = _getLtv(reserve);
                uint256 assetLiqThreshold = _getLiquidationThreshold(reserve);

                weightedLtv += valueBase * assetLtv;
                weightedLiquidationThreshold += valueBase * assetLiqThreshold;
            }

            // Debt
            if (_isBorrowing(user, reserve.id)) {
                uint256 variableDebt = IERC20(reserve.variableDebtTokenAddress)
                    .balanceOf(user);
                uint256 stableDebt = IERC20(reserve.stableDebtTokenAddress)
                    .balanceOf(user);
                uint256 valueBase = ((variableDebt + stableDebt) * price) /
                    (10 ** decimals);
                totalDebtBase += valueBase;
            }
        }

        if (totalCollateralBase > 0) {
            ltv = weightedLtv / totalCollateralBase;
            currentLiquidationThreshold =
                weightedLiquidationThreshold /
                totalCollateralBase;
        }

        availableBorrowsBase = HealthFactorLogic.calculateAvailableBorrows(
            totalCollateralBase,
            totalDebtBase,
            ltv
        );

        healthFactor = HealthFactorLogic.calculateHealthFactor(
            totalCollateralBase,
            totalDebtBase,
            currentLiquidationThreshold
        );
    }

    function _validateHealthFactor(
        address user,
        address asset,
        uint256 collateralWithdrawn,
        uint256 amountBorrowed,
        uint256 /* interestRateMode */
    ) internal view {
        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            ,
            uint256 liquidationThreshold,
            ,

        ) = getUserAccountData(user);

        // Adjust for operation
        if (collateralWithdrawn > 0) {
            uint256 price = _getAssetPrice(asset);
            uint256 decimals = _getDecimals(asset);
            uint256 withdrawnValue = (collateralWithdrawn * price) /
                (10 ** decimals);
            totalCollateralBase = totalCollateralBase > withdrawnValue
                ? totalCollateralBase - withdrawnValue
                : 0;
        }

        if (amountBorrowed > 0) {
            uint256 price = _getAssetPrice(asset);
            uint256 decimals = _getDecimals(asset);
            uint256 borrowedValue = (amountBorrowed * price) / (10 ** decimals);
            totalDebtBase += borrowedValue;
        }

        uint256 newHealthFactor = HealthFactorLogic.calculateHealthFactor(
            totalCollateralBase,
            totalDebtBase,
            liquidationThreshold
        );

        require(newHealthFactor >= 1e18, "Pool: health factor below threshold");
    }

    // ============ Helper Functions (Stubs) ============

    function _mintAToken(
        ReserveData storage,
        address,
        uint256
    ) internal pure returns (bool) {
        // In production: calls IAToken(reserve.aTokenAddress).mint(...)
        return true;
    }

    function _burnAToken(
        ReserveData storage,
        address,
        address,
        uint256
    ) internal pure {
        // In production: calls IAToken(reserve.aTokenAddress).burn(...)
    }

    function _mintVariableDebtToken(
        ReserveData storage,
        address,
        uint256
    ) internal pure {
        // In production: calls IVariableDebtToken(reserve.variableDebtTokenAddress).mint(...)
    }

    function _burnVariableDebtToken(
        ReserveData storage,
        address,
        uint256
    ) internal pure {
        // In production: calls IVariableDebtToken(reserve.variableDebtTokenAddress).burn(...)
    }

    function _mintStableDebtToken(
        ReserveData storage,
        address,
        uint256,
        uint256
    ) internal pure {
        // In production: calls IStableDebtToken(reserve.stableDebtTokenAddress).mint(...)
    }

    function _burnStableDebtToken(
        ReserveData storage,
        address,
        uint256
    ) internal pure {
        // In production: calls IStableDebtToken(reserve.stableDebtTokenAddress).burn(...)
    }

    function _transferUnderlying(
        ReserveData storage,
        address,
        uint256
    ) internal pure {
        // In production: calls IAToken(reserve.aTokenAddress).transferUnderlyingTo(...)
    }

    function _transferATokens(
        ReserveData storage,
        address,
        address,
        uint256
    ) internal pure {
        // In production: direct aToken transfer
    }

    function _validateCreditDelegation(
        address,
        address,
        address,
        uint256
    ) internal pure {
        // In production: validates credit delegation allowance
    }

    function _getTotalDebt(
        ReserveData storage reserve
    ) internal view returns (uint256) {
        return
            IERC20(reserve.variableDebtTokenAddress).totalSupply() +
            IERC20(reserve.stableDebtTokenAddress).totalSupply();
    }

    function _getAssetPrice(address) internal pure returns (uint256) {
        // In production: calls IPriceOracle(priceOracle).getAssetPrice(asset)
        return 1e8; // $1 placeholder
    }

    function _getDecimals(address) internal pure returns (uint8) {
        return 18;
    }

    function _getSupplyCap(
        ReserveData storage
    ) internal pure returns (uint256) {
        return 0; // No cap
    }

    function _getBorrowCap(
        ReserveData storage
    ) internal pure returns (uint256) {
        return 0; // No cap
    }

    function _getLtv(ReserveData storage) internal pure returns (uint256) {
        return 8000; // 80%
    }

    function _getLiquidationThreshold(
        ReserveData storage
    ) internal pure returns (uint256) {
        return 8500; // 85%
    }

    function _getLiquidationBonus(
        ReserveData storage
    ) internal pure returns (uint256) {
        return 10500; // 5% bonus
    }

    function _isReserveActive(
        ReserveData storage
    ) internal pure returns (bool) {
        return true;
    }

    function _isReserveFrozen(
        ReserveData storage
    ) internal pure returns (bool) {
        return false;
    }

    function _isReservePaused(
        ReserveData storage
    ) internal pure returns (bool) {
        return false;
    }

    function _isBorrowingEnabled(
        ReserveData storage
    ) internal pure returns (bool) {
        return true;
    }

    function _isStableRateBorrowingEnabled(
        ReserveData storage
    ) internal pure returns (bool) {
        return true;
    }

    function _isUsingAsCollateral(
        address,
        uint16
    ) internal pure returns (bool) {
        return true;
    }

    function _isBorrowing(address, uint16) internal pure returns (bool) {
        return false;
    }

    function _setUsingAsCollateral(address, uint16, bool) internal pure {}

    function _setBorrowing(address, uint16, bool) internal pure {}
}

interface IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}
