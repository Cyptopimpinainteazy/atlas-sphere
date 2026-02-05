// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WadRayMath} from "../libraries/MathLibraries.sol";

/**
 * @title InterestRateModel
 * @notice Kinked interest rate model for lending pools
 * @dev Implements dual-slope model: gentle slope below optimal, steep above
 *
 * Rate Model Visualization:
 *
 *     Rate
 *       │                              ╱
 *       │                           ╱
 *       │                        ╱    ← Slope2 (steep, discourages over-utilization)
 *       │                     ╱
 *       │             ╱──────╱        ← Kink (optimal utilization)
 *       │          ╱
 *       │       ╱                     ← Slope1 (gentle)
 *       │    ╱
 *       │ ╱  ← Base rate
 *       └───────────────────────────── Utilization
 *       0%      Optimal      100%
 *
 * Example parameters for stablecoins:
 * - Base rate: 0% (no cost at zero utilization)
 * - Slope1: 4% (gentle increase up to optimal)
 * - Slope2: 75% (steep increase above optimal)
 * - Optimal: 80% (kink point)
 *
 * At 80% utilization: rate = 0% + 4% = 4%
 * At 90% utilization: rate = 4% + (10%/20%) * 75% = 4% + 37.5% = 41.5%
 * At 100% utilization: rate = 4% + 75% = 79%
 */
