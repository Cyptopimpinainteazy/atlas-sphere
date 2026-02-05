// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WadRayMath
 * @notice Fixed-point math library for interest calculations
 * @dev WAD = 1e18 (for percentages), RAY = 1e27 (for indices)
 *
 * CRITICAL: All interest rate math uses RAY precision
 * - Liquidity Index: RAY (1e27 = 100%)
 * - Interest Rates: RAY per year
 * - Health Factor: WAD (1e18 = 100%)
 */
library WadRayMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant HALF_WAD = 0.5e18;

    uint256 internal constant RAY = 1e27;
    uint256 internal constant HALF_RAY = 0.5e27;

    uint256 internal constant WAD_RAY_RATIO = 1e9;

    /**
     * @notice Multiplies two WAD numbers, rounding half up
     * @param a First WAD
     * @param b Second WAD
     * @return Result in WAD
     */
    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0 || b == 0) return 0;

        require(
            a <= (type(uint256).max - HALF_WAD) / b,
            "WadRayMath: wadMul overflow"
        );

        return (a * b + HALF_WAD) / WAD;
    }

    /**
     * @notice Divides two WAD numbers, rounding half up
     * @param a Numerator WAD
     * @param b Denominator WAD
     * @return Result in WAD
     */
    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, "WadRayMath: wadDiv by zero");
        uint256 halfB = b / 2;

        require(
            a <= (type(uint256).max - halfB) / WAD,
            "WadRayMath: wadDiv overflow"
        );

        return (a * WAD + halfB) / b;
    }

    /**
     * @notice Multiplies two RAY numbers, rounding half up
     * @param a First RAY
     * @param b Second RAY
     * @return Result in RAY
     */
    function rayMul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0 || b == 0) return 0;

        require(
            a <= (type(uint256).max - HALF_RAY) / b,
            "WadRayMath: rayMul overflow"
        );

        return (a * b + HALF_RAY) / RAY;
    }

    /**
     * @notice Divides two RAY numbers, rounding half up
     * @param a Numerator RAY
     * @param b Denominator RAY
     * @return Result in RAY
     */
    function rayDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, "WadRayMath: rayDiv by zero");
        uint256 halfB = b / 2;

        require(
            a <= (type(uint256).max - halfB) / RAY,
            "WadRayMath: rayDiv overflow"
        );

        return (a * RAY + halfB) / b;
    }

    /**
     * @notice Converts RAY to WAD (loses precision)
     */
    function rayToWad(uint256 a) internal pure returns (uint256) {
        uint256 halfRatio = WAD_RAY_RATIO / 2;
        uint256 result = halfRatio + a;
        require(result >= halfRatio, "WadRayMath: rayToWad overflow");
        return result / WAD_RAY_RATIO;
    }

    /**
     * @notice Converts WAD to RAY
     */
    function wadToRay(uint256 a) internal pure returns (uint256) {
        uint256 result = a * WAD_RAY_RATIO;
        require(result / WAD_RAY_RATIO == a, "WadRayMath: wadToRay overflow");
        return result;
    }
}

/**
 * @title PercentageMath
 * @notice Percentage calculations with basis points
 * @dev 1 bp = 0.01%, 10000 bp = 100%
 */
library PercentageMath {
    uint256 internal constant PERCENTAGE_FACTOR = 1e4; // 100.00%
    uint256 internal constant HALF_PERCENTAGE_FACTOR = 0.5e4;

    /**
     * @notice Multiplies value by percentage
     * @param value The value
     * @param percentage The percentage in bps (10000 = 100%)
     * @return Result
     */
    function percentMul(
        uint256 value,
        uint256 percentage
    ) internal pure returns (uint256) {
        if (value == 0 || percentage == 0) return 0;

        require(
            value <= (type(uint256).max - HALF_PERCENTAGE_FACTOR) / percentage,
            "PercentageMath: percentMul overflow"
        );

        return
            (value * percentage + HALF_PERCENTAGE_FACTOR) / PERCENTAGE_FACTOR;
    }

    /**
     * @notice Divides value by percentage
     * @param value The value
     * @param percentage The percentage in bps
     * @return Result
     */
    function percentDiv(
        uint256 value,
        uint256 percentage
    ) internal pure returns (uint256) {
        require(percentage != 0, "PercentageMath: percentDiv by zero");
        uint256 halfPercentage = percentage / 2;

        require(
            value <= (type(uint256).max - halfPercentage) / PERCENTAGE_FACTOR,
            "PercentageMath: percentDiv overflow"
        );

        return (value * PERCENTAGE_FACTOR + halfPercentage) / percentage;
    }
}

