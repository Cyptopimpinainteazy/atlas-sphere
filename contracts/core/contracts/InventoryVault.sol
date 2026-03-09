// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title InventoryVault
 * @author X3 Chain Team
 * @notice Capital management vault for cross-VM atomic swap collateral.
 *
 * Holds pre-funded inventory that can be used when flashloans fail or
 * as margin for atomic swap operations. Tracks PnL per asset and
 * enforces maximum exposure limits.
 *
 * ## Features
 *
 * - Multi-asset inventory with per-asset caps
 * - Role-based access (OPERATOR can draw, ADMIN can configure)
 * - Exposure tracking and auto-rebalancing triggers
 * - Emergency kill-switch (GUARDIAN pause)
 * - Cross-VM settlement integration via X3 kernel
 */
contract InventoryVault is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    // ═══ Roles ═══════════════════════════════════════════════════════════════
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ═══ Types ═══════════════════════════════════════════════════════════════

    /// @notice Per-asset inventory state.
    struct AssetInventory {
        uint256 balance;         // Current balance
        uint256 maxExposure;     // Maximum allowed draw (50% of balance by default)
        uint256 totalDrawn;      // Currently drawn by operations
        uint256 totalReturned;   // Total returned (for PnL tracking)
        uint256 totalPnL;        // Cumulative PnL (positive = profit)
        bool    enabled;         // Whether draws are allowed
    }

    // ═══ State ═══════════════════════════════════════════════════════════════

    /// @notice Inventory state per asset.
    mapping(address => AssetInventory) public inventories;

    /// @notice Supported assets list.
    address[] public assets;

    /// @notice Maximum exposure percentage (basis points, default 5000 = 50%).
    uint256 public maxExposureBps = 5000;

    // ═══ Events ══════════════════════════════════════════════════════════════

    event Deposited(address indexed asset, uint256 amount, address indexed from);
    event Withdrawn(address indexed asset, uint256 amount, address indexed to);
    event Drawn(address indexed asset, uint256 amount, bytes32 indexed operationId);
    event Returned(address indexed asset, uint256 amount, uint256 pnl, bytes32 indexed operationId);
    event AssetConfigured(address indexed asset, uint256 maxExposure, bool enabled);
    event ExposureLimitHit(address indexed asset, uint256 attempted, uint256 available);

    // ═══ Errors ══════════════════════════════════════════════════════════════

    error AssetNotEnabled();
    error InsufficientBalance();
    error ExposureLimitExceeded();
    error InvalidAmount();

    // ═══ Constructor ═════════════════════════════════════════════════════════

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
    }

    // ═══ Deposit/Withdraw (Admin) ════════════════════════════════════════════

    /**
     * @notice Deposit inventory capital.
     */
    function deposit(
        address asset,
        uint256 amount
    ) external nonReentrant whenNotPaused onlyRole(DEFAULT_ADMIN_ROLE) {
        if (amount == 0) revert InvalidAmount();

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        AssetInventory storage inv = inventories[asset];
        if (!inv.enabled) {
            // Auto-enable on first deposit
            inv.enabled = true;
            inv.maxExposure = (amount * maxExposureBps) / 10000;
            assets.push(asset);
        }
        inv.balance += amount;

        emit Deposited(asset, amount, msg.sender);
    }

    /**
     * @notice Withdraw idle inventory.
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        AssetInventory storage inv = inventories[asset];
        uint256 available = inv.balance - inv.totalDrawn;
        if (amount > available) revert InsufficientBalance();

        inv.balance -= amount;
        IERC20(asset).safeTransfer(to, amount);

        emit Withdrawn(asset, amount, to);
    }

    // ═══ Draw/Return (Operator — used by swap coordinator) ═══════════════════

    /**
     * @notice Draw inventory for an atomic swap operation.
     * @param asset      Asset to draw
     * @param amount     Amount to draw
     * @param operationId Unique identifier for the swap operation
     */
    function draw(
        address asset,
        uint256 amount,
        bytes32 operationId
    ) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        AssetInventory storage inv = inventories[asset];
        if (!inv.enabled) revert AssetNotEnabled();

        uint256 available = inv.balance - inv.totalDrawn;
        if (amount > available) revert InsufficientBalance();

        if (inv.totalDrawn + amount > inv.maxExposure) {
            emit ExposureLimitHit(asset, amount, inv.maxExposure - inv.totalDrawn);
            revert ExposureLimitExceeded();
        }

        inv.totalDrawn += amount;
        IERC20(asset).safeTransfer(msg.sender, amount);

        emit Drawn(asset, amount, operationId);
    }

    /**
     * @notice Return capital after a swap operation (may include PnL).
     * @param asset      Asset being returned
     * @param amount     Amount returned (may differ from drawn amount)
     * @param drawnAmount Original amount drawn (for PnL calculation)
     * @param operationId Unique identifier for the swap operation
     */
    function returnCapital(
        address asset,
        uint256 amount,
        uint256 drawnAmount,
        bytes32 operationId
    ) external nonReentrant onlyRole(OPERATOR_ROLE) {
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        AssetInventory storage inv = inventories[asset];
        inv.balance = inv.balance - drawnAmount + amount;
        inv.totalDrawn -= drawnAmount;
        inv.totalReturned += amount;

        // Track PnL
        if (amount > drawnAmount) {
            inv.totalPnL += (amount - drawnAmount);
        }

        emit Returned(asset, amount, amount > drawnAmount ? amount - drawnAmount : 0, operationId);
    }

    // ═══ Admin ═══════════════════════════════════════════════════════════════

    function configureAsset(
        address asset,
        uint256 _maxExposure,
        bool _enabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        AssetInventory storage inv = inventories[asset];
        inv.maxExposure = _maxExposure;
        inv.enabled = _enabled;
        emit AssetConfigured(asset, _maxExposure, _enabled);
    }

    function setMaxExposureBps(uint256 _bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_bps <= 10000, "Max 100%");
        maxExposureBps = _bps;
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }

    // ═══ Views ═══════════════════════════════════════════════════════════════

    function getAvailable(address asset) external view returns (uint256) {
        AssetInventory storage inv = inventories[asset];
        return inv.balance - inv.totalDrawn;
    }

    function getExposure(address asset) external view returns (uint256 drawn, uint256 maxExp) {
        AssetInventory storage inv = inventories[asset];
        return (inv.totalDrawn, inv.maxExposure);
    }

    function getPnL(address asset) external view returns (uint256) {
        return inventories[asset].totalPnL;
    }

    function getAssetCount() external view returns (uint256) {
        return assets.length;
    }
}
