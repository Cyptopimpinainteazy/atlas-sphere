// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AtlasTreasury
 * @notice Unified treasury and fee management for X3 Chain ecosystem
 * @dev Captures, splits, and distributes fees from all protocol modules
 *
 * Fee Sources:
 * - Lending: Interest spread, liquidation penalties, flash loan fees
 * - Swaps: Router fees, slippage capture
 * - Launchpads: Presale fees, auction premiums
 * - CCPM: Position management fees, migration fees
 * - Staking: Unstaking penalties
 *
 * Distribution Targets:
 * - DAO Treasury: Governance-controlled funds
 * - Dev Fund: Protocol development
 * - Marketing: Growth and partnerships
 * - LP Incentives: Liquidity mining rewards
 * - Buyback/Burn: Token value accrual
 * - Insurance Fund: Bad debt coverage
 */
contract AtlasTreasury is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 public constant COLLECTOR_ROLE = keccak256("COLLECTOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant BPS_PRECISION = 10000;
    uint256 public constant MAX_FEE_BPS = 1000; // 10% max
    uint256 public constant MIN_DISTRIBUTION_INTERVAL = 1 hours;
    uint256 public constant MAX_RECIPIENTS = 10;

    // ============ Enums ============

    enum FeeSource {
        LENDING_INTEREST,
        LENDING_LIQUIDATION,
        FLASH_LOAN,
        SWAP_FEE,
        SWAP_SLIPPAGE,
        LAUNCHPAD_PRESALE,
        LAUNCHPAD_AUCTION,
        CCPM_MANAGEMENT,
        CCPM_MIGRATION,
        STAKING_PENALTY,
        NFT_ROYALTY,
        OTHER
    }

    enum RecipientType {
        DAO_TREASURY,
        DEV_FUND,
        MARKETING,
        LP_INCENTIVES,
        BUYBACK_BURN,
        INSURANCE_FUND,
        STAKING_REWARDS,
        CUSTOM
    }

    // ============ Structs ============

    struct FeeSchedule {
        FeeSource source;
        uint256 feeBps;
        bool active;
        uint256 totalCollected;
        uint256 lastCollected;
    }

    struct Recipient {
        RecipientType recipientType;
        address wallet;
        uint256 shareBps;
        bool active;
        uint256 totalReceived;
    }

    struct FeeRecord {
        FeeSource source;
        address token;
        uint256 amount;
        uint256 valueUSD;
        address collector;
        uint256 timestamp;
        bytes32 txHash;
    }

    struct DistributionRecord {
        address token;
        uint256 totalAmount;
        uint256[] recipientAmounts;
        uint256 timestamp;
    }

    struct TokenBalance {
        address token;
        uint256 balance;
        uint256 pendingDistribution;
        uint256 lastDistributed;
    }

    // ============ State Variables ============

    // Fee schedules per source
    mapping(FeeSource => FeeSchedule) public feeSchedules;

    // Distribution recipients
    Recipient[] public recipients;
    mapping(address => uint256) public recipientIndex;

    // Token balances
    mapping(address => TokenBalance) public tokenBalances;
    address[] public supportedTokens;

    // Fee records (limited history)
    FeeRecord[] public feeRecords;
    uint256 public maxFeeRecords;

    // Distribution history
    DistributionRecord[] public distributionHistory;

    // Statistics
    uint256 public totalFeesCollectedUSD;
    uint256 public totalDistributedUSD;
    uint256 public lastDistributionTime;

    // Price oracle
    address public priceOracle;

    // Native token (X3)
    address public atlasToken;

    // Buyback contract
    address public buybackContract;

    // Insurance fund address
    address public insuranceFund;

    // ============ Events ============

    event FeeCollected(
        FeeSource indexed source,
        address indexed token,
        uint256 amount,
        uint256 valueUSD,
        address collector
    );

    event FeeDistributed(
        address indexed token,
        uint256 totalAmount,
        uint256 timestamp
    );

    event RecipientAdded(
        RecipientType indexed recipientType,
        address indexed wallet,
        uint256 shareBps
    );

    event RecipientUpdated(
        address indexed wallet,
        uint256 newShareBps,
        bool active
    );

    event FeeScheduleUpdated(
        FeeSource indexed source,
        uint256 feeBps,
        bool active
    );

    event EmergencyWithdrawal(
        address indexed token,
        uint256 amount,
        address indexed recipient
    );

    event BuybackExecuted(
        address indexed token,
        uint256 amountIn,
        uint256 atlasReceived
    );

    // ============ Errors ============

    error InvalidFeeSource();
    error InvalidRecipient();
    error InvalidShareTotal();
    error DistributionTooSoon();
    error InsufficientBalance();
    error TokenNotSupported();
    error MaxRecipientsReached();
    error ZeroAmount();
    error ZeroAddress();

    // ============ Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _priceOracle,
        address _atlasToken
    ) external initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(GOVERNOR_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        priceOracle = _priceOracle;
        atlasToken = _atlasToken;
        maxFeeRecords = 10000;

        _initializeDefaultSchedules();
        _initializeDefaultRecipients(_admin);
    }

    // ============ Fee Collection ============

    /**
     * @notice Collect fees from a protocol module
     * @param source The fee source type
     * @param token Token address (address(0) for native)
     * @param amount Fee amount
     */
    function collectFee(
        FeeSource source,
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused onlyRole(COLLECTOR_ROLE) {
        if (amount == 0) revert ZeroAmount();

        FeeSchedule storage schedule = feeSchedules[source];
        if (!schedule.active) revert InvalidFeeSource();

        // Transfer tokens
        if (token == address(0)) {
            // Native token - should be sent with the call
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        // Update balances
        TokenBalance storage balance = tokenBalances[token];
        balance.balance += amount;
        balance.pendingDistribution += amount;

        if (balance.token == address(0)) {
            balance.token = token;
            supportedTokens.push(token);
        }

        // Get USD value
        uint256 valueUSD = _getValueUSD(token, amount);

        // Update statistics
        schedule.totalCollected += amount;
        schedule.lastCollected = block.timestamp;
        totalFeesCollectedUSD += valueUSD;

        // Record fee (with rotation)
        _recordFee(source, token, amount, valueUSD);

        emit FeeCollected(source, token, amount, valueUSD, msg.sender);
    }

    /**
     * @notice Batch collect fees from multiple sources
     */
    function batchCollectFees(
        FeeSource[] calldata sources,
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external nonReentrant whenNotPaused onlyRole(COLLECTOR_ROLE) {
        require(
            sources.length == tokens.length && tokens.length == amounts.length,
            "Length mismatch"
        );

        for (uint256 i = 0; i < sources.length; i++) {
            _collectFeeInternal(sources[i], tokens[i], amounts[i]);
        }
    }

    // ============ Distribution ============

    /**
     * @notice Distribute collected fees to recipients
     * @param token Token to distribute
     */
    function distribute(
        address token
    ) external nonReentrant whenNotPaused onlyRole(DISTRIBUTOR_ROLE) {
        TokenBalance storage balance = tokenBalances[token];
        if (balance.pendingDistribution == 0) revert InsufficientBalance();

        if (block.timestamp - lastDistributionTime < MIN_DISTRIBUTION_INTERVAL) {
            revert DistributionTooSoon();
        }

        uint256 totalToDistribute = balance.pendingDistribution;
        uint256[] memory recipientAmounts = new uint256[](recipients.length);

        // Calculate and transfer to each recipient
        for (uint256 i = 0; i < recipients.length; i++) {
            Recipient storage recipient = recipients[i];
            if (!recipient.active) continue;

            uint256 amount = (totalToDistribute * recipient.shareBps) / BPS_PRECISION;
            if (amount == 0) continue;

            recipientAmounts[i] = amount;

            // Handle special recipient types
            if (recipient.recipientType == RecipientType.BUYBACK_BURN) {
                _executeBuyback(token, amount);
            } else {
                _transferToken(token, recipient.wallet, amount);
            }

            recipient.totalReceived += amount;
        }

        // Update state
        balance.pendingDistribution = 0;
        balance.lastDistributed = block.timestamp;
        lastDistributionTime = block.timestamp;

        // Get USD value
        uint256 valueUSD = _getValueUSD(token, totalToDistribute);
        totalDistributedUSD += valueUSD;

        // Record distribution
        distributionHistory.push(DistributionRecord({
            token: token,
            totalAmount: totalToDistribute,
            recipientAmounts: recipientAmounts,
            timestamp: block.timestamp
        }));

        emit FeeDistributed(token, totalToDistribute, block.timestamp);
    }

    /**
     * @notice Distribute all supported tokens
     */
    function distributeAll() external nonReentrant whenNotPaused onlyRole(DISTRIBUTOR_ROLE) {
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            if (tokenBalances[token].pendingDistribution > 0) {
                _distributeInternal(token);
            }
        }
    }

    // ============ Recipient Management ============

    /**
     * @notice Add a new fee recipient
     */
    function addRecipient(
        RecipientType recipientType,
        address wallet,
        uint256 shareBps
    ) external onlyRole(GOVERNOR_ROLE) {
        if (wallet == address(0)) revert ZeroAddress();
        if (recipients.length >= MAX_RECIPIENTS) revert MaxRecipientsReached();

        recipients.push(Recipient({
            recipientType: recipientType,
            wallet: wallet,
            shareBps: shareBps,
            active: true,
            totalReceived: 0
        }));

        recipientIndex[wallet] = recipients.length - 1;

        _validateShareTotal();

        emit RecipientAdded(recipientType, wallet, shareBps);
    }

    /**
     * @notice Update recipient parameters
     */
    function updateRecipient(
        address wallet,
        uint256 newShareBps,
        bool active
    ) external onlyRole(GOVERNOR_ROLE) {
        uint256 index = recipientIndex[wallet];
        if (index >= recipients.length || recipients[index].wallet != wallet) {
            revert InvalidRecipient();
        }

        recipients[index].shareBps = newShareBps;
        recipients[index].active = active;

        _validateShareTotal();

        emit RecipientUpdated(wallet, newShareBps, active);
    }

    /**
     * @notice Batch update all recipient shares
     */
    function setRecipientShares(
        address[] calldata wallets,
        uint256[] calldata shares
    ) external onlyRole(GOVERNOR_ROLE) {
        require(wallets.length == shares.length, "Length mismatch");

        for (uint256 i = 0; i < wallets.length; i++) {
            uint256 index = recipientIndex[wallets[i]];
            if (index < recipients.length && recipients[index].wallet == wallets[i]) {
                recipients[index].shareBps = shares[i];
            }
        }

        _validateShareTotal();
    }

    // ============ Fee Schedule Management ============

    /**
     * @notice Update fee schedule for a source
     */
    function updateFeeSchedule(
        FeeSource source,
        uint256 feeBps,
        bool active
    ) external onlyRole(GOVERNOR_ROLE) {
        if (feeBps > MAX_FEE_BPS) revert InvalidFeeSource();

        feeSchedules[source].feeBps = feeBps;
        feeSchedules[source].active = active;

        emit FeeScheduleUpdated(source, feeBps, active);
    }

    // ============ Configuration ============

    function setPriceOracle(address _oracle) external onlyRole(GOVERNOR_ROLE) {
        priceOracle = _oracle;
    }

    function setBuybackContract(address _buyback) external onlyRole(GOVERNOR_ROLE) {
        buybackContract = _buyback;
    }

    function setInsuranceFund(address _fund) external onlyRole(GOVERNOR_ROLE) {
        insuranceFund = _fund;
    }

    // ============ Emergency Functions ============

    /**
     * @notice Emergency withdrawal of stuck funds
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address recipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (recipient == address(0)) revert ZeroAddress();

        _transferToken(token, recipient, amount);

        emit EmergencyWithdrawal(token, amount, recipient);
    }

    function pause() external onlyRole(GOVERNOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GOVERNOR_ROLE) {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @notice Get all recipients
     */
    function getRecipients() external view returns (Recipient[] memory) {
        return recipients;
    }

    /**
     * @notice Get pending distribution for a token
     */
    function getPendingDistribution(address token) external view returns (uint256) {
        return tokenBalances[token].pendingDistribution;
    }

    /**
     * @notice Get total pending across all tokens
     */
    function getTotalPendingUSD() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            uint256 pending = tokenBalances[token].pendingDistribution;
            if (pending > 0) {
                total += _getValueUSD(token, pending);
            }
        }
        return total;
    }

    /**
     * @notice Get fee schedule for a source
     */
    function getFeeSchedule(FeeSource source) external view returns (FeeSchedule memory) {
        return feeSchedules[source];
    }

    /**
     * @notice Get recent fee records
     */
    function getRecentFees(uint256 count) external view returns (FeeRecord[] memory) {
        uint256 len = feeRecords.length;
        uint256 start = len > count ? len - count : 0;
        uint256 resultLen = len - start;

        FeeRecord[] memory result = new FeeRecord[](resultLen);
        for (uint256 i = 0; i < resultLen; i++) {
            result[i] = feeRecords[start + i];
        }
        return result;
    }

    /**
     * @notice Get treasury statistics
     */
    function getStats() external view returns (
        uint256 totalCollected,
        uint256 totalDistributed,
        uint256 pendingUSD,
        uint256 lastDistribution,
        uint256 recipientCount,
        uint256 tokenCount
    ) {
        totalCollected = totalFeesCollectedUSD;
        totalDistributed = totalDistributedUSD;
        pendingUSD = this.getTotalPendingUSD();
        lastDistribution = lastDistributionTime;
        recipientCount = recipients.length;
        tokenCount = supportedTokens.length;
    }

    // ============ Internal Functions ============

    function _collectFeeInternal(
        FeeSource source,
        address token,
        uint256 amount
    ) internal {
        if (amount == 0) return;

        FeeSchedule storage schedule = feeSchedules[source];
        if (!schedule.active) return;

        if (token != address(0)) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        TokenBalance storage balance = tokenBalances[token];
        balance.balance += amount;
        balance.pendingDistribution += amount;

        if (balance.token == address(0)) {
            balance.token = token;
            supportedTokens.push(token);
        }

        uint256 valueUSD = _getValueUSD(token, amount);
        schedule.totalCollected += amount;
        schedule.lastCollected = block.timestamp;
        totalFeesCollectedUSD += valueUSD;

        _recordFee(source, token, amount, valueUSD);

        emit FeeCollected(source, token, amount, valueUSD, msg.sender);
    }

    function _distributeInternal(address token) internal {
        TokenBalance storage balance = tokenBalances[token];
        if (balance.pendingDistribution == 0) return;

        uint256 totalToDistribute = balance.pendingDistribution;

        for (uint256 i = 0; i < recipients.length; i++) {
            Recipient storage recipient = recipients[i];
            if (!recipient.active) continue;

            uint256 amount = (totalToDistribute * recipient.shareBps) / BPS_PRECISION;
            if (amount == 0) continue;

            if (recipient.recipientType == RecipientType.BUYBACK_BURN) {
                _executeBuyback(token, amount);
            } else {
                _transferToken(token, recipient.wallet, amount);
            }

            recipient.totalReceived += amount;
        }

        balance.pendingDistribution = 0;
        balance.lastDistributed = block.timestamp;

        uint256 valueUSD = _getValueUSD(token, totalToDistribute);
        totalDistributedUSD += valueUSD;

        emit FeeDistributed(token, totalToDistribute, block.timestamp);
    }

    function _recordFee(
        FeeSource source,
        address token,
        uint256 amount,
        uint256 valueUSD
    ) internal {
        if (feeRecords.length >= maxFeeRecords) {
            // Rotate oldest record
            for (uint256 i = 0; i < feeRecords.length - 1; i++) {
                feeRecords[i] = feeRecords[i + 1];
            }
            feeRecords.pop();
        }

        feeRecords.push(FeeRecord({
            source: source,
            token: token,
            amount: amount,
            valueUSD: valueUSD,
            collector: msg.sender,
            timestamp: block.timestamp,
            txHash: bytes32(0) // Set by indexer
        }));
    }

    function _executeBuyback(address token, uint256 amount) internal {
        if (buybackContract == address(0) || token == atlasToken) {
            // Can't buyback with X3 or no buyback contract
            // Send to DAO treasury instead
            address daoWallet = _findRecipientWallet(RecipientType.DAO_TREASURY);
            if (daoWallet != address(0)) {
                _transferToken(token, daoWallet, amount);
            }
            return;
        }

        // Approve and execute buyback
        if (token != address(0)) {
            IERC20(token).safeApprove(buybackContract, amount);
        }

        // Call buyback contract (interface assumed)
        (bool success, bytes memory data) = buybackContract.call{
            value: token == address(0) ? amount : 0
        }(
            abi.encodeWithSignature(
                "buyback(address,uint256)",
                token,
                amount
            )
        );

        if (success && data.length >= 32) {
            uint256 atlasReceived = abi.decode(data, (uint256));
            emit BuybackExecuted(token, amount, atlasReceived);
        }
    }

    function _transferToken(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "Native transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _getValueUSD(address token, uint256 amount) internal view returns (uint256) {
        if (priceOracle == address(0)) return 0;

        // Call oracle for price
        (bool success, bytes memory data) = priceOracle.staticcall(
            abi.encodeWithSignature("getAssetPrice(address)", token)
        );

        if (success && data.length >= 32) {
            uint256 price = abi.decode(data, (uint256));
            // Assuming 8 decimal price, 18 decimal tokens
            return (amount * price) / 1e18;
        }

        return 0;
    }

    function _findRecipientWallet(RecipientType rType) internal view returns (address) {
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i].recipientType == rType && recipients[i].active) {
                return recipients[i].wallet;
            }
        }
        return address(0);
    }

    function _validateShareTotal() internal view {
        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i].active) {
                total += recipients[i].shareBps;
            }
        }
        if (total != BPS_PRECISION) revert InvalidShareTotal();
    }

    function _initializeDefaultSchedules() internal {
        // Lending fees
        feeSchedules[FeeSource.LENDING_INTEREST] = FeeSchedule({
            source: FeeSource.LENDING_INTEREST,
            feeBps: 1000, // 10% of interest
            active: true,
            totalCollected: 0,
            lastCollected: 0
        });

        feeSchedules[FeeSource.LENDING_LIQUIDATION] = FeeSchedule({
            source: FeeSource.LENDING_LIQUIDATION,
            feeBps: 500, // 5% of liquidation bonus
            active: true,
            totalCollected: 0,
            lastCollected: 0
        });

        feeSchedules[FeeSource.FLASH_LOAN] = FeeSchedule({
            source: FeeSource.FLASH_LOAN,
            feeBps: 9, // 0.09% flash loan fee
            active: true,
            totalCollected: 0,
            lastCollected: 0
        });

        // Swap fees
        feeSchedules[FeeSource.SWAP_FEE] = FeeSchedule({
            source: FeeSource.SWAP_FEE,
            feeBps: 30, // 0.3% swap fee
            active: true,
            totalCollected: 0,
            lastCollected: 0
        });

        // Launchpad fees
        feeSchedules[FeeSource.LAUNCHPAD_PRESALE] = FeeSchedule({
            source: FeeSource.LAUNCHPAD_PRESALE,
            feeBps: 200, // 2% presale fee
            active: true,
            totalCollected: 0,
            lastCollected: 0
        });

        feeSchedules[FeeSource.LAUNCHPAD_AUCTION] = FeeSchedule({
            source: FeeSource.LAUNCHPAD_AUCTION,
            feeBps: 250, // 2.5% auction fee
            active: true,
            totalCollected: 0,
            lastCollected: 0
        });

        // CCPM fees
        feeSchedules[FeeSource.CCPM_MANAGEMENT] = FeeSchedule({
            source: FeeSource.CCPM_MANAGEMENT,
            feeBps: 50, // 0.5% management fee
            active: true,
            totalCollected: 0,
            lastCollected: 0
        });

        feeSchedules[FeeSource.CCPM_MIGRATION] = FeeSchedule({
            source: FeeSource.CCPM_MIGRATION,
            feeBps: 25, // 0.25% migration fee
            active: true,
            totalCollected: 0,
            lastCollected: 0
        });
    }

    function _initializeDefaultRecipients(address admin) internal {
        // DAO Treasury - 40%
        recipients.push(Recipient({
            recipientType: RecipientType.DAO_TREASURY,
            wallet: admin,
            shareBps: 4000,
            active: true,
            totalReceived: 0
        }));

        // Dev Fund - 20%
        recipients.push(Recipient({
            recipientType: RecipientType.DEV_FUND,
            wallet: admin,
            shareBps: 2000,
            active: true,
            totalReceived: 0
        }));

        // Marketing - 10%
        recipients.push(Recipient({
            recipientType: RecipientType.MARKETING,
            wallet: admin,
            shareBps: 1000,
            active: true,
            totalReceived: 0
        }));

        // LP Incentives - 15%
        recipients.push(Recipient({
            recipientType: RecipientType.LP_INCENTIVES,
            wallet: admin,
            shareBps: 1500,
            active: true,
            totalReceived: 0
        }));

        // Buyback/Burn - 10%
        recipients.push(Recipient({
            recipientType: RecipientType.BUYBACK_BURN,
            wallet: admin,
            shareBps: 1000,
            active: true,
            totalReceived: 0
        }));

        // Insurance Fund - 5%
        recipients.push(Recipient({
            recipientType: RecipientType.INSURANCE_FUND,
            wallet: admin,
            shareBps: 500,
            active: true,
            totalReceived: 0
        }));
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    receive() external payable {}
}
