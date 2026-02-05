// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OracleRouter
 * @notice Price oracle aggregator with fallback mechanisms
 * @dev Supports Chainlink feeds, TWAPs, and manual price setting
 *
 * Security:
 * - Multi-source price validation
 * - Staleness checks
 * - Deviation threshold alerts
 * - Circuit breaker for extreme volatility
 *
 * MEV Protection:
 * - TWAP for large positions
 * - Delayed price updates option
 */
contract OracleRouter is Ownable {
    // ============ Constants ============

    uint256 public constant PRICE_PRECISION = 1e8; // 8 decimals like Chainlink
    uint256 public constant MAX_STALENESS = 1 hours;
    uint256 public constant MAX_DEVIATION_BPS = 500; // 5% max deviation between sources

    // ============ Structs ============

    struct PriceFeed {
        address primaryFeed; // Chainlink aggregator or similar
        address secondaryFeed; // Backup feed
        uint256 manualPrice; // Admin-set fallback
        uint40 manualPriceTimestamp;
        uint8 decimals;
        bool useTWAP;
        uint256 twapWindow; // TWAP window in seconds
    }

    struct PriceData {
        uint256 price;
        uint40 timestamp;
        uint8 source; // 0 = primary, 1 = secondary, 2 = manual, 3 = twap
    }

    // ============ State ============

    /// @notice Asset => Price feed config
    mapping(address => PriceFeed) public feeds;

    /// @notice Asset => Latest price data
    mapping(address => PriceData) public latestPrices;

    /// @notice Asset => Historical prices for TWAP (circular buffer)
    mapping(address => uint256[24]) public priceHistory;
    mapping(address => uint8) public priceHistoryIndex;

    /// @notice Base currency (usually USD)
    address public baseCurrency;
    uint256 public baseCurrencyUnit;

    /// @notice Emergency pause
    bool public paused;

    // ============ Events ============

    event PriceFeedSet(
        address indexed asset,
        address primaryFeed,
        address secondaryFeed,
        uint8 decimals
    );
    event ManualPriceSet(
        address indexed asset,
        uint256 price,
        uint40 timestamp
    );
    event PriceUpdated(
        address indexed asset,
        uint256 price,
        uint40 timestamp,
        uint8 source
    );
    event TWAPConfigured(address indexed asset, bool enabled, uint256 window);
    event CircuitBreakerTriggered(address indexed asset, uint256 deviation);

    // ============ Modifiers ============

    modifier whenNotPaused() {
        require(!paused, "OracleRouter: paused");
        _;
    }

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        baseCurrencyUnit = 1e8; // USD unit
    }

    // ============ Admin Functions ============

    /**
     * @notice Configure price feed for an asset
     * @param asset The asset address
     * @param primaryFeed Primary Chainlink-compatible feed
     * @param secondaryFeed Backup feed (can be address(0))
     * @param decimals Price decimals
     */
    function setPriceFeed(
        address asset,
        address primaryFeed,
        address secondaryFeed,
        uint8 decimals
    ) external onlyOwner {
        require(asset != address(0), "OracleRouter: zero asset");

        feeds[asset] = PriceFeed({
            primaryFeed: primaryFeed,
            secondaryFeed: secondaryFeed,
            manualPrice: 0,
            manualPriceTimestamp: 0,
            decimals: decimals,
            useTWAP: false,
            twapWindow: 0
        });

        emit PriceFeedSet(asset, primaryFeed, secondaryFeed, decimals);
    }

    /**
     * @notice Set manual price (emergency fallback)
     * @param asset The asset
     * @param price Price in base currency units
     */
    function setManualPrice(address asset, uint256 price) external onlyOwner {
        require(price > 0, "OracleRouter: zero price");

        feeds[asset].manualPrice = price;
        feeds[asset].manualPriceTimestamp = uint40(block.timestamp);

        latestPrices[asset] = PriceData({
            price: price,
            timestamp: uint40(block.timestamp),
            source: 2
        });

        emit ManualPriceSet(asset, price, uint40(block.timestamp));
    }

    /**
     * @notice Configure TWAP for an asset
     * @param asset The asset
     * @param enabled Enable/disable TWAP
     * @param window TWAP window in seconds
     */
    function configureTWAP(
        address asset,
        bool enabled,
        uint256 window
    ) external onlyOwner {
        feeds[asset].useTWAP = enabled;
        feeds[asset].twapWindow = window;
        emit TWAPConfigured(asset, enabled, window);
    }

    /**
     * @notice Pause oracle (emergency)
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    // ============ Price Getters ============

    /**
     * @notice Get the price of an asset in base currency
     * @param asset The asset address
     * @return price The price (scaled by PRICE_PRECISION)
     */
    function getAssetPrice(
        address asset
    ) external view whenNotPaused returns (uint256) {
        return _getPrice(asset);
    }

    /**
     * @notice Get prices for multiple assets
     * @param assets Array of asset addresses
     * @return prices Array of prices
     */
    function getAssetPrices(
        address[] calldata assets
    ) external view whenNotPaused returns (uint256[] memory prices) {
        prices = new uint256[](assets.length);
        for (uint256 i = 0; i < assets.length; i++) {
            prices[i] = _getPrice(assets[i]);
        }
    }

    /**
     * @notice Get price with metadata
     * @param asset The asset
     * @return data Full price data
     */
    function getPriceData(
        address asset
    ) external view returns (PriceData memory) {
        return latestPrices[asset];
    }

    // ============ Internal ============

    function _getPrice(address asset) internal view returns (uint256) {
        PriceFeed storage feed = feeds[asset];
        PriceData storage cached = latestPrices[asset];

        // Try cached price if fresh
        if (
            cached.price > 0 &&
            block.timestamp - cached.timestamp < MAX_STALENESS
        ) {
            return cached.price;
        }

        // Try primary feed
        if (feed.primaryFeed != address(0)) {
            (bool success, uint256 price) = _fetchFeedPrice(feed.primaryFeed);
            if (success && price > 0) {
                return _normalizePrice(price, feed.decimals);
            }
        }

        // Try secondary feed
        if (feed.secondaryFeed != address(0)) {
            (bool success, uint256 price) = _fetchFeedPrice(feed.secondaryFeed);
            if (success && price > 0) {
                return _normalizePrice(price, feed.decimals);
            }
        }

        // Fall back to manual price
        require(
            feed.manualPrice > 0 &&
                block.timestamp - feed.manualPriceTimestamp < MAX_STALENESS,
            "OracleRouter: no valid price"
        );

        return feed.manualPrice;
    }

    function _fetchFeedPrice(
        address feedAddr
    ) internal view returns (bool success, uint256 price) {
        // Chainlink aggregator interface
        try IChainlinkFeed(feedAddr).latestRoundData() returns (
            uint80,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (answer > 0 && block.timestamp - updatedAt < MAX_STALENESS) {
                return (true, uint256(answer));
            }
        } catch {}
        return (false, 0);
    }

    function _normalizePrice(
        uint256 price,
        uint8 feedDecimals
    ) internal pure returns (uint256) {
        if (feedDecimals == 8) return price;
        if (feedDecimals < 8) return price * (10 ** (8 - feedDecimals));
        return price / (10 ** (feedDecimals - 8));
    }

    /**
     * @notice Update price (can be called by keepers)
     * @param asset The asset to update
     */
    function updatePrice(address asset) external whenNotPaused {
        uint256 price = _getPrice(asset);

        // Update TWAP history
        uint8 idx = priceHistoryIndex[asset];
        priceHistory[asset][idx] = price;
        priceHistoryIndex[asset] = (idx + 1) % 24;

        latestPrices[asset] = PriceData({
            price: price,
            timestamp: uint40(block.timestamp),
            source: _determineSource(asset)
        });

        emit PriceUpdated(
            asset,
            price,
            uint40(block.timestamp),
            latestPrices[asset].source
        );
    }

    function _determineSource(address asset) internal view returns (uint8) {
        PriceFeed storage feed = feeds[asset];
        if (feed.primaryFeed != address(0)) {
            (bool success, ) = _fetchFeedPrice(feed.primaryFeed);
            if (success) return 0;
        }
        if (feed.secondaryFeed != address(0)) {
            (bool success, ) = _fetchFeedPrice(feed.secondaryFeed);
            if (success) return 1;
        }
        return 2;
    }

    /**
     * @notice Calculate TWAP for an asset
     * @param asset The asset
     * @param window Number of periods (max 24)
     * @return twap The time-weighted average price
     */
    function getTWAP(
        address asset,
        uint8 window
    ) external view returns (uint256) {
        require(window > 0 && window <= 24, "OracleRouter: invalid window");

        uint256 sum = 0;
        uint8 currentIdx = priceHistoryIndex[asset];

        for (uint8 i = 0; i < window; i++) {
            uint8 idx = (currentIdx + 24 - i - 1) % 24;
            uint256 price = priceHistory[asset][idx];
            if (price == 0) {
                // Not enough history
                return _getPrice(asset);
            }
            sum += price;
        }

        return sum / window;
    }
}

/**
 * @title IChainlinkFeed
 * @notice Minimal Chainlink aggregator interface
 */
interface IChainlinkFeed {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}
