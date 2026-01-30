// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/Pool.sol";
import "../src/core/OracleRouter.sol";
import "../src/core/InterestRateModel.sol";
import "../src/core/CollateralManager.sol";
import "../src/core/PoolConfigurator.sol";
import "../src/tokens/AToken.sol";
import "../src/tokens/DebtTokens.sol";
import "../src/libraries/MathLibraries.sol";
import "../script/Deploy.s.sol";

/**
 * @title PoolTest
 * @notice Comprehensive tests for the lending pool
 */
contract PoolTest is Test {
    using WadRayMath for uint256;

    // Contracts
    OracleRouter public oracle;
    InterestRateModel public irm;
    CollateralManager public collateralManager;
    Pool public pool;
    PoolConfigurator public configurator;

    // Mock tokens
    MockERC20 public usdc;
    MockERC20 public weth;

    // Test users
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public liquidator = makeAddr("liquidator");
    address public treasury = makeAddr("treasury");

    function setUp() public {
        // Deploy mock tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);

        // Deploy protocol
        oracle = new OracleRouter();
        irm = new InterestRateModel(
            0.8e27, // 80% optimal utilization
            0.02e27, // 2% base rate
            0.08e27, // 8% slope1
            1e27, // 100% slope2
            0.02e27, // 2% stable offset
            0.01e27, // 1% stable slope1
            0.80e27 // 80% stable slope2
        );
        collateralManager = new CollateralManager(address(oracle));
        pool = new Pool(address(this));
        configurator = new PoolConfigurator();

        // Initialize
        pool.initialize(address(oracle), treasury, address(configurator));
        configurator.initialize(
            address(pool),
            address(collateralManager),
            address(oracle),
            address(irm)
        );
        collateralManager.setPool(address(pool));

        // Set prices
        oracle.setManualPrice(address(usdc), 1e8); // $1
        oracle.setManualPrice(address(weth), 2500e8); // $2500

        // Configure reserves via direct calls (simplified for testing)
        collateralManager.configureCollateral(
            address(usdc),
            8000, // 80% LTV
            8500, // 85% liquidation threshold
            10500, // 5% bonus
            6
        );
        collateralManager.configureCollateral(
            address(weth),
            8000,
            8250,
            10500,
            18
        );

        // Mint tokens to users
        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        usdc.mint(liquidator, 100_000e6);
        weth.mint(alice, 100e18);
        weth.mint(bob, 100e18);
    }

    // ============ Math Library Tests ============

    function test_WadMul() public pure {
        uint256 a = 1.5e18;
        uint256 b = 2e18;
        uint256 result = a.wadMul(b);
        assertEq(result, 3e18);
    }

    function test_RayMul() public pure {
        uint256 a = 1.5e27;
        uint256 b = 2e27;
        uint256 result = a.rayMul(b);
        assertEq(result, 3e27);
    }

    function test_WadDiv() public pure {
        uint256 a = 6e18;
        uint256 b = 2e18;
        uint256 result = a.wadDiv(b);
        assertEq(result, 3e18);
    }

    function test_PercentMul() public pure {
        uint256 value = 10000;
        uint256 percentage = 5000; // 50%
        uint256 result = PercentageMath.percentMul(value, percentage);
        assertEq(result, 5000);
    }

    function test_LinearInterest() public {
        uint256 rate = 0.05e27; // 5% annual
        uint40 lastUpdate = uint40(block.timestamp - 365 days);

        uint256 accumulated = MathUtils.calculateLinearInterest(
            rate,
            lastUpdate
        );

        // After 1 year at 5%, factor should be ~1.05
        assertApproxEqRel(accumulated, 1.05e27, 0.001e27);
    }

    function test_CompoundInterest() public {
        uint256 rate = 0.10e27; // 10% annual
        uint40 lastUpdate = uint40(block.timestamp - 365 days);

        uint256 accumulated = MathUtils.calculateCompoundedInterest(
            rate,
            lastUpdate
        );

        // After 1 year at 10% compounded, should be > 1.10
        assertGt(accumulated, 1.10e27);
    }

    // ============ Oracle Tests ============

    function test_OracleGetPrice() public view {
        uint256 usdcPrice = oracle.getAssetPrice(address(usdc));
        assertEq(usdcPrice, 1e8);

        uint256 wethPrice = oracle.getAssetPrice(address(weth));
        assertEq(wethPrice, 2500e8);
    }

    function test_OracleSetPrice() public {
        oracle.setManualPrice(address(weth), 3000e8);
        uint256 newPrice = oracle.getAssetPrice(address(weth));
        assertEq(newPrice, 3000e8);
    }

    function testFail_OracleZeroPrice() public {
        oracle.setManualPrice(address(usdc), 0);
    }

    // ============ Interest Rate Model Tests ============

    function test_IRMBaseRate() public view {
        // 0% utilization - get the actual base rate
        uint256 rate = irm.calculateVariableBorrowRate(0);
        assertEq(rate, 0.02e27); // base rate
    }

    function test_IRMOptimalUtilization() public view {
        // 80% utilization (optimal)
        uint256 rate = irm.calculateVariableBorrowRate(0.8e27);
        // Should be baseRate + slope1 = 0.02 + 0.08 = 0.10
        assertApproxEqRel(rate, 0.10e27, 0.01e27);
    }

    function test_IRMAboveOptimal() public view {
        // 90% utilization (above optimal)
        uint256 rate = irm.calculateVariableBorrowRate(0.9e27);
        // Should be higher due to slope2
        assertGt(rate, 0.10e27);
    }

    function test_IRMFullUtilization() public view {
        // 100% utilization
        uint256 rate = irm.calculateVariableBorrowRate(1e27);
        // Should be max: baseRate + slope1 + slope2 = 0.02 + 0.08 + 1.0 = 1.10
        assertApproxEqRel(rate, 1.10e27, 0.01e27);
    }

    // ============ Collateral Manager Tests ============

    function test_CollateralConfig() public view {
        CollateralManager.CollateralConfig memory config = collateralManager
            .getCollateralConfig(address(usdc));

        assertEq(config.ltv, 8000);
        assertEq(config.liquidationThreshold, 8500);
        assertEq(config.liquidationBonus, 10500);
        assertTrue(config.active);
    }

    function test_GetLTV() public view {
        uint256 ltv = collateralManager.getLtv(address(usdc), alice);
        assertEq(ltv, 8000);
    }

    // ============ Health Factor Tests ============

    function test_HealthFactorCalculation() public pure {
        uint256 collateral = 10000e8; // $10,000
        uint256 debt = 5000e8; // $5,000
        uint256 liquidationThreshold = 8500; // 85%

        uint256 hf = HealthFactorLogic.calculateHealthFactor(
            collateral,
            debt,
            liquidationThreshold
        );

        // HF = (10000 * 0.85) / 5000 = 1.7
        assertApproxEqRel(hf, 1.7e18, 0.01e18);
    }

    function test_HealthFactorLiquidatable() public pure {
        uint256 collateral = 10000e8;
        uint256 debt = 9000e8; // High debt
        uint256 liquidationThreshold = 8500;

        uint256 hf = HealthFactorLogic.calculateHealthFactor(
            collateral,
            debt,
            liquidationThreshold
        );

        // HF = (10000 * 0.85) / 9000 = 0.944 < 1
        assertLt(hf, 1e18);
    }

    function test_AvailableBorrows() public pure {
        uint256 collateral = 10000e8;
        uint256 debt = 2000e8;
        uint256 ltv = 8000; // 80%

        uint256 available = HealthFactorLogic.calculateAvailableBorrows(
            collateral,
            debt,
            ltv
        );

        // Available = (10000 * 0.80) - 2000 = 6000
        assertEq(available, 6000e8);
    }

    function test_CollateralToSeize() public pure {
        uint256 debtToCover = 1000e6; // 1000 USDC
        uint256 debtPrice = 1e8; // $1
        uint256 collateralPrice = 2500e8; // $2500 (ETH)
        uint256 liquidationBonus = 10500; // 5%
        uint8 debtDecimals = 6;
        uint8 collateralDecimals = 18;

        uint256 seized = HealthFactorLogic.calculateCollateralToSeize(
            debtToCover,
            debtPrice,
            collateralPrice,
            liquidationBonus,
            debtDecimals,
            collateralDecimals
        );

        // (1000 * 1 * 1.05) / 2500 = 0.42 ETH
        assertApproxEqRel(seized, 0.42e18, 0.01e18);
    }

    // ============ Token Tests ============

    function test_ATokenMint() public {
        AToken aToken = new AToken(
            address(pool),
            address(usdc),
            treasury,
            address(0),
            "aUSDC",
            "aUSDC"
        );

        // Simulate pool calling mint
        vm.prank(address(pool));
        bool isFirst = aToken.mint(alice, alice, 1000e6, 1e27);

        assertTrue(isFirst);
        assertEq(aToken.balanceOf(alice), 1000e6);
        assertEq(aToken.scaledBalanceOf(alice), 1000e6);
    }

    function test_ATokenBalanceGrows() public {
        AToken aToken = new AToken(
            address(pool),
            address(usdc),
            treasury,
            address(0),
            "aUSDC",
            "aUSDC"
        );

        vm.prank(address(pool));
        aToken.mint(alice, alice, 1000e6, 1e27);

        // Simulate index growth (interest accrual)
        vm.prank(address(pool));
        aToken.mint(alice, alice, 0, 1.1e27); // 10% increase

        // Balance should have grown
        assertApproxEqRel(aToken.balanceOf(alice), 1100e6, 0.01e6);
        // Scaled balance unchanged
        assertEq(aToken.scaledBalanceOf(alice), 1000e6);
    }

    function test_DebtTokenMint() public {
        VariableDebtToken debtToken = new VariableDebtToken(
            address(pool),
            address(usdc),
            "vdUSDC",
            "vdUSDC"
        );

        vm.prank(address(pool));
        (bool isFirst, uint256 scaled) = debtToken.mint(
            alice,
            alice,
            1000e6,
            1e27
        );

        assertTrue(isFirst);
        assertEq(scaled, 1000e6);
        assertEq(debtToken.balanceOf(alice), 1000e6);
    }

    function testFail_DebtTokenTransfer() public {
        VariableDebtToken debtToken = new VariableDebtToken(
            address(pool),
            address(usdc),
            "vdUSDC",
            "vdUSDC"
        );

        vm.prank(address(pool));
        debtToken.mint(alice, alice, 1000e6, 1e27);

        vm.prank(alice);
        debtToken.transfer(bob, 500e6); // Should revert
    }

    function test_CreditDelegation() public {
        VariableDebtToken debtToken = new VariableDebtToken(
            address(pool),
            address(usdc),
            "vdUSDC",
            "vdUSDC"
        );

        // Alice delegates credit to Bob
        vm.prank(alice);
        debtToken.approveDelegation(bob, 1000e6);

        assertEq(debtToken.borrowAllowance(alice, bob), 1000e6);

        // Bob borrows on behalf of Alice
        vm.prank(address(pool));
        debtToken.mint(bob, alice, 500e6, 1e27);

        // Allowance should decrease
        assertEq(debtToken.borrowAllowance(alice, bob), 500e6);
    }

    // ============ Integration Tests ============

    function test_FullDepositWithdrawFlow() public {
        // Setup: Deploy aToken
        AToken aToken = new AToken(
            address(this), // mock pool
            address(usdc),
            treasury,
            address(0),
            "aUSDC",
            "aUSDC"
        );

        // Transfer USDC to aToken contract (simulating deposit)
        usdc.mint(address(aToken), 1000e6);

        // Mint aTokens
        aToken.mint(alice, alice, 1000e6, 1e27);

        assertEq(aToken.balanceOf(alice), 1000e6);

        // Simulate time passing and interest accrual
        // (In real flow, pool would update index)

        // Burn and withdraw
        aToken.burn(alice, alice, 500e6, 1e27);

        assertEq(aToken.balanceOf(alice), 500e6);
        assertEq(usdc.balanceOf(alice), 100_000e6 + 500e6); // Original + withdrawn
    }

    // ============ Edge Cases ============

    function test_ZeroDebtHealthFactor() public pure {
        uint256 hf = HealthFactorLogic.calculateHealthFactor(10000e8, 0, 8500);
        assertEq(hf, type(uint256).max);
    }

    function test_MaxLiquidation() public pure {
        uint256 debt = 10000e8;

        // Deep underwater (HF < 0.95)
        uint256 maxLiq1 = HealthFactorLogic.calculateMaxLiquidatableDebt(
            debt,
            0.5e18, // Very low HF
            5000
        );
        assertEq(maxLiq1, debt); // Full liquidation

        // Slightly underwater (HF between 0.95 and 1.0)
        uint256 maxLiq2 = HealthFactorLogic.calculateMaxLiquidatableDebt(
            debt,
            0.97e18,
            5000
        );
        assertEq(maxLiq2, debt / 2); // 50% liquidation
    }

    // ============ Fuzz Tests ============

    function testFuzz_WadMul(uint128 a, uint128 b) public pure {
        vm.assume(a > 0 && b > 0);
        uint256 result = uint256(a).wadMul(uint256(b));
        assertLe(result, (uint256(a) * uint256(b)) / 1e18 + 1);
    }

    function testFuzz_HealthFactor(
        uint256 collateral,
        uint256 debt,
        uint16 threshold
    ) public pure {
        vm.assume(collateral > 0 && collateral < type(uint128).max);
        vm.assume(debt > 0 && debt < collateral);
        vm.assume(threshold > 0 && threshold <= 10000);

        uint256 hf = HealthFactorLogic.calculateHealthFactor(
            collateral,
            debt,
            threshold
        );

        // HF should be positive
        assertGt(hf, 0);
    }

    // ============ Gas Benchmarks ============

    function test_GasHealthFactorCalculation() public view {
        uint256 gasBefore = gasleft();

        for (uint256 i = 0; i < 100; i++) {
            HealthFactorLogic.calculateHealthFactor(10000e8, 5000e8, 8500);
        }

        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas for 100 HF calculations:", gasUsed);
        console.log("Gas per calculation:", gasUsed / 100);
    }

    function test_GasInterestCalculation() public view {
        uint256 gasBefore = gasleft();

        for (uint256 i = 0; i < 100; i++) {
            MathUtils.calculateCompoundedInterest(
                0.05e27,
                uint40(block.timestamp - 1 days)
            );
        }

        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas for 100 compound interest calculations:", gasUsed);
    }
}

