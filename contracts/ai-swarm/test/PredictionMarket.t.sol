// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PredictionMarket.sol";
import "../script/Deploy.s.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract PredictionMarketTest is Test {
    PredictionMarket public market;
    MockERC20 public token;

    address public admin = address(1);
    address public treasury = address(2);
    address public trader1 = address(3);
    address public trader2 = address(4);
    address public aiAgent = address(5);

    uint256 constant MIN_LIQUIDITY = 1000e18;
    uint256 constant PRICE_PRECISION = 1e18;

    function setUp() public {
        // Deploy mock token
        token = new MockERC20("X3 Token", "X3");

        // Deploy prediction market
        PredictionMarket impl = new PredictionMarket();
        bytes memory initData = abi.encodeWithSelector(
            PredictionMarket.initialize.selector,
            admin,
            address(token),
            treasury,
            100 // 1% fee
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        market = PredictionMarket(address(proxy));

        // Mint tokens
        token.mint(trader1, 100000e18);
        token.mint(trader2, 100000e18);
        token.mint(aiAgent, 10000e18);

        // Approve market
        vm.prank(trader1);
        token.approve(address(market), type(uint256).max);
        vm.prank(trader2);
        token.approve(address(market), type(uint256).max);
        vm.prank(aiAgent);
        token.approve(address(market), type(uint256).max);
    }

    function testCreateMarket() public {
        uint256 marketId = market.createMarket(
            PredictionMarket.MarketType.PRICE,
            "Will ETH be above $5000 by end of 2025?",
            block.timestamp + 365 days,
            200, // 2% fee
            admin,
            abi.encode("ETH/USD", 5000)
        );

        assertEq(marketId, 1);

        PredictionMarket.Market memory m = market.getMarket(marketId);
        assertEq(m.marketId, 1);
        assertEq(
            uint256(m.status),
            uint256(PredictionMarket.MarketStatus.CREATED)
        );
        assertEq(m.creator, address(this));
    }

    function testSeedMarket() public {
        uint256 marketId = _createBasicMarket();

        vm.prank(trader1);
        market.seedMarket(marketId, MIN_LIQUIDITY);

        PredictionMarket.Market memory m = market.getMarket(marketId);
        assertEq(
            uint256(m.status),
            uint256(PredictionMarket.MarketStatus.ACTIVE)
        );
        assertEq(m.totalLiquidity, MIN_LIQUIDITY);
        assertEq(m.yesShares, MIN_LIQUIDITY);
        assertEq(m.noShares, MIN_LIQUIDITY);

        // Check initial prices (should be 50/50)
        (uint256 yesPrice, uint256 noPrice) = market.getPrices(marketId);
        assertEq(yesPrice, PRICE_PRECISION / 2);
        assertEq(noPrice, PRICE_PRECISION / 2);
    }

    function testBuyYes() public {
        uint256 marketId = _createAndSeedMarket();

        (uint256 yesPrice, ) = market.getPrices(marketId);
        uint256 yesPriceBefore = yesPrice;

        vm.prank(trader1);
        (uint256 shares, uint256 cost) = market.buy(
            marketId,
            true, // YES
            100e18, // max cost
            0 // min shares
        );

        assertTrue(shares > 0);
        assertEq(cost, 100e18);

        // Price should have increased
        (yesPrice, ) = market.getPrices(marketId);
        assertTrue(yesPrice > yesPriceBefore);

        // Check position
        PredictionMarket.Position memory pos = market.getPosition(
            marketId,
            trader1
        );
        assertTrue(pos.yesShares > MIN_LIQUIDITY / 2); // More than seeder portion
    }

    function testBuyNo() public {
        uint256 marketId = _createAndSeedMarket();

        (, uint256 noPrice) = market.getPrices(marketId);
        uint256 noPriceBefore = noPrice;

        vm.prank(trader2);
        (uint256 shares, uint256 cost) = market.buy(
            marketId,
            false, // NO
            100e18,
            0
        );

        assertTrue(shares > 0);

        // NO price should have increased
        (, noPrice) = market.getPrices(marketId);
        assertTrue(noPrice > noPriceBefore);
    }

    function testSell() public {
        uint256 marketId = _createAndSeedMarket();

        // Buy first
        vm.prank(trader1);
        market.buy(marketId, true, 100e18, 0);

        PredictionMarket.Position memory posBefore = market.getPosition(
            marketId,
            trader1
        );
        uint256 balanceBefore = token.balanceOf(trader1);

        // Sell some shares
        uint256 sellShares = posBefore.yesShares / 2;

        vm.prank(trader1);
        uint256 returnAmount = market.sell(marketId, true, sellShares, 0);

        assertTrue(returnAmount > 0);

        uint256 balanceAfter = token.balanceOf(trader1);
        assertEq(balanceAfter - balanceBefore, returnAmount);
    }

    function testResolveMarketYes() public {
        uint256 marketId = _createAndSeedMarket();

        // Trade to create positions
        vm.prank(trader1);
        market.buy(marketId, true, 500e18, 0);
        vm.prank(trader2);
        market.buy(marketId, false, 500e18, 0);

        // Fast forward past resolution time
        vm.warp(block.timestamp + 366 days);

        // Resolve as YES
        vm.prank(admin);
        market.resolveMarket(marketId, PredictionMarket.Outcome.YES);

        PredictionMarket.Market memory m = market.getMarket(marketId);
        assertEq(
            uint256(m.status),
            uint256(PredictionMarket.MarketStatus.RESOLVED)
        );
        assertEq(uint256(m.resolution), uint256(PredictionMarket.Outcome.YES));
    }

    function testClaim() public {
        uint256 marketId = _createAndSeedMarket();

        // Trader1 buys YES
        vm.prank(trader1);
        market.buy(marketId, true, 500e18, 0);

        // Trader2 buys NO
        vm.prank(trader2);
        market.buy(marketId, false, 500e18, 0);

        PredictionMarket.Position memory pos1 = market.getPosition(
            marketId,
            trader1
        );

        // Resolve as YES
        vm.warp(block.timestamp + 366 days);
        vm.prank(admin);
        market.resolveMarket(marketId, PredictionMarket.Outcome.YES);

        // Trader1 claims
        uint256 balanceBefore = token.balanceOf(trader1);

        vm.prank(trader1);
        uint256 payout = market.claim(marketId);

        uint256 balanceAfter = token.balanceOf(trader1);
        assertEq(payout, pos1.yesShares);
        assertEq(balanceAfter - balanceBefore, payout);

        // Trader2 claims (should get 0 for NO position)
        vm.prank(trader2);
        payout = market.claim(marketId);
        assertEq(payout, 0);
    }

    function testSubmitAISignal() public {
        uint256 marketId = _createAndSeedMarket();

        vm.prank(aiAgent);
        market.submitAISignal(
            marketId,
            true, // Predicts YES
            850, // 85% confidence
            "Based on historical data and current trends"
        );

        PredictionMarket.AISignal[] memory signals = market.getAISignals(
            marketId
        );
        assertEq(signals.length, 1);
        assertEq(signals[0].agent, aiAgent);
        assertTrue(signals[0].prediction);
        assertEq(signals[0].confidence, 850);
    }

    function testAIConsensus() public {
        uint256 marketId = _createAndSeedMarket();

        // Multiple agents submit signals
        vm.prank(aiAgent);
        market.submitAISignal(marketId, true, 800, "Bullish");

        address agent2 = address(6);
        vm.prank(agent2);
        market.submitAISignal(marketId, true, 900, "Very bullish");

        address agent3 = address(7);
        vm.prank(agent3);
        market.submitAISignal(marketId, false, 600, "Bearish");

        (uint256 yesVotes, uint256 noVotes, uint256 avgConfidence) = market
            .getAIConsensus(marketId);

        assertEq(yesVotes, 2);
        assertEq(noVotes, 1);
        assertEq(avgConfidence, 766);
    }

    function testQuoteBuy() public {
        uint256 marketId = _createAndSeedMarket();

        (uint256 shares, uint256 cost) = market.quoteBuy(
            marketId,
            true,
            100e18
        );

        assertTrue(shares > 0);
        assertEq(cost, 100e18);
    }

    function testQuoteSell() public {
        uint256 marketId = _createAndSeedMarket();

        // Buy first
        vm.prank(trader1);
        market.buy(marketId, true, 100e18, 0);

        PredictionMarket.Position memory pos = market.getPosition(
            marketId,
            trader1
        );

        uint256 returnAmount = market.quoteSell(
            marketId,
            true,
            pos.yesShares / 2
        );

        assertTrue(returnAmount > 0);
    }

    function testMarketMetrics() public {
        uint256 marketId = _createAndSeedMarket();

        // Do some trades
        vm.prank(trader1);
        market.buy(marketId, true, 100e18, 0);

        vm.prank(trader2);
        market.buy(marketId, false, 200e18, 0);

        PredictionMarket.MarketMetrics memory metrics = market.getMetrics(
            marketId
        );
        assertEq(metrics.totalVolume, 300e18);
        assertTrue(metrics.lastTradeTime > 0);
    }

    function testCannotResolveBeforeTime() public {
        uint256 marketId = _createAndSeedMarket();

        vm.prank(admin);
        vm.expectRevert(PredictionMarket.ResolutionTimeNotReached.selector);
        market.resolveMarket(marketId, PredictionMarket.Outcome.YES);
    }

    function testCannotClaimBeforeResolution() public {
        uint256 marketId = _createAndSeedMarket();

        vm.prank(trader1);
        market.buy(marketId, true, 100e18, 0);

        vm.prank(trader1);
        vm.expectRevert(PredictionMarket.MarketNotResolved.selector);
        market.claim(marketId);
    }

    function testCannotDoubleClaim() public {
        uint256 marketId = _createAndSeedMarket();

        vm.prank(trader1);
        market.buy(marketId, true, 100e18, 0);

        // Resolve
        vm.warp(block.timestamp + 366 days);
        vm.prank(admin);
        market.resolveMarket(marketId, PredictionMarket.Outcome.YES);

        // First claim
        vm.prank(trader1);
        market.claim(marketId);

        // Second claim should fail
        vm.prank(trader1);
        vm.expectRevert(PredictionMarket.AlreadyClaimed.selector);
        market.claim(marketId);
    }

    // ============ Helper Functions ============

    function _createBasicMarket() internal returns (uint256) {
        return
            market.createMarket(
                PredictionMarket.MarketType.PRICE,
                "Test market",
                block.timestamp + 365 days,
                100, // 1% fee
                admin,
                ""
            );
    }

    function _createAndSeedMarket() internal returns (uint256) {
        uint256 marketId = _createBasicMarket();

        vm.prank(trader1);
        market.seedMarket(marketId, MIN_LIQUIDITY);

        return marketId;
    }
}
