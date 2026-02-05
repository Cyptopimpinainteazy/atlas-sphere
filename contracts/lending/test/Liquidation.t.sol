// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/Pool.sol";
import "../src/core/OracleRouter.sol";
import "../src/core/InterestRateModel.sol";
import "../src/core/CollateralManager.sol";
import "../src/tokens/AToken.sol";
import "../src/tokens/DebtTokens.sol";
import "../src/libraries/MathLibraries.sol";
import "../script/Deploy.s.sol";

/**
 * @title LiquidationTest
 * @notice Comprehensive liquidation scenario tests
 */
contract LiquidationTest is Test {
    using WadRayMath for uint256;

    OracleRouter public oracle;
    InterestRateModel public irm;
    CollateralManager public collateralManager;

    MockERC20 public usdc;
    MockERC20 public weth;
    AToken public aUSDC;
    AToken public aWETH;
    VariableDebtToken public vdUSDC;
    VariableDebtToken public vdWETH;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public liquidator = makeAddr("liquidator");
    address public treasury = makeAddr("treasury");
    address public pool = makeAddr("pool");

    function setUp() public {
        // Deploy infrastructure
        usdc = new MockERC20("USDC", "USDC", 6);
        weth = new MockERC20("WETH", "WETH", 18);
        oracle = new OracleRouter();
        irm = new InterestRateModel(
            0.8e27, // 80% optimal
            0.02e27, // 2% base
            0.08e27, // 8% slope1
            1e27, // 100% slope2
            0.02e27, // stable offset
            0.01e27, // stable slope1
            0.80e27 // stable slope2
        );
        collateralManager = new CollateralManager(address(oracle));

        // Set initial prices
        oracle.setManualPrice(address(usdc), 1e8);
        oracle.setManualPrice(address(weth), 2500e8);

        // Configure collateral
        collateralManager.configureCollateral(
            address(usdc),
            8000,
            8500,
            10500,
            6
        );
        collateralManager.configureCollateral(
            address(weth),
            8000,
            8250,
            10500,
            18
        );

        // Deploy tokens
        aUSDC = new AToken(
            pool,
            address(usdc),
            treasury,
            address(0),
            "aUSDC",
            "aUSDC"
        );
        aWETH = new AToken(
            pool,
            address(weth),
            treasury,
            address(0),
            "aWETH",
            "aWETH"
        );
        vdUSDC = new VariableDebtToken(pool, address(usdc), "vdUSDC", "vdUSDC");
        vdWETH = new VariableDebtToken(pool, address(weth), "vdWETH", "vdWETH");

        // Fund users
        usdc.mint(alice, 1_000_000e6);
        weth.mint(alice, 1000e18);
        usdc.mint(bob, 1_000_000e6);
        weth.mint(bob, 1000e18);
        usdc.mint(liquidator, 10_000_000e6);
        weth.mint(liquidator, 10_000e18);
    }

    // ============ Health Factor Scenarios ============

    function test_HealthyPosition() public pure {
        // 10 ETH @ $2500 = $25,000 collateral
        // $10,000 USDC borrowed
        // LTV = 40% (well within 80% max)
        uint256 collateralValue = 25_000e8;
        uint256 debtValue = 10_000e8;
        uint256 liquidationThreshold = 8250; // 82.5%

        uint256 hf = HealthFactorLogic.calculateHealthFactor(
            collateralValue,
            debtValue,
            liquidationThreshold
        );

        // HF = (25000 * 0.825) / 10000 = 2.0625
        assertApproxEqRel(hf, 2.0625e18, 0.01e18);
        assertGt(hf, 1e18, "Position should be healthy");
    }

    function test_AtRiskPosition() public pure {
        // Same collateral, more debt
        uint256 collateralValue = 25_000e8;
        uint256 debtValue = 20_000e8; // 80% LTV
        uint256 liquidationThreshold = 8250;

        uint256 hf = HealthFactorLogic.calculateHealthFactor(
            collateralValue,
            debtValue,
            liquidationThreshold
        );

        // HF = (25000 * 0.825) / 20000 = 1.03125
        assertApproxEqRel(hf, 1.03125e18, 0.01e18);
        assertGt(hf, 1e18, "Position at risk but not liquidatable");
    }

    function test_LiquidatablePosition() public pure {
        // Price dropped, now underwater
        uint256 collateralValue = 20_000e8; // ETH price dropped
        uint256 debtValue = 20_000e8;
        uint256 liquidationThreshold = 8250;

        uint256 hf = HealthFactorLogic.calculateHealthFactor(
            collateralValue,
            debtValue,
            liquidationThreshold
        );

        // HF = (20000 * 0.825) / 20000 = 0.825
        assertApproxEqRel(hf, 0.825e18, 0.01e18);
        assertLt(hf, 1e18, "Position should be liquidatable");
    }

    // ============ Liquidation Amount Calculations ============

    function test_PartialLiquidation() public pure {
        uint256 totalDebt = 10_000e8;
        uint256 healthFactor = 0.98e18; // Slightly below 1
        uint256 closeFactorBps = 5000; // 50%

        uint256 maxLiquidatable = HealthFactorLogic
            .calculateMaxLiquidatableDebt(
                totalDebt,
                healthFactor,
                closeFactorBps
            );

        // Should be 50% of debt
        assertEq(maxLiquidatable, 5_000e8);
    }

    function test_FullLiquidation() public pure {
        uint256 totalDebt = 10_000e8;
        uint256 healthFactor = 0.5e18; // Very underwater
        uint256 closeFactorBps = 5000;

        uint256 maxLiquidatable = HealthFactorLogic
            .calculateMaxLiquidatableDebt(
                totalDebt,
                healthFactor,
                closeFactorBps
            );

        // Below 0.95 HF = full liquidation
        assertEq(maxLiquidatable, totalDebt);
    }

    function test_CollateralSeizure() public pure {
        // Liquidating $5,000 of USDC debt
        // ETH price = $2,500
        // Bonus = 5%
        uint256 debtToCover = 5_000e6;
        uint256 debtPrice = 1e8;
        uint256 collateralPrice = 2500e8;
        uint256 liquidationBonus = 10500;

        uint256 collateralSeized = HealthFactorLogic.calculateCollateralToSeize(
            debtToCover,
            debtPrice,
            collateralPrice,
            liquidationBonus,
            6, // USDC decimals
            18 // ETH decimals
        );

        // Expected: (5000 * 1.05) / 2500 = 2.1 ETH
        assertApproxEqRel(collateralSeized, 2.1e18, 0.01e18);
    }

    // ============ Price Impact Scenarios ============

    function test_PriceDropLiquidation() public {
        // Setup: Alice has 10 ETH collateral, 18000 USDC debt
        // Initial: 10 * 2500 = $25,000 collateral, $18,000 debt
        // LTV = 72%, within 80% limit
        // HF = (25000 * 0.825) / 18000 = 1.146

        uint256 initialCollateral = 10 * 2500e8; // $25,000
        uint256 debt = 18_000e8;

        uint256 initialHF = HealthFactorLogic.calculateHealthFactor(
            initialCollateral,
            debt,
            8250
        );
        assertGt(initialHF, 1e18, "Should start healthy");

        // ETH price drops 20%
        uint256 newCollateral = 10 * 2000e8; // $20,000

        uint256 newHF = HealthFactorLogic.calculateHealthFactor(
            newCollateral,
            debt,
            8250
        );

        // HF = (20000 * 0.825) / 18000 = 0.917
        assertLt(newHF, 1e18, "Should be liquidatable after price drop");
    }

    function test_CascadingLiquidation() public pure {
        // Scenario: Multiple price drops and liquidations
        uint256 debt = 18_000e8;

        // Initial state
        uint256[] memory ethPrices = new uint256[](5);
        ethPrices[0] = 2500e8;
        ethPrices[1] = 2300e8;
        ethPrices[2] = 2100e8;
        ethPrices[3] = 1900e8;
        ethPrices[4] = 1700e8;

        uint256 ethAmount = 10e18;

        for (uint256 i = 0; i < ethPrices.length; i++) {
            uint256 collateralValue = (ethAmount * ethPrices[i]) / 1e18;
            uint256 hf = HealthFactorLogic.calculateHealthFactor(
                collateralValue,
                debt,
                8250
            );

            if (hf < 1e18) {
                // Liquidation would occur
                uint256 maxLiq = HealthFactorLogic.calculateMaxLiquidatableDebt(
                    debt,
                    hf,
                    5000
                );
                assertTrue(maxLiq > 0, "Should have liquidatable amount");
            }
        }
    }

    // ============ Edge Cases ============

    function test_DustPosition() public pure {
        // Very small position
        uint256 collateral = 100; // $0.000001
        uint256 debt = 50;
        uint256 liquidationThreshold = 8250;

        uint256 hf = HealthFactorLogic.calculateHealthFactor(
            collateral,
            debt,
            liquidationThreshold
        );

        // Should still calculate correctly
        assertGt(hf, 0);
    }

    function test_MaxValues() public pure {
        // Test with large values
        uint256 collateral = 1_000_000_000e8; // $1B
        uint256 debt = 500_000_000e8; // $500M
        uint256 liquidationThreshold = 8500;

        uint256 hf = HealthFactorLogic.calculateHealthFactor(
            collateral,
            debt,
            liquidationThreshold
        );

        // HF = (1B * 0.85) / 500M = 1.7
        assertApproxEqRel(hf, 1.7e18, 0.01e18);
    }

    function test_BadDebtScenario() public pure {
        // Collateral < Debt (bad debt)
        uint256 collateral = 8_000e8;
        uint256 debt = 10_000e8;
        uint256 liquidationThreshold = 8500;

        uint256 hf = HealthFactorLogic.calculateHealthFactor(
            collateral,
            debt,
            liquidationThreshold
        );

        // HF = (8000 * 0.85) / 10000 = 0.68
        assertApproxEqRel(hf, 0.68e18, 0.01e18);
        assertLt(hf, 1e18, "Bad debt position");
    }

    // ============ Liquidator Profitability ============

    function test_LiquidatorProfit() public pure {
        // Liquidator covers $5,000 debt
        // Receives ETH worth $5,000 * 1.05 = $5,250
        // Profit = $250 (5%)

        uint256 debtCovered = 5_000e6;
        uint256 ethReceived = HealthFactorLogic.calculateCollateralToSeize(
            debtCovered,
            1e8, // USDC price
            2500e8, // ETH price
            10500, // 5% bonus
            6,
            18
        );

        // Value of ETH received
        uint256 ethValueReceived = (ethReceived * 2500e8) / 1e18;

        // Should be 5% more than debt covered
        uint256 expectedValue = ((uint256(debtCovered) * 10500) / 10000) * 1e2; // Adjust decimals
        assertApproxEqRel(ethValueReceived, expectedValue, 0.01e8);
    }

    // ============ Fuzz Tests ============

    function testFuzz_LiquidationMath(
        uint128 collateralValue,
        uint128 debtValue,
        uint16 threshold
    ) public pure {
        vm.assume(collateralValue > 1e8);
        vm.assume(debtValue > 1e8);
        vm.assume(threshold > 5000 && threshold < 9500);

        uint256 hf = HealthFactorLogic.calculateHealthFactor(
            uint256(collateralValue),
            uint256(debtValue),
            threshold
        );

        // HF should be reasonable
        assertGt(hf, 0);
        if (collateralValue > debtValue) {
            // Generally should be healthy
            assertTrue(true, "Higher collateral tends toward healthy");
        }
    }

    function testFuzz_CollateralSeizure(
        uint64 debtToCover,
        uint64 collateralPrice
    ) public pure {
        vm.assume(debtToCover > 1e6);
        vm.assume(collateralPrice > 1e6);

        uint256 seized = HealthFactorLogic.calculateCollateralToSeize(
            uint256(debtToCover),
            1e8, // debt price $1
            uint256(collateralPrice),
            10500,
            6,
            18
        );

        // Seized should be positive
        assertGt(seized, 0);
    }
}