/**
 * @title OracleRouterTest
 * @notice Tests for oracle functionality
 */
contract OracleRouterTest is Test {
    OracleRouter public oracle;
    MockERC20 public usdc;

    function setUp() public {
        oracle = new OracleRouter();
        usdc = new MockERC20("USDC", "USDC", 6);
    }

    function test_SetAndGetPrice() public {
        oracle.setManualPrice(address(usdc), 1e8);
        assertEq(oracle.getAssetPrice(address(usdc)), 1e8);
    }

    function test_UpdatePrice() public {
        oracle.setManualPrice(address(usdc), 1e8);
        oracle.updatePrice(address(usdc));

        OracleRouter.PriceData memory data = oracle.getPriceData(address(usdc));
        assertEq(data.price, 1e8);
        assertEq(data.source, 2); // Manual source
    }

    function test_PriceHistory() public {
        oracle.setManualPrice(address(usdc), 1e8);

        // Update multiple times
        for (uint256 i = 0; i < 5; i++) {
            oracle.setManualPrice(address(usdc), uint256(1e8 + i * 1e6));
            oracle.updatePrice(address(usdc));
        }

        // Get TWAP (should average recent prices)
        uint256 twap = oracle.getTWAP(address(usdc), 5);
        assertGt(twap, 0);
    }

    function testFail_ZeroAsset() public {
        oracle.setManualPrice(address(0), 1e8);
    }
}