/**
 * @title MathUtils
 * @notice Advanced math utilities for interest compounding
 */
library MathUtils {
    using WadRayMath for uint256;

    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /**
     * @notice Calculates linear interest accumulated over time
     * @dev Simple interest: principal * rate * time
     * @param rate The interest rate per year (in RAY)
     * @param lastUpdateTimestamp Last timestamp when interest was calculated
     * @return Linear accumulated interest in RAY (multiply by principal to get interest)
     *
     * Formula: 1 + rate * timeDelta / SECONDS_PER_YEAR
     */
    function calculateLinearInterest(
        uint256 rate,
        uint40 lastUpdateTimestamp
    ) internal view returns (uint256) {
        uint256 timeDelta = block.timestamp - uint256(lastUpdateTimestamp);

        return WadRayMath.RAY + (rate * timeDelta) / SECONDS_PER_YEAR;
    }

    /**
     * @notice Calculates compound interest accumulated over time
     * @dev Compound interest using binomial approximation for gas efficiency
     * @param rate The interest rate per year (in RAY)
     * @param lastUpdateTimestamp Last timestamp when interest was calculated
     * @return Compounded interest factor in RAY
     *
     * For small time periods, uses Taylor expansion:
     * (1 + rate)^t ≈ 1 + rate*t + (rate*t)^2/2 + (rate*t)^3/6 + ...
     *
     * Truncated to second order for gas efficiency while maintaining accuracy
     */
    function calculateCompoundedInterest(
        uint256 rate,
        uint40 lastUpdateTimestamp,
        uint256 currentTimestamp
    ) internal pure returns (uint256) {
        uint256 exp = currentTimestamp - uint256(lastUpdateTimestamp);

        if (exp == 0) {
            return WadRayMath.RAY;
        }

        uint256 expMinusOne;
        uint256 expMinusTwo;
        uint256 basePowerTwo;
        uint256 basePowerThree;

        unchecked {
            expMinusOne = exp - 1;
            expMinusTwo = exp > 2 ? exp - 2 : 0;
        }

        // rate / SECONDS_PER_YEAR
        uint256 ratePerSecond = rate / SECONDS_PER_YEAR;

        basePowerTwo = ratePerSecond.rayMul(ratePerSecond) / 2;
        basePowerThree = basePowerTwo.rayMul(ratePerSecond) / 3;

        // Taylor expansion: 1 + x*t + x²*t*(t-1)/2 + x³*t*(t-1)*(t-2)/6
        uint256 secondTerm = ratePerSecond * exp;
        uint256 thirdTerm = basePowerTwo * exp * expMinusOne;
        uint256 fourthTerm = basePowerThree * exp * expMinusOne * expMinusTwo;

        return WadRayMath.RAY + secondTerm + thirdTerm + fourthTerm;
    }

    /**
     * @notice Overload using block.timestamp
     */
    function calculateCompoundedInterest(
        uint256 rate,
        uint40 lastUpdateTimestamp
    ) internal view returns (uint256) {
        return
            calculateCompoundedInterest(
                rate,
                lastUpdateTimestamp,
                block.timestamp
            );
    }
}

/**
 * @title ReserveLogic
 * @notice Core calculations for reserve state updates
 */
library ReserveLogic {
    using WadRayMath for uint256;
    using MathUtils for uint256;

    /**
     * @notice Calculates the normalized income (interest accumulated on deposits)
     * @param liquidityIndex The current liquidity index (RAY)
     * @param currentLiquidityRate The current liquidity rate (RAY)
     * @param lastUpdateTimestamp When the index was last updated
     * @return New liquidity index
     */
    function getNormalizedIncome(
        uint256 liquidityIndex,
        uint256 currentLiquidityRate,
        uint40 lastUpdateTimestamp
    ) internal view returns (uint256) {
        if (lastUpdateTimestamp == block.timestamp) {
            return liquidityIndex;
        }

        uint256 cumulated = MathUtils.calculateLinearInterest(
            currentLiquidityRate,
            lastUpdateTimestamp
        );

        return cumulated.rayMul(liquidityIndex);
    }

    /**
     * @notice Calculates the normalized debt (interest accumulated on borrows)
     * @param variableBorrowIndex The current variable borrow index (RAY)
     * @param currentVariableBorrowRate The current variable borrow rate (RAY)
     * @param lastUpdateTimestamp When the index was last updated
     * @return New variable borrow index
     */
    function getNormalizedDebt(
        uint256 variableBorrowIndex,
        uint256 currentVariableBorrowRate,
        uint40 lastUpdateTimestamp
    ) internal view returns (uint256) {
        if (lastUpdateTimestamp == block.timestamp) {
            return variableBorrowIndex;
        }

        uint256 cumulated = MathUtils.calculateCompoundedInterest(
            currentVariableBorrowRate,
            lastUpdateTimestamp
        );

        return cumulated.rayMul(variableBorrowIndex);
    }
}

