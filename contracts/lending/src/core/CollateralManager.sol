// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PercentageMath} from "../libraries/MathLibraries.sol";

/**
 * @title CollateralManager
 * @notice Manages collateral configurations and health calculations
 * @dev Handles LTV, liquidation thresholds, and collateral validation
 *
 * Key parameters:
 * - LTV (Loan-to-Value): Max borrowing power as % of collateral
 * - Liquidation Threshold: Collateral value % at which position is liquidatable
 * - Liquidation Bonus: Discount given to liquidators (incentive)
 *
 * Security:
 * - Tiered risk parameters by asset class
 * - Reserve factor for protocol sustainability
 * - Isolation mode for risky assets
 */
contract CollateralManager is Ownable {
    using PercentageMath for uint256;

    // ============ Constants ============

    uint256 public constant PERCENTAGE_FACTOR = 10000;
    uint256 public constant MAX_LTV = 9000; // 90%
    uint256 public constant MAX_LIQUIDATION_THRESHOLD = 9800; // 98%
    uint256 public constant MAX_LIQUIDATION_BONUS = 11500; // 15% bonus
    uint256 public constant MIN_LIQUIDATION_BONUS = 10000; // No bonus

    // ============ Structs ============

    struct CollateralConfig {
        uint16 ltv; // Loan-to-value ratio (bps)
        uint16 liquidationThreshold; // Liquidation threshold (bps)
        uint16 liquidationBonus; // Liquidation bonus (bps, 10500 = 5%)
        uint8 decimals; // Asset decimals
        bool active; // Is collateral active
        bool frozen; // Is collateral frozen (no new deposits)
        bool borrowingEnabled; // Can this asset be borrowed
        bool stableRateEnabled; // Is stable rate borrowing enabled
        bool isolationMode; // Is this an isolation mode asset
        uint256 debtCeiling; // Max debt in isolation mode (USD)
        uint256 supplyCap; // Max supply (0 = unlimited)
        uint256 borrowCap; // Max borrows (0 = unlimited)
        uint256 reserveFactor; // % of interest to protocol (bps)
        address eMode; // Efficiency mode category
    }

    struct EModeCategory {
        uint16 ltv;
        uint16 liquidationThreshold;
        uint16 liquidationBonus;
        address priceSource;
        string label;
    }

    // ============ State ============

    /// @notice Asset => Collateral config
    mapping(address => CollateralConfig) public configs;

    /// @notice EMode ID => EMode category
    mapping(uint8 => EModeCategory) public eModeCategories;

    /// @notice User => EMode ID (0 = no eMode)
    mapping(address => uint8) public userEMode;

    /// @notice Price oracle
    address public priceOracle;

    /// @notice Pool address (for callbacks)
    address public pool;

    /// @notice List of all configured assets
    address[] public collateralList;

    // ============ Events ============

    event CollateralConfigured(
        address indexed asset,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    );

    event CollateralFrozen(address indexed asset, bool frozen);
    event CollateralActivated(address indexed asset, bool active);
    event BorrowingEnabled(address indexed asset, bool enabled);
    event IsolationModeSet(
        address indexed asset,
        bool isolated,
        uint256 debtCeiling
    );
    event EModeCategoryAdded(uint8 indexed id, string label);
    event UserEModeChanged(address indexed user, uint8 eMode);
    event CapsSet(address indexed asset, uint256 supplyCap, uint256 borrowCap);

    // ============ Modifiers ============

    modifier onlyPool() {
        require(msg.sender == pool, "CollateralManager: only pool");
        _;
    }

    // ============ Constructor ============

    constructor(address _priceOracle) Ownable(msg.sender) {
        priceOracle = _priceOracle;
    }

    // ============ Configuration ============

    /**
     * @notice Initialize the pool address
     * @param _pool Pool contract address
     */
    function setPool(address _pool) external onlyOwner {
        require(pool == address(0), "CollateralManager: already set");
        pool = _pool;
    }

    /**
     * @notice Configure a new collateral asset
     * @param asset The asset address
     * @param ltv Loan-to-value ratio in bps
     * @param liquidationThreshold Liquidation threshold in bps
     * @param liquidationBonus Liquidation bonus in bps
     * @param decimals Asset decimals
     */
    function configureCollateral(
        address asset,
        uint16 ltv,
        uint16 liquidationThreshold,
        uint16 liquidationBonus,
        uint8 decimals
    ) external onlyOwner {
        require(asset != address(0), "CollateralManager: zero asset");
        require(ltv <= MAX_LTV, "CollateralManager: ltv too high");
        require(
            liquidationThreshold <= MAX_LIQUIDATION_THRESHOLD,
            "CollateralManager: threshold too high"
        );
        require(
            liquidationThreshold >= ltv,
            "CollateralManager: threshold < ltv"
        );
        require(
            liquidationBonus >= MIN_LIQUIDATION_BONUS &&
                liquidationBonus <= MAX_LIQUIDATION_BONUS,
            "CollateralManager: invalid bonus"
        );

        bool isNew = configs[asset].decimals == 0;

        configs[asset] = CollateralConfig({
            ltv: ltv,
            liquidationThreshold: liquidationThreshold,
            liquidationBonus: liquidationBonus,
            decimals: decimals,
            active: true,
            frozen: false,
            borrowingEnabled: true,
            stableRateEnabled: false,
            isolationMode: false,
            debtCeiling: 0,
            supplyCap: 0,
            borrowCap: 0,
            reserveFactor: 1000, // 10% default
            eMode: address(0)
        });

        if (isNew) {
            collateralList.push(asset);
        }

        emit CollateralConfigured(
            asset,
            ltv,
            liquidationThreshold,
            liquidationBonus
        );
    }

    /**
     * @notice Update LTV parameters
     */
    function setLtvParameters(
        address asset,
        uint16 ltv,
        uint16 liquidationThreshold,
        uint16 liquidationBonus
    ) external onlyOwner {
        require(configs[asset].active, "CollateralManager: not active");
        require(ltv <= MAX_LTV, "CollateralManager: ltv too high");
        require(
            liquidationThreshold >= ltv,
            "CollateralManager: threshold < ltv"
        );

        configs[asset].ltv = ltv;
        configs[asset].liquidationThreshold = liquidationThreshold;
        configs[asset].liquidationBonus = liquidationBonus;

        emit CollateralConfigured(
            asset,
            ltv,
            liquidationThreshold,
            liquidationBonus
        );
    }

    /**
     * @notice Freeze/unfreeze an asset (no new deposits when frozen)
     */
    function setFrozen(address asset, bool frozen) external onlyOwner {
        configs[asset].frozen = frozen;
        emit CollateralFrozen(asset, frozen);
    }

    /**
     * @notice Activate/deactivate an asset
     */
    function setActive(address asset, bool active) external onlyOwner {
        configs[asset].active = active;
        emit CollateralActivated(asset, active);
    }

    /**
     * @notice Enable/disable borrowing for an asset
     */
    function setBorrowingEnabled(
        address asset,
        bool enabled
    ) external onlyOwner {
        configs[asset].borrowingEnabled = enabled;
        emit BorrowingEnabled(asset, enabled);
    }

    /**
     * @notice Enable/disable stable rate borrowing
     */
    function setStableRateEnabled(
        address asset,
        bool enabled
    ) external onlyOwner {
        configs[asset].stableRateEnabled = enabled;
    }

    /**
     * @notice Set supply and borrow caps
     */
    function setCaps(
        address asset,
        uint256 supplyCap,
        uint256 borrowCap
    ) external onlyOwner {
        configs[asset].supplyCap = supplyCap;
        configs[asset].borrowCap = borrowCap;
        emit CapsSet(asset, supplyCap, borrowCap);
    }

    /**
     * @notice Set reserve factor (% of interest to protocol)
     */
    function setReserveFactor(
        address asset,
        uint256 factor
    ) external onlyOwner {
        require(
            factor <= PERCENTAGE_FACTOR,
            "CollateralManager: factor too high"
        );
        configs[asset].reserveFactor = factor;
    }

    /**
     * @notice Configure isolation mode for risky assets
     */
    function setIsolationMode(
        address asset,
        bool isolated,
        uint256 debtCeiling
    ) external onlyOwner {
        configs[asset].isolationMode = isolated;
        configs[asset].debtCeiling = debtCeiling;
        emit IsolationModeSet(asset, isolated, debtCeiling);
    }

    // ============ E-Mode ============

    /**
     * @notice Add efficiency mode category
     * @dev EMode allows higher LTV for correlated assets
     */
    function addEModeCategory(
        uint8 categoryId,
        uint16 ltv,
        uint16 liquidationThreshold,
        uint16 liquidationBonus,
        address priceSource,
        string calldata label
    ) external onlyOwner {
        require(categoryId > 0, "CollateralManager: invalid category");

        eModeCategories[categoryId] = EModeCategory({
            ltv: ltv,
            liquidationThreshold: liquidationThreshold,
            liquidationBonus: liquidationBonus,
            priceSource: priceSource,
            label: label
        });

        emit EModeCategoryAdded(categoryId, label);
    }

    /**
     * @notice Set user's eMode (pool calls this)
     */
    function setUserEMode(address user, uint8 categoryId) external onlyPool {
        userEMode[user] = categoryId;
        emit UserEModeChanged(user, categoryId);
    }

    // ============ View Functions ============

    /**
     * @notice Get full collateral config for an asset
     */
    function getCollateralConfig(
        address asset
    ) external view returns (CollateralConfig memory) {
        return configs[asset];
    }

    /**
     * @notice Get LTV for an asset (considering user's eMode)
     */
    function getLtv(address asset, address user) public view returns (uint256) {
        uint8 eMode = userEMode[user];
        if (eMode > 0) {
            EModeCategory memory category = eModeCategories[eMode];
            if (category.ltv > 0) {
                return category.ltv;
            }
        }
        return configs[asset].ltv;
    }

    /**
     * @notice Get liquidation threshold (considering eMode)
     */
    function getLiquidationThreshold(
        address asset,
        address user
    ) public view returns (uint256) {
        uint8 eMode = userEMode[user];
        if (eMode > 0) {
            EModeCategory memory category = eModeCategories[eMode];
            if (category.liquidationThreshold > 0) {
                return category.liquidationThreshold;
            }
        }
        return configs[asset].liquidationThreshold;
    }

    /**
     * @notice Get liquidation bonus
     */
    function getLiquidationBonus(
        address asset,
        address user
    ) public view returns (uint256) {
        uint8 eMode = userEMode[user];
        if (eMode > 0) {
            EModeCategory memory category = eModeCategories[eMode];
            if (category.liquidationBonus > 0) {
                return category.liquidationBonus;
            }
        }
        return configs[asset].liquidationBonus;
    }

    /**
     * @notice Check if asset can be used as collateral
     */
    function isCollateralEnabled(address asset) external view returns (bool) {
        return configs[asset].active && configs[asset].ltv > 0;
    }

    /**
     * @notice Check if borrowing is enabled
     */
    function isBorrowingEnabled(address asset) external view returns (bool) {
        return configs[asset].active && configs[asset].borrowingEnabled;
    }

    /**
     * @notice Check if stable rate borrowing is enabled
     */
    function isStableRateEnabled(address asset) external view returns (bool) {
        return configs[asset].stableRateEnabled;
    }

    /**
     * @notice Get supply cap
     */
    function getSupplyCap(address asset) external view returns (uint256) {
        return configs[asset].supplyCap;
    }

    /**
     * @notice Get borrow cap
     */
    function getBorrowCap(address asset) external view returns (uint256) {
        return configs[asset].borrowCap;
    }

    /**
     * @notice Get all configured collateral assets
     */
    function getAllCollaterals() external view returns (address[] memory) {
        return collateralList;
    }

    /**
     * @notice Get number of collaterals
     */
    function collateralCount() external view returns (uint256) {
        return collateralList.length;
    }

    /**
     * @notice Calculate maximum borrowable amount in USD
     */
    function getMaxBorrowable(
        address asset,
        address user,
        uint256 collateralValueUSD
    ) external view returns (uint256) {
        uint256 ltv = getLtv(asset, user);
        return collateralValueUSD.percentMul(ltv);
    }

    /**
     * @notice Check if position can be liquidated
     */
    function canLiquidate(
        address user,
        uint256 collateralValueUSD,
        uint256 debtValueUSD
    ) external view returns (bool) {
        if (debtValueUSD == 0) return false;

        // Simplified: use first collateral's threshold
        // In production, use weighted average
        if (collateralList.length == 0) return false;

        uint256 threshold = getLiquidationThreshold(collateralList[0], user);
        uint256 healthFactor = (collateralValueUSD * threshold) /
            (debtValueUSD * PERCENTAGE_FACTOR);

        return healthFactor < 1e18;
    }

    /**
     * @notice Get eMode category details
     */
    function getEModeCategory(
        uint8 categoryId
    ) external view returns (EModeCategory memory) {
        return eModeCategories[categoryId];
    }
}
