// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PriceOracle
 * @notice Multi-source price oracle for X3 Chain
 * @dev Aggregates prices from multiple sources with TWAP and deviation checks
 * 
 * Features:
 * - Multi-source price aggregation
 * - Time-weighted average prices (TWAP)
 * - Deviation protection
 * - Chainlink integration ready
 * - Cross-VM price feeds
 */
contract PriceOracle is AccessControl, Pausable {
    // ═══════════════════════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    struct PriceFeed {
        uint256 price;              // Price with 18 decimals
        uint256 timestamp;          // Last update time
        uint256 confidence;         // Confidence level (0-10000 BPS)
        uint8 decimals;             // Price decimals
        bool active;                // Feed is active
        address source;             // Price source address
        PriceSourceType sourceType; // Type of price source
    }

    struct TokenConfig {
        string symbol;
        uint8 decimals;
        bool active;
        uint256 heartbeat;          // Max seconds between updates
        uint256 deviationThreshold; // Max price deviation in BPS
        address[] priceSources;     // Multiple price sources
    }

    struct TWAPObservation {
        uint256 timestamp;
        uint256 price;
        uint256 cumulativePrice;
    }

    enum PriceSourceType {
        INTERNAL,       // Internal oracle updates
        CHAINLINK,      // Chainlink price feed
        UNISWAP_V3,     // Uniswap V3 TWAP
        DEX_SPOT,       // DEX spot price
        CROSS_VM        // Cross-VM price feed
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS & ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    bytes32 public constant CONFIG_MANAGER_ROLE = keccak256("CONFIG_MANAGER_ROLE");

    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_DEVIATION_BPS = 5000; // 50%
    uint256 public constant MIN_CONFIDENCE = 5000;    // 50%
    uint256 public constant TWAP_PERIOD = 30 minutes;
    uint256 public constant MAX_OBSERVATIONS = 24;    // Store 24 observations

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    // Token address => Token config
    mapping(address => TokenConfig) public tokenConfigs;

    // Token address => Latest price feed
    mapping(address => PriceFeed) public latestPrices;

    // Token address => TWAP observations
    mapping(address => TWAPObservation[]) public twapObservations;

    // Token address => Source address => Price feed
    mapping(address => mapping(address => PriceFeed)) public sourcePrices;

    // Registered tokens
    address[] public registeredTokens;

    // Base token (e.g., USD stablecoin for pricing)
    address public baseToken;

    // Emergency fallback price (used when all sources fail)
    mapping(address => uint256) public fallbackPrices;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event PriceUpdated(
        address indexed token,
        uint256 price,
        uint256 timestamp,
        address indexed source,
        PriceSourceType sourceType
    );

    event TokenConfigured(
        address indexed token,
        string symbol,
        uint256 heartbeat,
        uint256 deviationThreshold
    );

    event PriceSourceAdded(
        address indexed token,
        address indexed source,
        PriceSourceType sourceType
    );

    event PriceSourceRemoved(address indexed token, address indexed source);

    event StalePrice(address indexed token, uint256 lastUpdate, uint256 heartbeat);

    event PriceDeviation(
        address indexed token,
        uint256 reportedPrice,
        uint256 aggregatedPrice,
        uint256 deviationBps
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(address _baseToken) {
        require(_baseToken != address(0), "Invalid base token");
        baseToken = _baseToken;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PRICE_UPDATER_ROLE, msg.sender);
        _grantRole(CONFIG_MANAGER_ROLE, msg.sender);

        // Configure base token with 1:1 price
        _configureToken(
            _baseToken,
            "USD",
            18,
            1 hours,
            100 // 1% deviation
        );
        
        latestPrices[_baseToken] = PriceFeed({
            price: PRICE_PRECISION,
            timestamp: block.timestamp,
            confidence: BPS_DENOMINATOR,
            decimals: 18,
            active: true,
            source: address(this),
            sourceType: PriceSourceType.INTERNAL
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRICE UPDATES
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update price from authorized source
     */
    function updatePrice(
        address token,
        uint256 price,
        uint256 confidence
    ) external whenNotPaused onlyRole(PRICE_UPDATER_ROLE) {
        require(tokenConfigs[token].active, "Token not configured");
        require(price > 0, "Invalid price");
        require(confidence <= BPS_DENOMINATOR, "Invalid confidence");

        _updatePrice(token, price, confidence, msg.sender, PriceSourceType.INTERNAL);
    }

    /**
     * @notice Batch update prices
     */
    function batchUpdatePrices(
        address[] calldata tokens,
        uint256[] calldata prices,
        uint256[] calldata confidences
    ) external whenNotPaused onlyRole(PRICE_UPDATER_ROLE) {
        require(
            tokens.length == prices.length && prices.length == confidences.length,
            "Array mismatch"
        );

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokenConfigs[tokens[i]].active && prices[i] > 0) {
                _updatePrice(
                    tokens[i],
                    prices[i],
                    confidences[i],
                    msg.sender,
                    PriceSourceType.INTERNAL
                );
            }
        }
    }

    /**
     * @notice Update price from DEX source
     */
    function updateDexPrice(
        address token,
        uint256 price,
        address dexSource
    ) external whenNotPaused onlyRole(PRICE_UPDATER_ROLE) {
        require(tokenConfigs[token].active, "Token not configured");
        require(price > 0, "Invalid price");

        // Store source price
        sourcePrices[token][dexSource] = PriceFeed({
            price: price,
            timestamp: block.timestamp,
            confidence: 8000, // 80% default confidence for DEX
            decimals: 18,
            active: true,
            source: dexSource,
            sourceType: PriceSourceType.DEX_SPOT
        });

        // Aggregate and update main price
        _aggregateAndUpdatePrice(token);
    }

    /**
     * @notice Update cross-VM price feed
     */
    function updateCrossVMPrice(
        address token,
        uint256 price,
        uint8 sourceVM, // 0=EVM, 1=SVM, 2=X3VM
        bytes32 sourceAddress
    ) external whenNotPaused onlyRole(PRICE_UPDATER_ROLE) {
        require(tokenConfigs[token].active, "Token not configured");
        require(price > 0, "Invalid price");

        address pseudoSource = address(uint160(uint256(sourceAddress)));

        sourcePrices[token][pseudoSource] = PriceFeed({
            price: price,
            timestamp: block.timestamp,
            confidence: 7500, // 75% confidence for cross-VM
            decimals: 18,
            active: true,
            source: pseudoSource,
            sourceType: PriceSourceType.CROSS_VM
        });

        _aggregateAndUpdatePrice(token);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRICE RETRIEVAL
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get latest price for a token
     */
    function getPrice(address token) external view returns (uint256 price, uint256 timestamp) {
        PriceFeed storage feed = latestPrices[token];
        require(feed.active, "Price not available");
        require(!_isStale(token), "Price is stale");

        return (feed.price, feed.timestamp);
    }

    /**
     * @notice Get latest price with full details
     */
    function getPriceFeed(address token) external view returns (PriceFeed memory) {
        require(latestPrices[token].active, "Price not available");
        return latestPrices[token];
    }

    /**
     * @notice Get TWAP price
     */
    function getTWAP(address token) external view returns (uint256) {
        TWAPObservation[] storage observations = twapObservations[token];
        require(observations.length > 0, "No observations");

        uint256 targetTime = block.timestamp - TWAP_PERIOD;
        uint256 startIdx = 0;

        // Find oldest observation within TWAP period
        for (uint256 i = 0; i < observations.length; i++) {
            if (observations[i].timestamp >= targetTime) {
                startIdx = i;
                break;
            }
        }

        if (observations.length == 1) {
            return observations[0].price;
        }

        // Calculate TWAP
        uint256 latestIdx = observations.length - 1;
        TWAPObservation storage oldest = observations[startIdx];
        TWAPObservation storage latest = observations[latestIdx];

        uint256 timeDiff = latest.timestamp - oldest.timestamp;
        if (timeDiff == 0) {
            return latest.price;
        }

        uint256 priceDiff = latest.cumulativePrice - oldest.cumulativePrice;
        return priceDiff / timeDiff;
    }

    /**
     * @notice Get price in terms of another token
     */
    function getRelativePrice(
        address baseToken_,
        address quoteToken
    ) external view returns (uint256) {
        require(latestPrices[baseToken_].active, "Base price not available");
        require(latestPrices[quoteToken].active, "Quote price not available");

        uint256 basePrice = latestPrices[baseToken_].price;
        uint256 quotePrice = latestPrices[quoteToken].price;

        return (basePrice * PRICE_PRECISION) / quotePrice;
    }

    /**
     * @notice Check if price is stale
     */
    function isPriceStale(address token) external view returns (bool) {
        return _isStale(token);
    }

    /**
     * @notice Get price with staleness check
     */
    function getSafePrice(
        address token
    ) external view returns (uint256 price, bool isStale, uint256 confidence) {
        PriceFeed storage feed = latestPrices[token];
        
        return (
            feed.price,
            _isStale(token),
            feed.confidence
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOKEN CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Configure a new token for price tracking
     */
    function configureToken(
        address token,
        string calldata symbol,
        uint8 decimals,
        uint256 heartbeat,
        uint256 deviationThreshold
    ) external onlyRole(CONFIG_MANAGER_ROLE) {
        _configureToken(token, symbol, decimals, heartbeat, deviationThreshold);
    }

    /**
     * @notice Add price source for a token
     */
    function addPriceSource(
        address token,
        address source,
        PriceSourceType sourceType
    ) external onlyRole(CONFIG_MANAGER_ROLE) {
        require(tokenConfigs[token].active, "Token not configured");
        
        tokenConfigs[token].priceSources.push(source);

        emit PriceSourceAdded(token, source, sourceType);
    }

    /**
     * @notice Remove price source
     */
    function removePriceSource(
        address token,
        address source
    ) external onlyRole(CONFIG_MANAGER_ROLE) {
        address[] storage sources = tokenConfigs[token].priceSources;
        
        for (uint256 i = 0; i < sources.length; i++) {
            if (sources[i] == source) {
                sources[i] = sources[sources.length - 1];
                sources.pop();
                
                delete sourcePrices[token][source];
                
                emit PriceSourceRemoved(token, source);
                break;
            }
        }
    }

    /**
     * @notice Set fallback price for emergency
     */
    function setFallbackPrice(
        address token,
        uint256 price
    ) external onlyRole(CONFIG_MANAGER_ROLE) {
        require(price > 0, "Invalid price");
        fallbackPrices[token] = price;
    }

    /**
     * @notice Deactivate a token
     */
    function deactivateToken(address token) external onlyRole(CONFIG_MANAGER_ROLE) {
        tokenConfigs[token].active = false;
        latestPrices[token].active = false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getRegisteredTokens() external view returns (address[] memory) {
        return registeredTokens;
    }

    function getTokenConfig(address token) external view returns (TokenConfig memory) {
        return tokenConfigs[token];
    }

    function getPriceSources(address token) external view returns (address[] memory) {
        return tokenConfigs[token].priceSources;
    }

    function getSourcePrice(
        address token,
        address source
    ) external view returns (PriceFeed memory) {
        return sourcePrices[token][source];
    }

    function getTWAPObservations(
        address token
    ) external view returns (TWAPObservation[] memory) {
        return twapObservations[token];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════════════════

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setBaseToken(address newBaseToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newBaseToken != address(0), "Invalid address");
        baseToken = newBaseToken;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function _configureToken(
        address token,
        string memory symbol,
        uint8 decimals,
        uint256 heartbeat,
        uint256 deviationThreshold
    ) internal {
        require(token != address(0), "Invalid token");
        require(heartbeat > 0, "Invalid heartbeat");
        require(deviationThreshold <= MAX_DEVIATION_BPS, "Deviation too high");

        if (!tokenConfigs[token].active) {
            registeredTokens.push(token);
        }

        tokenConfigs[token] = TokenConfig({
            symbol: symbol,
            decimals: decimals,
            active: true,
            heartbeat: heartbeat,
            deviationThreshold: deviationThreshold,
            priceSources: new address[](0)
        });

        emit TokenConfigured(token, symbol, heartbeat, deviationThreshold);
    }

    function _updatePrice(
        address token,
        uint256 price,
        uint256 confidence,
        address source,
        PriceSourceType sourceType
    ) internal {
        TokenConfig storage config = tokenConfigs[token];
        PriceFeed storage currentFeed = latestPrices[token];

        // Check deviation if we have existing price
        if (currentFeed.price > 0) {
            uint256 deviation = _calculateDeviation(currentFeed.price, price);
            
            if (deviation > config.deviationThreshold) {
                emit PriceDeviation(token, price, currentFeed.price, deviation);
                
                // Use fallback or reject if deviation too high
                if (deviation > MAX_DEVIATION_BPS) {
                    if (fallbackPrices[token] > 0) {
                        price = fallbackPrices[token];
                    } else {
                        revert("Price deviation too high");
                    }
                }
            }
        }

        // Update price feed
        latestPrices[token] = PriceFeed({
            price: price,
            timestamp: block.timestamp,
            confidence: confidence,
            decimals: config.decimals,
            active: true,
            source: source,
            sourceType: sourceType
        });

        // Update TWAP observations
        _updateTWAP(token, price);

        emit PriceUpdated(token, price, block.timestamp, source, sourceType);
    }

    function _aggregateAndUpdatePrice(address token) internal {
        address[] storage sources = tokenConfigs[token].priceSources;
        
        if (sources.length == 0) {
            return;
        }

        uint256 totalWeight;
        uint256 weightedSum;
        uint256 highestConfidence;

        for (uint256 i = 0; i < sources.length; i++) {
            PriceFeed storage sourceFeed = sourcePrices[token][sources[i]];
            
            if (sourceFeed.active && !_isSourceStale(sourceFeed)) {
                uint256 weight = sourceFeed.confidence;
                weightedSum += sourceFeed.price * weight;
                totalWeight += weight;
                
                if (sourceFeed.confidence > highestConfidence) {
                    highestConfidence = sourceFeed.confidence;
                }
            }
        }

        if (totalWeight > 0) {
            uint256 aggregatedPrice = weightedSum / totalWeight;
            _updatePrice(
                token,
                aggregatedPrice,
                highestConfidence,
                address(this),
                PriceSourceType.INTERNAL
            );
        }
    }

    function _updateTWAP(address token, uint256 price) internal {
        TWAPObservation[] storage observations = twapObservations[token];

        uint256 cumulativePrice;
        if (observations.length > 0) {
            TWAPObservation storage last = observations[observations.length - 1];
            uint256 timeElapsed = block.timestamp - last.timestamp;
            cumulativePrice = last.cumulativePrice + (last.price * timeElapsed);
        }

        // Add new observation
        observations.push(TWAPObservation({
            timestamp: block.timestamp,
            price: price,
            cumulativePrice: cumulativePrice
        }));

        // Trim old observations
        while (observations.length > MAX_OBSERVATIONS) {
            for (uint256 i = 0; i < observations.length - 1; i++) {
                observations[i] = observations[i + 1];
            }
            observations.pop();
        }
    }

    function _isStale(address token) internal view returns (bool) {
        PriceFeed storage feed = latestPrices[token];
        TokenConfig storage config = tokenConfigs[token];
        
        return block.timestamp - feed.timestamp > config.heartbeat;
    }

    function _isSourceStale(PriceFeed storage feed) internal view returns (bool) {
        return block.timestamp - feed.timestamp > 1 hours;
    }

    function _calculateDeviation(
        uint256 oldPrice,
        uint256 newPrice
    ) internal pure returns (uint256) {
        if (oldPrice == 0) return 0;
        
        uint256 diff = oldPrice > newPrice ? 
            oldPrice - newPrice : 
            newPrice - oldPrice;
        
        return (diff * BPS_DENOMINATOR) / oldPrice;
    }
}
