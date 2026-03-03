// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title IFlashLoanReceiver
 * @notice Interface for flash loan receivers
 */
interface IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/**
 * @title ICrossVMFlashLoanReceiver
 * @notice Interface for cross-VM flash loan receivers
 */
interface ICrossVMFlashLoanReceiver {
    function executeOperationCrossVM(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params,
        uint8 targetVM  // 0=EVM, 1=SVM, 2=X3VM
    ) external returns (bool);
}

/**
 * @title FlashLoanProvider
 * @author X3 Chain Team
 * @notice Cross-VM flash loan provider for arbitrage, liquidations, and atomic operations
 * @dev Supports single-VM and cross-VM flash loans with atomicity guarantees
 *
 * Features:
 * - Single-asset and multi-asset flash loans
 * - Cross-VM flash loans (EVM ↔ SVM ↔ X3VM)
 * - Configurable fees per asset
 * - Liquidity provider rewards
 * - Emergency pause functionality
 *
 * Use Cases:
 * - Cross-VM arbitrage (e.g., Uniswap ↔ Raydium)
 * - Liquidation bots
 * - Collateral swaps
 * - Debt refinancing
 * - Self-liquidation
 */
contract FlashLoanProvider is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS & ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant LIQUIDITY_ADMIN_ROLE = keccak256("LIQUIDITY_ADMIN_ROLE");
    bytes32 public constant FEE_ADMIN_ROLE = keccak256("FEE_ADMIN_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    /// @notice Default flash loan fee (0.09%)
    uint256 public constant DEFAULT_FEE_BPS = 9;

    /// @notice Maximum fee (1%)
    uint256 public constant MAX_FEE_BPS = 100;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice SVM precompile for cross-VM calls
    address public constant SVM_PRECOMPILE = 0x0000000000000000000000000000000000000801;

    /// @notice X3VM precompile for cross-VM calls
    address public constant X3VM_PRECOMPILE = 0x0000000000000000000000000000000000000802;

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice VM types for cross-VM operations
    enum VMType {
        EVM,
        SVM,
        X3VM
    }

    /// @notice Flash loan mode
    enum FlashLoanMode {
        Standard,    // 0 - Normal EVM flash loan
        CrossVM,     // 1 - Cross-VM flash loan
        Atomic       // 2 - Atomic multi-leg flash loan
    }

    /// @notice Asset configuration
    struct AssetConfig {
        bool enabled;
        uint256 feeBps;              // Fee in basis points
        uint256 maxLoanAmount;       // Maximum single loan
        uint256 totalLiquidity;      // Total deposited liquidity
        uint256 availableLiquidity;  // Currently available
        uint256 totalBorrowed;       // Total borrowed (for stats)
        uint256 totalFeesCollected;  // Total fees collected
    }

    /// @notice Liquidity provider position
    struct LPPosition {
        uint256 depositedAmount;
        uint256 shares;
        uint256 lastDepositTime;
        uint256 earnedFees;
    }

    /// @notice Flash loan request
    struct FlashLoanRequest {
        address[] assets;
        uint256[] amounts;
        FlashLoanMode mode;
        VMType targetVM;
        address receiver;
        bytes params;
    }

    /// @notice Cross-VM flash loan leg
    struct CrossVMLeg {
        VMType vm;
        address target;
        bytes callData;
        uint256 value;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Asset configurations
    mapping(address => AssetConfig) public assetConfigs;

    /// @notice LP positions by asset and provider
    mapping(address => mapping(address => LPPosition)) public lpPositions;

    /// @notice Total shares per asset
    mapping(address => uint256) public totalShares;

    /// @notice Supported assets list
    address[] public supportedAssets;

    /// @notice Flash loan in progress flag
    bool private _flashLoanActive;

    /// @notice Current flash loan initiator
    address private _currentInitiator;

    /// @notice Protocol fee recipient
    address public protocolFeeRecipient;

    /// @notice Protocol fee share (bps of collected fees)
    uint256 public protocolFeeBps = 1000; // 10%

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event FlashLoan(
        address indexed initiator,
        address indexed receiver,
        address[] assets,
        uint256[] amounts,
        uint256[] premiums,
        FlashLoanMode mode
    );

    event CrossVMFlashLoan(
        address indexed initiator,
        address indexed receiver,
        address[] assets,
        uint256[] amounts,
        VMType targetVM
    );

    event LiquidityDeposited(
        address indexed asset,
        address indexed provider,
        uint256 amount,
        uint256 shares
    );

    event LiquidityWithdrawn(
        address indexed asset,
        address indexed provider,
        uint256 amount,
        uint256 shares
    );

    event AssetConfigured(
        address indexed asset,
        bool enabled,
        uint256 feeBps,
        uint256 maxLoanAmount
    );

    event FeesDistributed(
        address indexed asset,
        uint256 totalFees,
        uint256 protocolFees
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error AssetNotSupported();
    error InsufficientLiquidity();
    error FlashLoanActive();
    error RepaymentFailed();
    error InvalidAmount();
    error MaxLoanExceeded();
    error ArrayLengthMismatch();
    error ReceiverNotContract();
    error CrossVMCallFailed();
    error InsufficientShares();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(address _protocolFeeRecipient) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LIQUIDITY_ADMIN_ROLE, msg.sender);
        _grantRole(FEE_ADMIN_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);

        protocolFeeRecipient = _protocolFeeRecipient;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FLASH LOAN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Execute a flash loan
     * @param assets Array of asset addresses to borrow
     * @param amounts Array of amounts to borrow
     * @param receiver Contract to receive and use the flash loan
     * @param params Arbitrary data to pass to receiver
     */
    function flashLoan(
        address[] calldata assets,
        uint256[] calldata amounts,
        address receiver,
        bytes calldata params
    ) external nonReentrant whenNotPaused {
        if (assets.length != amounts.length) revert ArrayLengthMismatch();
        if (_flashLoanActive) revert FlashLoanActive();
        if (receiver == address(0) || receiver.code.length == 0) revert ReceiverNotContract();

        _flashLoanActive = true;
        _currentInitiator = msg.sender;

        uint256[] memory premiums = new uint256[](assets.length);

        // Transfer assets to receiver
        for (uint256 i = 0; i < assets.length; i++) {
            AssetConfig storage config = assetConfigs[assets[i]];
            
            if (!config.enabled) revert AssetNotSupported();
            if (amounts[i] > config.availableLiquidity) revert InsufficientLiquidity();
            if (amounts[i] > config.maxLoanAmount) revert MaxLoanExceeded();
            if (amounts[i] == 0) revert InvalidAmount();

            // Calculate premium
            premiums[i] = (amounts[i] * config.feeBps) / BPS_DENOMINATOR;

            // Update available liquidity
            config.availableLiquidity -= amounts[i];
            config.totalBorrowed += amounts[i];

            // Transfer to receiver
            IERC20(assets[i]).safeTransfer(receiver, amounts[i]);
        }

        // Execute receiver's operation
        bool success = IFlashLoanReceiver(receiver).executeOperation(
            assets,
            amounts,
            premiums,
            msg.sender,
            params
        );

        if (!success) revert RepaymentFailed();

        // Verify repayment
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountOwed = amounts[i] + premiums[i];
            
            // Pull repayment from receiver
            IERC20(assets[i]).safeTransferFrom(receiver, address(this), amountOwed);

            // Update state
            AssetConfig storage config = assetConfigs[assets[i]];
            config.availableLiquidity += amounts[i] + premiums[i];
            config.totalFeesCollected += premiums[i];
        }

        emit FlashLoan(msg.sender, receiver, assets, amounts, premiums, FlashLoanMode.Standard);

        _flashLoanActive = false;
        _currentInitiator = address(0);
    }

    /**
     * @notice Execute a cross-VM flash loan
     * @param assets Array of asset addresses to borrow
     * @param amounts Array of amounts to borrow
     * @param targetVM Target VM for execution
     * @param receiver Contract to receive and use the flash loan
     * @param params Arbitrary data including cross-VM call info
     */
    function crossVMFlashLoan(
        address[] calldata assets,
        uint256[] calldata amounts,
        VMType targetVM,
        address receiver,
        bytes calldata params
    ) external nonReentrant whenNotPaused {
        if (assets.length != amounts.length) revert ArrayLengthMismatch();
        if (_flashLoanActive) revert FlashLoanActive();

        _flashLoanActive = true;
        _currentInitiator = msg.sender;

        uint256[] memory premiums = new uint256[](assets.length);

        // Transfer assets to receiver
        for (uint256 i = 0; i < assets.length; i++) {
            AssetConfig storage config = assetConfigs[assets[i]];
            
            if (!config.enabled) revert AssetNotSupported();
            if (amounts[i] > config.availableLiquidity) revert InsufficientLiquidity();
            if (amounts[i] > config.maxLoanAmount) revert MaxLoanExceeded();

            // Cross-VM loans have higher fee
            premiums[i] = (amounts[i] * config.feeBps * 2) / BPS_DENOMINATOR;

            config.availableLiquidity -= amounts[i];
            config.totalBorrowed += amounts[i];

            IERC20(assets[i]).safeTransfer(receiver, amounts[i]);
        }

        // Execute cross-VM operation
        bool success;
        if (targetVM == VMType.SVM) {
            (success, ) = SVM_PRECOMPILE.call(abi.encode(receiver, params));
        } else if (targetVM == VMType.X3VM) {
            (success, ) = X3VM_PRECOMPILE.call(abi.encode(receiver, params));
        } else {
            success = ICrossVMFlashLoanReceiver(receiver).executeOperationCrossVM(
                assets,
                amounts,
                premiums,
                msg.sender,
                params,
                uint8(targetVM)
            );
        }

        if (!success) revert CrossVMCallFailed();

        // Verify repayment
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountOwed = amounts[i] + premiums[i];
            IERC20(assets[i]).safeTransferFrom(receiver, address(this), amountOwed);

            AssetConfig storage config = assetConfigs[assets[i]];
            config.availableLiquidity += amounts[i] + premiums[i];
            config.totalFeesCollected += premiums[i];
        }

        emit CrossVMFlashLoan(msg.sender, receiver, assets, amounts, targetVM);

        _flashLoanActive = false;
        _currentInitiator = address(0);
    }

    /**
     * @notice Execute atomic multi-leg flash loan
     * @param assets Assets to borrow
     * @param amounts Amounts to borrow
     * @param legs Array of cross-VM legs to execute atomically
     */
    function atomicFlashLoan(
        address[] calldata assets,
        uint256[] calldata amounts,
        CrossVMLeg[] calldata legs,
        bytes calldata params
    ) external nonReentrant whenNotPaused {
        if (assets.length != amounts.length) revert ArrayLengthMismatch();
        if (_flashLoanActive) revert FlashLoanActive();

        _flashLoanActive = true;
        _currentInitiator = msg.sender;

        uint256[] memory premiums = new uint256[](assets.length);

        // Borrow assets
        for (uint256 i = 0; i < assets.length; i++) {
            AssetConfig storage config = assetConfigs[assets[i]];
            
            if (!config.enabled) revert AssetNotSupported();
            if (amounts[i] > config.availableLiquidity) revert InsufficientLiquidity();

            // Atomic loans have highest fee
            premiums[i] = (amounts[i] * config.feeBps * 3) / BPS_DENOMINATOR;

            config.availableLiquidity -= amounts[i];
            IERC20(assets[i]).safeTransfer(msg.sender, amounts[i]);
        }

        // Execute all legs atomically
        for (uint256 i = 0; i < legs.length; i++) {
            CrossVMLeg calldata leg = legs[i];
            bool success;

            if (leg.vm == VMType.EVM) {
                (success, ) = leg.target.call{value: leg.value}(leg.callData);
            } else if (leg.vm == VMType.SVM) {
                (success, ) = SVM_PRECOMPILE.call(abi.encode(leg.target, leg.callData));
            } else {
                (success, ) = X3VM_PRECOMPILE.call(abi.encode(leg.target, leg.callData));
            }

            if (!success) {
                // Rollback - in atomic mode, any failure reverts all
                revert CrossVMCallFailed();
            }
        }

        // Verify repayment
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountOwed = amounts[i] + premiums[i];
            IERC20(assets[i]).safeTransferFrom(msg.sender, address(this), amountOwed);

            AssetConfig storage config = assetConfigs[assets[i]];
            config.availableLiquidity += amounts[i] + premiums[i];
            config.totalFeesCollected += premiums[i];
        }

        emit FlashLoan(msg.sender, msg.sender, assets, amounts, premiums, FlashLoanMode.Atomic);

        _flashLoanActive = false;
        _currentInitiator = address(0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LIQUIDITY PROVIDER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Deposit liquidity for flash loans
     * @param asset Asset to deposit
     * @param amount Amount to deposit
     */
    function depositLiquidity(
        address asset,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        AssetConfig storage config = assetConfigs[asset];
        if (!config.enabled) revert AssetNotSupported();
        if (amount == 0) revert InvalidAmount();

        // Calculate shares
        uint256 shares;
        if (totalShares[asset] == 0) {
            shares = amount;
        } else {
            shares = (amount * totalShares[asset]) / config.totalLiquidity;
        }

        // Transfer tokens
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        // Update state
        config.totalLiquidity += amount;
        config.availableLiquidity += amount;
        totalShares[asset] += shares;

        LPPosition storage position = lpPositions[asset][msg.sender];
        position.depositedAmount += amount;
        position.shares += shares;
        position.lastDepositTime = block.timestamp;

        emit LiquidityDeposited(asset, msg.sender, amount, shares);
    }

    /**
     * @notice Withdraw liquidity
     * @param asset Asset to withdraw
     * @param shares Shares to redeem
     */
    function withdrawLiquidity(
        address asset,
        uint256 shares
    ) external nonReentrant {
        LPPosition storage position = lpPositions[asset][msg.sender];
        if (shares > position.shares) revert InsufficientShares();

        AssetConfig storage config = assetConfigs[asset];

        // Calculate amount
        uint256 amount = (shares * config.totalLiquidity) / totalShares[asset];
        if (amount > config.availableLiquidity) revert InsufficientLiquidity();

        // Update state
        config.totalLiquidity -= amount;
        config.availableLiquidity -= amount;
        totalShares[asset] -= shares;
        position.shares -= shares;
        position.depositedAmount = (position.depositedAmount * (position.shares)) / (position.shares + shares);

        // Transfer tokens
        IERC20(asset).safeTransfer(msg.sender, amount);

        emit LiquidityWithdrawn(asset, msg.sender, amount, shares);
    }

    /**
     * @notice Distribute collected fees to LPs and protocol
     * @param asset Asset to distribute fees for
     */
    function distributeFees(address asset) external {
        AssetConfig storage config = assetConfigs[asset];
        uint256 totalFees = config.totalFeesCollected;
        
        if (totalFees == 0) return;

        // Protocol fee
        uint256 protocolFees = (totalFees * protocolFeeBps) / BPS_DENOMINATOR;
        uint256 lpFees = totalFees - protocolFees;

        // Transfer protocol fee
        if (protocolFees > 0) {
            IERC20(asset).safeTransfer(protocolFeeRecipient, protocolFees);
        }

        // LP fees stay in pool (compound)
        config.totalLiquidity += lpFees;
        config.totalFeesCollected = 0;

        emit FeesDistributed(asset, totalFees, protocolFees);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Configure an asset for flash loans
     */
    function configureAsset(
        address asset,
        bool enabled,
        uint256 feeBps,
        uint256 maxLoanAmount
    ) external onlyRole(LIQUIDITY_ADMIN_ROLE) {
        require(feeBps <= MAX_FEE_BPS, "Fee too high");

        AssetConfig storage config = assetConfigs[asset];
        
        bool isNew = config.feeBps == 0 && !config.enabled;
        
        config.enabled = enabled;
        config.feeBps = feeBps;
        config.maxLoanAmount = maxLoanAmount;

        if (isNew) {
            supportedAssets.push(asset);
        }

        emit AssetConfigured(asset, enabled, feeBps, maxLoanAmount);
    }

    function setProtocolFee(uint256 _protocolFeeBps) external onlyRole(FEE_ADMIN_ROLE) {
        require(_protocolFeeBps <= 5000, "Max 50%");
        protocolFeeBps = _protocolFeeBps;
    }

    function setProtocolFeeRecipient(address _recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        protocolFeeRecipient = _recipient;
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getAssetConfig(address asset) external view returns (AssetConfig memory) {
        return assetConfigs[asset];
    }

    function getLPPosition(address asset, address provider) external view returns (LPPosition memory) {
        return lpPositions[asset][provider];
    }

    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }

    function calculatePremium(
        address asset,
        uint256 amount,
        FlashLoanMode mode
    ) external view returns (uint256) {
        AssetConfig storage config = assetConfigs[asset];
        uint256 multiplier = mode == FlashLoanMode.Standard ? 1 : 
                            mode == FlashLoanMode.CrossVM ? 2 : 3;
        return (amount * config.feeBps * multiplier) / BPS_DENOMINATOR;
    }

    function getAvailableLiquidity(address asset) external view returns (uint256) {
        return assetConfigs[asset].availableLiquidity;
    }

    function isFlashLoanActive() external view returns (bool) {
        return _flashLoanActive;
    }

    function getCurrentInitiator() external view returns (address) {
        return _currentInitiator;
    }
}