contract InterestRateModel {
    using WadRayMath for uint256;

    // ============ Constants ============

    uint256 public constant RAY = 1e27;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // ============ Immutable Parameters ============

    /// @notice Optimal utilization rate (in RAY). E.g., 0.8e27 = 80%
    uint256 public immutable OPTIMAL_UTILIZATION_RATE;

    /// @notice Rate at zero utilization (in RAY per year)
    uint256 public immutable BASE_VARIABLE_BORROW_RATE;

    /// @notice Rate slope below optimal utilization (in RAY per year)
    uint256 public immutable VARIABLE_RATE_SLOPE_1;

    /// @notice Rate slope above optimal utilization (in RAY per year)
    uint256 public immutable VARIABLE_RATE_SLOPE_2;

    /// @notice Base stable rate spread over variable
    uint256 public immutable BASE_STABLE_RATE_OFFSET;

    /// @notice Stable rate slope 1
    uint256 public immutable STABLE_RATE_SLOPE_1;

    /// @notice Stable rate slope 2
    uint256 public immutable STABLE_RATE_SLOPE_2;

    // ============ Constructor ============

    /**
     * @notice Creates a new interest rate model
     * @param optimalUtilization Optimal utilization rate (RAY)
     * @param baseRate Base variable borrow rate (RAY)
     * @param slope1 Rate slope below optimal (RAY)
     * @param slope2 Rate slope above optimal (RAY)
     * @param stableOffset Base stable rate offset over variable
     * @param stableSlope1 Stable rate slope 1
     * @param stableSlope2 Stable rate slope 2
     */
    constructor(
        uint256 optimalUtilization,
        uint256 baseRate,
        uint256 slope1,
        uint256 slope2,
        uint256 stableOffset,
        uint256 stableSlope1,
        uint256 stableSlope2
    ) {
        require(
            optimalUtilization > 0 && optimalUtilization < RAY,
            "Invalid optimal"
        );

        OPTIMAL_UTILIZATION_RATE = optimalUtilization;
        BASE_VARIABLE_BORROW_RATE = baseRate;
        VARIABLE_RATE_SLOPE_1 = slope1;
        VARIABLE_RATE_SLOPE_2 = slope2;
        BASE_STABLE_RATE_OFFSET = stableOffset;
        STABLE_RATE_SLOPE_1 = stableSlope1;
        STABLE_RATE_SLOPE_2 = stableSlope2;
    }

    // ============ View Functions ============

    /**
     * @notice Returns the base variable borrow rate
     */
    function getBaseVariableBorrowRate() external view returns (uint256) {
        return BASE_VARIABLE_BORROW_RATE;
    }

    /**
     * @notice Returns the max variable borrow rate (at 100% utilization)
     */
    function getMaxVariableBorrowRate() external view returns (uint256) {
        return
            BASE_VARIABLE_BORROW_RATE +
            VARIABLE_RATE_SLOPE_1 +
            VARIABLE_RATE_SLOPE_2;
    }

    /**
     * @notice Calculates the utilization rate
     * @param totalDebt Total borrowed
     * @param totalLiquidity Total available liquidity
     * @return Utilization rate in RAY
     *
     * Formula: debt / (debt + liquidity)
     */
    function calculateUtilizationRate(
        uint256 totalDebt,
        uint256 totalLiquidity
    ) public pure returns (uint256) {
        if (totalDebt == 0) {
            return 0;
        }

        return totalDebt.rayDiv(totalDebt + totalLiquidity);
    }

    /**
     * @notice Calculates the variable borrow rate
     * @param utilization Current utilization rate (RAY)
     * @return Variable borrow rate per year (RAY)
     *
     * If utilization <= optimal:
     *   rate = base + (utilization / optimal) * slope1
     *
     * If utilization > optimal:
     *   excess = utilization - optimal
     *   rate = base + slope1 + (excess / (1 - optimal)) * slope2
     */
    function calculateVariableBorrowRate(
        uint256 utilization
    ) public view returns (uint256) {
        if (utilization <= OPTIMAL_UTILIZATION_RATE) {
            // Below kink: gentle slope
            return
                BASE_VARIABLE_BORROW_RATE +
                utilization.rayMul(VARIABLE_RATE_SLOPE_1).rayDiv(
                    OPTIMAL_UTILIZATION_RATE
                );
        } else {
            // Above kink: steep slope
            uint256 excessUtilization = utilization - OPTIMAL_UTILIZATION_RATE;
            uint256 maxExcess = RAY - OPTIMAL_UTILIZATION_RATE;

            return
                BASE_VARIABLE_BORROW_RATE +
                VARIABLE_RATE_SLOPE_1 +
                excessUtilization.rayMul(VARIABLE_RATE_SLOPE_2).rayDiv(
                    maxExcess
                );
        }
    }

    /**
     * @notice Calculates the stable borrow rate
     * @param utilization Current utilization rate (RAY)
     * @param averageStableRate Current average stable rate
     * @return Stable borrow rate per year (RAY)
     */
    function calculateStableBorrowRate(
        uint256 utilization,
        uint256 averageStableRate
    ) public view returns (uint256) {
        uint256 baseStable = BASE_VARIABLE_BORROW_RATE +
            BASE_STABLE_RATE_OFFSET;

        if (utilization <= OPTIMAL_UTILIZATION_RATE) {
            return
                baseStable +
                utilization.rayMul(STABLE_RATE_SLOPE_1).rayDiv(
                    OPTIMAL_UTILIZATION_RATE
                );
        } else {
            uint256 excessUtilization = utilization - OPTIMAL_UTILIZATION_RATE;
            uint256 maxExcess = RAY - OPTIMAL_UTILIZATION_RATE;

            return
                baseStable +
                STABLE_RATE_SLOPE_1 +
                excessUtilization.rayMul(STABLE_RATE_SLOPE_2).rayDiv(maxExcess);
        }
    }

    /**
     * @notice Calculates the liquidity rate (supply APY)
     * @param utilization Current utilization rate (RAY)
     * @param variableBorrowRate Current variable borrow rate (RAY)
     * @param stableBorrowRate Current stable borrow rate (RAY)
     * @param totalStableDebt Total stable debt
     * @param totalVariableDebt Total variable debt
     * @param reserveFactor Reserve factor in bps (protocol fee)
     * @return Liquidity rate per year (RAY)
     *
     * Formula:
     * totalBorrowRate = (stableDebt * stableRate + varDebt * varRate) / totalDebt
     * liquidityRate = totalBorrowRate * utilization * (1 - reserveFactor)
     *
     * Suppliers earn the weighted borrow rate proportional to utilization,
     * minus the protocol's cut (reserve factor)
     */
    function calculateLiquidityRate(
        uint256 utilization,
        uint256 variableBorrowRate,
        uint256 stableBorrowRate,
        uint256 totalStableDebt,
        uint256 totalVariableDebt,
        uint256 reserveFactor
    ) public pure returns (uint256) {
        uint256 totalDebt = totalStableDebt + totalVariableDebt;

        if (totalDebt == 0) {
            return 0;
        }

        // Weighted average borrow rate
        uint256 weightedRate = (totalStableDebt *
            stableBorrowRate +
            totalVariableDebt *
            variableBorrowRate) / totalDebt;

        // Liquidity rate = borrow rate * utilization * (1 - reserve factor)
        uint256 protocolCut = (reserveFactor * RAY) / 10000; // Convert bps to RAY
        uint256 supplierShare = RAY - protocolCut;

        return weightedRate.rayMul(utilization).rayMul(supplierShare);
    }

    /**
     * @notice Full rate calculation for Pool integration
     * @param unbacked Unbacked aTokens (for isolation mode)
     * @param liquidityAdded Liquidity being added
     * @param liquidityTaken Liquidity being withdrawn
     * @param totalStableDebt Current stable debt
     * @param totalVariableDebt Current variable debt
     * @param averageStableBorrowRate Average stable rate
     * @param reserveFactor Reserve factor in bps
     * @param reserve Reserve address (unused, for interface compatibility)
     * @param aToken aToken address (unused)
     * @return liquidityRate Supply APY
     * @return stableBorrowRate Stable borrow APY
     * @return variableBorrowRate Variable borrow APY
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
            uint256 liquidityRate,
            uint256 stableBorrowRate,
            uint256 variableBorrowRate
        )
    {
        // Calculate available liquidity after operation
        // Need to get current balance from aToken
        uint256 availableLiquidity;
        if (aToken != address(0)) {
            availableLiquidity =
                _getAvailableLiquidity(aToken) +
                liquidityAdded -
                liquidityTaken;
        } else {
            availableLiquidity = liquidityAdded - liquidityTaken;
        }

        uint256 totalDebt = totalStableDebt + totalVariableDebt + unbacked;

        uint256 utilization = calculateUtilizationRate(
            totalDebt,
            availableLiquidity
        );

        variableBorrowRate = calculateVariableBorrowRate(utilization);
        stableBorrowRate = calculateStableBorrowRate(
            utilization,
            averageStableBorrowRate
        );
        liquidityRate = calculateLiquidityRate(
            utilization,
            variableBorrowRate,
            stableBorrowRate,
            totalStableDebt,
            totalVariableDebt,
            reserveFactor
        );
    }

    /**
     * @notice Gets available liquidity from aToken
     * @dev Reads underlying balance of aToken contract
     */
    function _getAvailableLiquidity(
        address aToken
    ) internal view returns (uint256) {
        // In a real implementation, this would call aToken.UNDERLYING_ASSET_ADDRESS()
        // and get the balance. For now, return 0 to be overridden by actual liquidity.
        return 0;
    }
}

