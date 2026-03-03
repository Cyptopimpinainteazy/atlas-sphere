// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title X3Token
 * @author X3 Chain Team
 * @notice Native token for X3 Chain ecosystem (EVM representation)
 * @dev ERC20 with governance, permit, cross-chain minting, and deflationary mechanics
 *
 * ## Token Economics
 *
 * ```
 * Total Supply: 1,000,000,000 X3 (1 billion)
 * 
 * Distribution:
 * - Validator Rewards Pool:    30% (300M) - Emitted over 10 years
 * - Treasury:                  20% (200M) - DAO controlled
 * - Team & Advisors:           15% (150M) - 4 year vesting
 * - Ecosystem Fund:            15% (150M) - Grants, partnerships
 * - Public Sale:               10% (100M)
 * - Liquidity Mining:           5% (50M)  - First 2 years
 * - Airdrop:                    5% (50M)
 * ```
 *
 * ## Features
 * - Governance voting power (ERC20Votes)
 * - Gasless approvals (ERC20Permit)
 * - Cross-chain mint/burn bridges
 * - Deflationary fee burn mechanism
 * - Inflation schedule for staking rewards
 */
contract X3Token is
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Maximum total supply (1 billion tokens)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;

    /// @notice Initial supply to mint at launch
    uint256 public constant INITIAL_SUPPLY = 400_000_000 * 10**18;

    /// @notice Validator rewards pool (minted over time)
    uint256 public constant VALIDATOR_REWARDS_POOL = 300_000_000 * 10**18;

    /// @notice Annual inflation rate for rewards (starts at 8%, decreases)
    uint256 public constant INITIAL_INFLATION_RATE = 800; // 8% in basis points

    /// @notice Minimum inflation rate
    uint256 public constant MIN_INFLATION_RATE = 100; // 1%

    /// @notice Inflation decrease per year
    uint256 public constant INFLATION_DECREASE = 100; // 1% per year

    /// @notice Transfer fee burn rate (0.1%)
    uint256 public constant BURN_RATE = 10; // 0.1% in basis points

    /// @notice Basis points denominator
    uint256 public constant BPS = 10000;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Treasury address
    address public treasury;

    /// @notice Fee collector address
    address public feeCollector;

    /// @notice Total tokens burned
    uint256 public totalBurned;

    /// @notice Total validator rewards minted
    uint256 public totalRewardsMinted;

    /// @notice Launch timestamp for inflation calculation
    uint256 public launchTimestamp;

    /// @notice Last rewards mint timestamp
    uint256 public lastRewardsMint;

    /// @notice Transfer fee enabled
    bool public feeEnabled;

    /// @notice Fee-exempt addresses
    mapping(address => bool) public feeExempt;

    /// @notice Blacklisted addresses (regulatory compliance)
    mapping(address => bool) public blacklisted;

    /// @notice Cross-chain bridge balances (for accounting)
    mapping(uint256 => uint256) public bridgeBalances; // chainId => balance

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event RewardsMinted(uint256 amount, address indexed recipient);
    event TokensBurned(address indexed from, uint256 amount);
    event BridgeMint(uint256 indexed sourceChain, address indexed recipient, uint256 amount);
    event BridgeBurn(uint256 indexed destChain, address indexed sender, uint256 amount);
    event FeeCollected(address indexed from, uint256 amount);
    event FeeExemptionSet(address indexed account, bool exempt);
    event BlacklistUpdated(address indexed account, bool blacklisted);
    event TreasuryUpdated(address indexed newTreasury);
    event FeeCollectorUpdated(address indexed newCollector);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error ExceedsMaxSupply();
    error ExceedsRewardsPool();
    error Blacklisted();
    error InvalidAddress();
    error CooldownNotComplete();

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZER
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _treasury,
        address _feeCollector
    ) external initializer {
        __ERC20_init("X3 Chain Token", "X3");
        __ERC20Burnable_init();
        __ERC20Permit_init("X3 Chain Token");
        __ERC20Votes_init();
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
        _grantRole(FEE_MANAGER_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        treasury = _treasury;
        feeCollector = _feeCollector;
        launchTimestamp = block.timestamp;
        lastRewardsMint = block.timestamp;

        // Mint initial supply to treasury
        _mint(_treasury, INITIAL_SUPPLY);

        // Exempt treasury and fee collector from fees
        feeExempt[_treasury] = true;
        feeExempt[_feeCollector] = true;
        feeExempt[address(this)] = true;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // ═══════════════════════════════════════════════════════════════════════════
    // ERC20 OVERRIDES
    // ═══════════════════════════════════════════════════════════════════════════

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) whenNotPaused {
        // Check blacklist
        if (blacklisted[from] || blacklisted[to]) revert Blacklisted();

        // Apply transfer fee if enabled and neither party is exempt
        uint256 fee = 0;
        if (feeEnabled && from != address(0) && to != address(0)) {
            if (!feeExempt[from] && !feeExempt[to]) {
                fee = amount * BURN_RATE / BPS;
                if (fee > 0) {
                    // Burn half, send half to fee collector
                    uint256 burnAmount = fee / 2;
                    uint256 collectAmount = fee - burnAmount;

                    super._update(from, address(0), burnAmount);
                    totalBurned += burnAmount;
                    emit TokensBurned(from, burnAmount);

                    if (collectAmount > 0 && feeCollector != address(0)) {
                        super._update(from, feeCollector, collectAmount);
                        emit FeeCollected(from, collectAmount);
                    }

                    amount -= fee;
                }
            }
        }

        super._update(from, to, amount);
    }

    function nonces(address owner) public view override(ERC20PermitUpgradeable, NoncesUpgradeable) returns (uint256) {
        return super.nonces(owner);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MINTING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Mint validator rewards based on inflation schedule
     * @param recipient Address to receive rewards
     * @param amount Amount to mint
     */
    function mintRewards(address recipient, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (totalRewardsMinted + amount > VALIDATOR_REWARDS_POOL) revert ExceedsRewardsPool();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();

        totalRewardsMinted += amount;
        lastRewardsMint = block.timestamp;
        _mint(recipient, amount);

        emit RewardsMinted(amount, recipient);
    }

    /**
     * @notice Calculate current inflation rate based on time since launch
     * @return Current annual inflation rate in basis points
     */
    function currentInflationRate() public view returns (uint256) {
        uint256 yearsElapsed = (block.timestamp - launchTimestamp) / 365 days;
        uint256 decrease = yearsElapsed * INFLATION_DECREASE;
        
        if (decrease >= INITIAL_INFLATION_RATE - MIN_INFLATION_RATE) {
            return MIN_INFLATION_RATE;
        }
        
        return INITIAL_INFLATION_RATE - decrease;
    }

    /**
     * @notice Calculate mintable rewards for current period
     * @return Amount of tokens that can be minted
     */
    function mintableRewards() public view returns (uint256) {
        uint256 timeElapsed = block.timestamp - lastRewardsMint;
        uint256 rate = currentInflationRate();
        uint256 annualMint = totalSupply() * rate / BPS;
        uint256 mintable = annualMint * timeElapsed / 365 days;

        // Cap at remaining rewards pool
        uint256 remaining = VALIDATOR_REWARDS_POOL - totalRewardsMinted;
        return mintable > remaining ? remaining : mintable;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CROSS-CHAIN BRIDGE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Mint tokens from cross-chain bridge
     * @param sourceChain Source chain ID
     * @param recipient Recipient address
     * @param amount Amount to mint
     */
    function bridgeMint(
        uint256 sourceChain,
        address recipient,
        uint256 amount
    ) external onlyRole(BRIDGE_ROLE) {
        if (recipient == address(0)) revert InvalidAddress();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();

        bridgeBalances[sourceChain] += amount;
        _mint(recipient, amount);

        emit BridgeMint(sourceChain, recipient, amount);
    }

    /**
     * @notice Burn tokens for cross-chain bridge
     * @param destChain Destination chain ID
     * @param amount Amount to burn
     */
    function bridgeBurn(uint256 destChain, uint256 amount) external {
        if (blacklisted[msg.sender]) revert Blacklisted();

        _burn(msg.sender, amount);
        
        // Adjust bridge balance
        if (bridgeBalances[destChain] >= amount) {
            bridgeBalances[destChain] -= amount;
        }

        emit BridgeBurn(destChain, msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FEE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Enable or disable transfer fees
     * @param enabled Whether fees are enabled
     */
    function setFeeEnabled(bool enabled) external onlyRole(FEE_MANAGER_ROLE) {
        feeEnabled = enabled;
    }

    /**
     * @notice Set fee exemption for an address
     * @param account Address to set
     * @param exempt Whether exempt from fees
     */
    function setFeeExempt(address account, bool exempt) external onlyRole(FEE_MANAGER_ROLE) {
        feeExempt[account] = exempt;
        emit FeeExemptionSet(account, exempt);
    }

    /**
     * @notice Update fee collector address
     * @param newCollector New fee collector
     */
    function setFeeCollector(address newCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newCollector == address(0)) revert InvalidAddress();
        feeExempt[feeCollector] = false;
        feeCollector = newCollector;
        feeExempt[newCollector] = true;
        emit FeeCollectorUpdated(newCollector);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPLIANCE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Add or remove address from blacklist
     * @param account Address to update
     * @param status Blacklist status
     */
    function setBlacklist(address account, bool status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        blacklisted[account] = status;
        emit BlacklistUpdated(account, status);
    }

    /**
     * @notice Batch blacklist update
     * @param accounts Addresses to update
     * @param status Blacklist status
     */
    function batchSetBlacklist(address[] calldata accounts, bool status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            blacklisted[accounts[i]] = status;
            emit BlacklistUpdated(accounts[i], status);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert InvalidAddress();
        feeExempt[treasury] = false;
        treasury = newTreasury;
        feeExempt[newTreasury] = true;
        emit TreasuryUpdated(newTreasury);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get token statistics
     */
    function getTokenStats() external view returns (
        uint256 _totalSupply,
        uint256 _totalBurned,
        uint256 _totalRewardsMinted,
        uint256 _circulatingSupply,
        uint256 _inflationRate
    ) {
        return (
            totalSupply(),
            totalBurned,
            totalRewardsMinted,
            totalSupply() - balanceOf(treasury),
            currentInflationRate()
        );
    }

    /**
     * @notice Get remaining rewards that can be minted
     */
    function remainingRewards() external view returns (uint256) {
        return VALIDATOR_REWARDS_POOL - totalRewardsMinted;
    }

    /**
     * @notice Clock used for voting snapshots (block number)
     */
    function clock() public view override returns (uint48) {
        return uint48(block.number);
    }

    /**
     * @notice Machine-readable clock mode
     */
    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=blocknumber&from=default";
    }
}