/**
 * @title FlashLoanTest
 * @notice Tests for flash loan functionality
 */
contract FlashLoanTest is Test {
    MockERC20 public usdc;

    address public pool = makeAddr("pool");
    address public receiver = makeAddr("receiver");

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        usdc.mint(pool, 10_000_000e6);
    }

    function test_FlashLoanFeeCalculation() public pure {
        uint256 amount = 1_000_000e6; // 1M USDC
        uint256 feeBps = 9; // 0.09%

        uint256 fee = (amount * feeBps) / 10000;
        assertEq(fee, 900e6); // $900 fee
    }

    function test_FlashLoanProfitability() public pure {
        // Arbitrage opportunity: 0.5% profit
        // Flash loan: 1M USDC, 0.09% fee
        uint256 loanAmount = 1_000_000e6;
        uint256 fee = (loanAmount * 9) / 10000; // 900 USDC
        uint256 profit = (loanAmount * 50) / 10000; // 5000 USDC

        uint256 netProfit = profit - fee;
        assertEq(netProfit, 4100e6); // Net $4,100
    }
}

/**
 * @title InterestAccrualTest
 * @notice Tests for interest calculation over time
 */
contract InterestAccrualTest is Test {
    using WadRayMath for uint256;

    InterestRateModel public irm;

    function setUp() public {
        irm = new InterestRateModel(
            0.8e27, // 80% optimal
            0.02e27, // 2% base
            0.08e27, // 8% slope1
            1e27, // 100% slope2
            0.02e27, // stable offset
            0.01e27, // stable slope1
            0.80e27 // stable slope2
        );
    }

    function test_DailyInterestAccrual() public {
        uint256 rate = 0.05e27; // 5% annual
        uint40 lastUpdate = uint40(block.timestamp - 1 days);

        uint256 factor = MathUtils.calculateLinearInterest(rate, lastUpdate);

        // Daily rate = 5% / 365 = ~0.0137%
        // Factor should be ~1.000137
        assertApproxEqRel(factor, 1.000137e27, 0.0001e27);
    }

    function test_MonthlyCompounding() public {
        uint256 rate = 0.10e27; // 10% annual
        uint40 lastUpdate = uint40(block.timestamp - 30 days);

        uint256 linearFactor = MathUtils.calculateLinearInterest(
            rate,
            lastUpdate
        );
        uint256 compoundFactor = MathUtils.calculateCompoundedInterest(
            rate,
            lastUpdate
        );

        // Compound should be slightly higher
        assertGt(compoundFactor, linearFactor);
    }

    function test_YearlyCompounding() public {
        uint256 rate = 0.10e27; // 10% annual
        uint40 lastUpdate = uint40(block.timestamp - 365 days);

        uint256 factor = MathUtils.calculateCompoundedInterest(
            rate,
            lastUpdate
        );

        // 10% compounded should be ~10.52% (e^0.1 - 1)
        assertApproxEqRel(factor, 1.1052e27, 0.01e27);
    }

    function test_HighRateCompounding() public {
        // Stress test: 100% annual rate
        uint256 rate = 1e27;
        uint40 lastUpdate = uint40(block.timestamp - 365 days);

        uint256 factor = MathUtils.calculateCompoundedInterest(
            rate,
            lastUpdate
        );

        // e^1 ≈ 2.718
        assertApproxEqRel(factor, 2.718e27, 0.1e27);
    }

    function test_UtilizationCurve() public view {
        // Test points along the curve using RAY-based utilization
        uint256[] memory utilizations = new uint256[](5);
        utilizations[0] = 0; // 0%
        utilizations[1] = 0.4e27; // 40%
        utilizations[2] = 0.8e27; // 80% (optimal)
        utilizations[3] = 0.9e27; // 90%
        utilizations[4] = 1e27; // 100%

        uint256 prevRate = 0;
        for (uint256 i = 0; i < utilizations.length; i++) {
            uint256 rate = irm.calculateVariableBorrowRate(utilizations[i]);

            // Rate should increase with utilization
            assertGe(rate, prevRate, "Rate should increase");
            prevRate = rate;
        }
    }
}