/**
 * @title InterestRateModelFactory
 * @notice Factory for deploying preset interest rate models
 */
contract InterestRateModelFactory {
    // ============ Events ============

    event ModelCreated(address indexed model, string name);

    // ============ Preset Configurations ============

    /**
     * @notice Creates a stablecoin-optimized model
     * @dev Optimized for USDC, USDT, DAI
     * - Low base rate (0%)
     * - Gentle slope to 80% (4%)
     * - Steep slope above (75%)
     * - Target utilization: 80%
     */
    function createStablecoinModel() external returns (address) {
        InterestRateModel model = new InterestRateModel(
            0.80e27, // 80% optimal utilization
            0, // 0% base rate
            0.04e27, // 4% slope1
            0.75e27, // 75% slope2
            0.02e27, // 2% stable offset
            0.005e27, // 0.5% stable slope1
            0.60e27 // 60% stable slope2
        );

        emit ModelCreated(address(model), "Stablecoin");
        return address(model);
    }

    /**
     * @notice Creates an ETH/WETH-optimized model
     * @dev More volatile asset, lower optimal utilization
     * - Slightly higher base rate
     * - Target utilization: 65%
     */
    function createEthModel() external returns (address) {
        InterestRateModel model = new InterestRateModel(
            0.65e27, // 65% optimal utilization
            0.01e27, // 1% base rate
            0.04e27, // 4% slope1
            1.00e27, // 100% slope2 (aggressive above optimal)
            0.03e27, // 3% stable offset
            0.01e27, // 1% stable slope1
            0.80e27 // 80% stable slope2
        );

        emit ModelCreated(address(model), "ETH");
        return address(model);
    }

    /**
     * @notice Creates a volatile asset model
     * @dev For tokens like UNI, LINK, AAVE
     * - Higher base rate
     * - Lower optimal utilization
     * - Very steep above optimal
     */
    function createVolatileModel() external returns (address) {
        InterestRateModel model = new InterestRateModel(
            0.45e27, // 45% optimal utilization
            0.02e27, // 2% base rate
            0.07e27, // 7% slope1
            3.00e27, // 300% slope2 (very aggressive)
            0.05e27, // 5% stable offset
            0.02e27, // 2% stable slope1
            1.50e27 // 150% stable slope2
        );

        emit ModelCreated(address(model), "Volatile");
        return address(model);
    }

    /**
     * @notice Creates a custom model with specified parameters
     */
    function createCustomModel(
        uint256 optimalUtilization,
        uint256 baseRate,
        uint256 slope1,
        uint256 slope2,
        uint256 stableOffset,
        uint256 stableSlope1,
        uint256 stableSlope2
    ) external returns (address) {
        InterestRateModel model = new InterestRateModel(
            optimalUtilization,
            baseRate,
            slope1,
            slope2,
            stableOffset,
            stableSlope1,
            stableSlope2
        );

        emit ModelCreated(address(model), "Custom");
        return address(model);
    }
}