/**
 * @title HealthFactorLogic
 * @notice Health factor and liquidation calculations
 */
library HealthFactorLogic {
    using WadRayMath for uint256;
    using PercentageMath for uint256;

    uint256 internal constant HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1e18; // 1.0 in WAD

    /**
     * @notice Calculates user's health factor
     * @param totalCollateralInBaseCurrency Total collateral value in base currency
     * @param totalDebtInBaseCurrency Total debt value in base currency
     * @param liquidationThreshold Weighted average liquidation threshold (in bps)
     * @return Health factor in WAD (1e18 = 1.0)
     *
     * Formula: (collateral * liquidationThreshold) / debt
     *
     * - HF > 1: Position is safe
     * - HF < 1: Position can be liquidated
     * - HF = 0: No debt (infinite safety)
     */
    function calculateHealthFactor(
        uint256 totalCollateralInBaseCurrency,
        uint256 totalDebtInBaseCurrency,
        uint256 liquidationThreshold
    ) internal pure returns (uint256) {
        if (totalDebtInBaseCurrency == 0) {
            return type(uint256).max;
        }

        // collateral * LT / debt
        return
            (totalCollateralInBaseCurrency.percentMul(liquidationThreshold) *
                1e18) / totalDebtInBaseCurrency;
    }

    /**
     * @notice Calculates available borrowing power
     * @param totalCollateralInBaseCurrency Total collateral value
     * @param totalDebtInBaseCurrency Total debt value
     * @param ltv Weighted average LTV (in bps)
     * @return Available borrows in base currency
     *
     * Formula: (collateral * LTV) - debt
     */
    function calculateAvailableBorrows(
        uint256 totalCollateralInBaseCurrency,
        uint256 totalDebtInBaseCurrency,
        uint256 ltv
    ) internal pure returns (uint256) {
        uint256 maxBorrow = totalCollateralInBaseCurrency.percentMul(ltv);

        if (maxBorrow <= totalDebtInBaseCurrency) {
            return 0;
        }

        return maxBorrow - totalDebtInBaseCurrency;
    }

    /**
     * @notice Calculates maximum debt that can be covered in a liquidation
     * @param debtInBaseCurrency User's debt in base currency
     * @param healthFactor Current health factor
     * @param liquidationCloseFactorBps Close factor (% of debt that can be liquidated)
     * @return Maximum debt to cover
     *
     * If HF < 0.95: Full liquidation allowed (100%)
     * If HF >= 0.95 and < 1.0: Partial liquidation (50%)
     */
    function calculateMaxLiquidatableDebt(
        uint256 debtInBaseCurrency,
        uint256 healthFactor,
        uint256 liquidationCloseFactorBps
    ) internal pure returns (uint256) {
        // If deeply underwater, allow full liquidation
        if (healthFactor < 0.95e18) {
            return debtInBaseCurrency;
        }

        return debtInBaseCurrency.percentMul(liquidationCloseFactorBps);
    }

    /**
     * @notice Calculates collateral to seize during liquidation
     * @param debtToCover Debt amount being repaid
     * @param debtAssetPrice Price of debt asset
     * @param collateralPrice Price of collateral asset
     * @param liquidationBonus Bonus for liquidator (in bps, 10500 = 5% bonus)
     * @param debtDecimals Debt token decimals
     * @param collateralDecimals Collateral token decimals
     * @return Amount of collateral to seize
     *
     * Formula: (debtToCover * debtPrice * bonus) / collateralPrice
     */
    function calculateCollateralToSeize(
        uint256 debtToCover,
        uint256 debtAssetPrice,
        uint256 collateralPrice,
        uint256 liquidationBonus,
        uint8 debtDecimals,
        uint8 collateralDecimals
    ) internal pure returns (uint256) {
        // Normalize to base currency
        uint256 debtValueBase = (debtToCover * debtAssetPrice) /
            (10 ** debtDecimals);

        // Apply liquidation bonus
        uint256 debtValueWithBonus = debtValueBase.percentMul(liquidationBonus);

        // Convert to collateral units
        return
            (debtValueWithBonus * (10 ** collateralDecimals)) / collateralPrice;
    }
}