/**
 * @title CollateralManagerTest
 * @notice Tests for collateral configuration
 */
contract CollateralManagerTest is Test {
    CollateralManager public manager;
    OracleRouter public oracle;

    function setUp() public {
        oracle = new OracleRouter();
        manager = new CollateralManager(address(oracle));
    }

    function test_ConfigureCollateral() public {
        address asset = makeAddr("asset");

        manager.configureCollateral(
            asset,
            8000, // 80% LTV
            8500, // 85% liquidation threshold
            10500, // 5% bonus
            18
        );

        assertTrue(manager.isCollateralEnabled(asset));
        assertTrue(manager.isBorrowingEnabled(asset));
    }

    function test_SetCaps() public {
        address asset = makeAddr("asset");
        manager.configureCollateral(asset, 8000, 8500, 10500, 18);

        manager.setCaps(asset, 1_000_000e18, 500_000e18);

        assertEq(manager.getSupplyCap(asset), 1_000_000e18);
        assertEq(manager.getBorrowCap(asset), 500_000e18);
    }

    function test_EMode() public {
        // Add stablecoin eMode
        manager.addEModeCategory(
            1, // categoryId
            9500, // 95% LTV
            9700, // 97% liquidation threshold
            10100, // 1% bonus
            address(0),
            "Stablecoins"
        );

        CollateralManager.EModeCategory memory cat = manager.getEModeCategory(
            1
        );
        assertEq(cat.ltv, 9500);
        assertEq(cat.label, "Stablecoins");
    }

    function testFail_LTVTooHigh() public {
        address asset = makeAddr("asset");
        manager.configureCollateral(
            asset,
            9500, // > 90% max
            9600,
            10500,
            18
        );
    }

    function testFail_ThresholdBelowLTV() public {
        address asset = makeAddr("asset");
        manager.configureCollateral(
            asset,
            8000,
            7000, // Below LTV
            10500,
            18
        );
    }
}
