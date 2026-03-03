// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ValidatorRegistry
 * @author X3 Chain Team
 * @notice Comprehensive validator staking and management for X3 Chain
 * @dev Handles validator registration, staking, delegation, slashing, and rewards
 *
 * ## Architecture
 *
 * ```
 * ┌────────────────────────────────────────────────────────────────┐
 * │                    ValidatorRegistry                           │
 * ├────────────────────────────────────────────────────────────────┤
 * │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
 * │  │  Validator   │  │  Delegation  │  │  Rewards             │ │
 * │  │  Management  │  │  Management  │  │  Distribution        │ │
 * │  └──────────────┘  └──────────────┘  └──────────────────────┘ │
 * ├────────────────────────────────────────────────────────────────┤
 * │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
 * │  │  Slashing    │  │  Epoch       │  │  Commission          │ │
 * │  │  Engine      │  │  Management  │  │  System              │ │
 * │  └──────────────┘  └──────────────┘  └──────────────────────┘ │
 * └────────────────────────────────────────────────────────────────┘
 * ```
 */
contract ValidatorRegistry is
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");
    bytes32 public constant EPOCH_MANAGER_ROLE = keccak256("EPOCH_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Minimum stake to become a validator
    uint256 public constant MIN_VALIDATOR_STAKE = 32_000 ether;

    /// @notice Minimum delegation amount
    uint256 public constant MIN_DELEGATION = 100 ether;

    /// @notice Maximum validators in active set
    uint256 public constant MAX_VALIDATORS = 100;

    /// @notice Epoch duration in blocks
    uint256 public constant EPOCH_BLOCKS = 7200; // ~24 hours at 12s blocks

    /// @notice Unbonding period in epochs
    uint256 public constant UNBONDING_EPOCHS = 21;

    /// @notice Maximum commission rate (30%)
    uint256 public constant MAX_COMMISSION_RATE = 3000;

    /// @notice Maximum commission change per epoch (1%)
    uint256 public constant MAX_COMMISSION_CHANGE = 100;

    /// @notice Slashing rates (basis points)
    uint256 public constant DOUBLE_SIGN_SLASH_RATE = 5000; // 50%
    uint256 public constant DOWNTIME_SLASH_RATE = 100;     // 1%
    uint256 public constant INVALID_BLOCK_SLASH_RATE = 1000; // 10%

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Validator status
    enum ValidatorStatus {
        Inactive,
        Active,
        Jailed,
        Unbonding,
        Slashed
    }

    /// @notice Slashing reason
    enum SlashReason {
        DoubleSigning,
        Downtime,
        InvalidBlock,
        Custom
    }

    /// @notice Validator information
    struct Validator {
        address operator;
        address rewardAddress;
        bytes32 consensusKey;      // BLS public key hash
        bytes32 networkKey;        // P2P network key
        uint256 selfStake;
        uint256 delegatedStake;
        uint256 commissionRate;    // Basis points (0-10000)
        uint256 pendingCommissionRate;
        uint256 commissionChangeEpoch;
        ValidatorStatus status;
        uint256 jailedUntilEpoch;
        uint256 unbondingEpoch;
        uint256 slashCount;
        uint256 registeredAt;
        string metadata;           // JSON metadata (name, website, etc.)
    }

    /// @notice Delegation information
    struct Delegation {
        address delegator;
        address validator;
        uint256 amount;
        uint256 rewardDebt;
        uint256 unbondingEpoch;
        bool unbonding;
    }

    /// @notice Epoch information
    struct Epoch {
        uint256 epochNumber;
        uint256 startBlock;
        uint256 endBlock;
        uint256 totalStake;
        uint256 rewardsPool;
        uint256 validatorCount;
        bytes32 validatorSetHash;
        bool finalized;
    }

    /// @notice Unbonding request
    struct UnbondingRequest {
        address staker;
        address validator;
        uint256 amount;
        uint256 completionEpoch;
        bool isDelegation;
        bool claimed;
    }

    /// @notice Slash event record
    struct SlashRecord {
        address validator;
        SlashReason reason;
        uint256 amount;
        uint256 epoch;
        bytes32 evidenceHash;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Staking token (X3)
    IERC20 public stakingToken;

    /// @notice Treasury address for slashed funds
    address public treasury;

    /// @notice Current epoch number
    uint256 public currentEpoch;

    /// @notice Total staked across all validators
    uint256 public totalStaked;

    /// @notice Rewards per share (for delegation rewards)
    uint256 public accRewardsPerShare;

    /// @notice Precision for reward calculations
    uint256 public constant PRECISION = 1e18;

    /// @notice Validator index counter
    uint256 public validatorCount;

    /// @notice Unbonding request counter
    uint256 public unbondingRequestCount;

    /// @notice Validators by address
    mapping(address => Validator) public validators;

    /// @notice Validator addresses (for iteration)
    address[] public validatorList;

    /// @notice Active validator set for current epoch
    address[] public activeSet;

    /// @notice Delegations: delegator => validator => delegation
    mapping(address => mapping(address => Delegation)) public delegations;

    /// @notice Delegator's validator list
    mapping(address => address[]) public delegatorValidators;

    /// @notice Epochs by number
    mapping(uint256 => Epoch) public epochs;

    /// @notice Unbonding requests by ID
    mapping(uint256 => UnbondingRequest) public unbondingRequests;

    /// @notice User's unbonding request IDs
    mapping(address => uint256[]) public userUnbondings;

    /// @notice Slash records
    SlashRecord[] public slashRecords;

    /// @notice Validator's accumulated rewards per share
    mapping(address => uint256) public validatorAccRewardsPerShare;

    /// @notice Is address a registered validator
    mapping(address => bool) public isValidator;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event ValidatorRegistered(
        address indexed validator,
        bytes32 consensusKey,
        uint256 stake,
        uint256 commissionRate
    );

    event ValidatorStakeAdded(
        address indexed validator,
        uint256 amount,
        uint256 totalStake
    );

    event ValidatorUnstakeInitiated(
        address indexed validator,
        uint256 amount,
        uint256 completionEpoch
    );

    event ValidatorUpdated(
        address indexed validator,
        string metadata
    );

    event CommissionRateChanged(
        address indexed validator,
        uint256 oldRate,
        uint256 newRate,
        uint256 effectiveEpoch
    );

    event Delegated(
        address indexed delegator,
        address indexed validator,
        uint256 amount
    );

    event UndelegationInitiated(
        address indexed delegator,
        address indexed validator,
        uint256 amount,
        uint256 completionEpoch
    );

    event UnbondingClaimed(
        address indexed staker,
        uint256 indexed requestId,
        uint256 amount
    );

    event RewardsClaimed(
        address indexed staker,
        address indexed validator,
        uint256 amount
    );

    event ValidatorSlashed(
        address indexed validator,
        SlashReason reason,
        uint256 amount,
        bytes32 evidenceHash
    );

    event ValidatorJailed(
        address indexed validator,
        uint256 jailedUntilEpoch
    );

    event ValidatorUnjailed(address indexed validator);

    event EpochAdvanced(
        uint256 indexed epochNumber,
        uint256 totalStake,
        uint256 validatorCount
    );

    event RewardsDistributed(
        uint256 indexed epochNumber,
        uint256 amount
    );

    event ActiveSetUpdated(
        uint256 indexed epochNumber,
        address[] validators
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error InsufficientStake();
    error ValidatorAlreadyRegistered();
    error ValidatorNotFound();
    error ValidatorNotActive();
    error ValidatorJailed();
    error InvalidCommissionRate();
    error CommissionChangeTooFast();
    error InsufficientDelegation();
    error DelegationNotFound();
    error UnbondingNotComplete();
    error AlreadyClaimed();
    error MaxValidatorsReached();
    error InvalidEpoch();
    error EpochNotFinalized();
    error InvalidEvidence();

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZER
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _stakingToken,
        address _treasury
    ) external initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(SLASHER_ROLE, _admin);
        _grantRole(EPOCH_MANAGER_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        stakingToken = IERC20(_stakingToken);
        treasury = _treasury;

        // Initialize first epoch
        currentEpoch = 1;
        epochs[1] = Epoch({
            epochNumber: 1,
            startBlock: block.number,
            endBlock: block.number + EPOCH_BLOCKS,
            totalStake: 0,
            rewardsPool: 0,
            validatorCount: 0,
            validatorSetHash: bytes32(0),
            finalized: false
        });
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATOR REGISTRATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register as a validator
     * @param consensusKey BLS public key hash for consensus
     * @param networkKey P2P network key
     * @param commissionRate Initial commission rate (basis points)
     * @param stake Initial stake amount
     * @param metadata JSON metadata (name, website, etc.)
     */
    function registerValidator(
        bytes32 consensusKey,
        bytes32 networkKey,
        uint256 commissionRate,
        uint256 stake,
        string calldata metadata
    ) external nonReentrant whenNotPaused {
        if (isValidator[msg.sender]) revert ValidatorAlreadyRegistered();
        if (stake < MIN_VALIDATOR_STAKE) revert InsufficientStake();
        if (commissionRate > MAX_COMMISSION_RATE) revert InvalidCommissionRate();
        if (validatorCount >= MAX_VALIDATORS) revert MaxValidatorsReached();

        stakingToken.safeTransferFrom(msg.sender, address(this), stake);

        validators[msg.sender] = Validator({
            operator: msg.sender,
            rewardAddress: msg.sender,
            consensusKey: consensusKey,
            networkKey: networkKey,
            selfStake: stake,
            delegatedStake: 0,
            commissionRate: commissionRate,
            pendingCommissionRate: commissionRate,
            commissionChangeEpoch: 0,
            status: ValidatorStatus.Active,
            jailedUntilEpoch: 0,
            unbondingEpoch: 0,
            slashCount: 0,
            registeredAt: block.timestamp,
            metadata: metadata
        });

        isValidator[msg.sender] = true;
        validatorList.push(msg.sender);
        validatorCount++;
        totalStaked += stake;

        emit ValidatorRegistered(msg.sender, consensusKey, stake, commissionRate);
    }

    /**
     * @notice Add stake to validator
     * @param amount Amount to add
     */
    function addValidatorStake(uint256 amount) external nonReentrant whenNotPaused {
        Validator storage v = validators[msg.sender];
        if (!isValidator[msg.sender]) revert ValidatorNotFound();

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        v.selfStake += amount;
        totalStaked += amount;

        emit ValidatorStakeAdded(msg.sender, amount, v.selfStake + v.delegatedStake);
    }

    /**
     * @notice Initiate unstaking for validator
     * @param amount Amount to unstake
     */
    function initiateValidatorUnstake(uint256 amount) external nonReentrant {
        Validator storage v = validators[msg.sender];
        if (!isValidator[msg.sender]) revert ValidatorNotFound();
        if (v.selfStake - amount < MIN_VALIDATOR_STAKE && amount != v.selfStake) {
            revert InsufficientStake();
        }

        v.selfStake -= amount;
        totalStaked -= amount;

        if (v.selfStake == 0) {
            v.status = ValidatorStatus.Unbonding;
            v.unbondingEpoch = currentEpoch;
        }

        uint256 completionEpoch = currentEpoch + UNBONDING_EPOCHS;
        uint256 requestId = ++unbondingRequestCount;

        unbondingRequests[requestId] = UnbondingRequest({
            staker: msg.sender,
            validator: msg.sender,
            amount: amount,
            completionEpoch: completionEpoch,
            isDelegation: false,
            claimed: false
        });

        userUnbondings[msg.sender].push(requestId);

        emit ValidatorUnstakeInitiated(msg.sender, amount, completionEpoch);
    }

    /**
     * @notice Update validator metadata
     * @param metadata New metadata JSON
     */
    function updateValidatorMetadata(string calldata metadata) external {
        if (!isValidator[msg.sender]) revert ValidatorNotFound();
        validators[msg.sender].metadata = metadata;
        emit ValidatorUpdated(msg.sender, metadata);
    }

    /**
     * @notice Update validator reward address
     * @param newRewardAddress New address to receive rewards
     */
    function updateRewardAddress(address newRewardAddress) external {
        if (!isValidator[msg.sender]) revert ValidatorNotFound();
        validators[msg.sender].rewardAddress = newRewardAddress;
    }

    /**
     * @notice Request commission rate change (effective next epoch)
     * @param newRate New commission rate
     */
    function changeCommissionRate(uint256 newRate) external {
        Validator storage v = validators[msg.sender];
        if (!isValidator[msg.sender]) revert ValidatorNotFound();
        if (newRate > MAX_COMMISSION_RATE) revert InvalidCommissionRate();

        uint256 diff = newRate > v.commissionRate 
            ? newRate - v.commissionRate 
            : v.commissionRate - newRate;
        
        if (diff > MAX_COMMISSION_CHANGE) revert CommissionChangeTooFast();

        uint256 oldRate = v.commissionRate;
        v.pendingCommissionRate = newRate;
        v.commissionChangeEpoch = currentEpoch + 1;

        emit CommissionRateChanged(msg.sender, oldRate, newRate, currentEpoch + 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DELEGATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Delegate stake to a validator
     * @param validator Validator address
     * @param amount Amount to delegate
     */
    function delegate(
        address validator,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        if (!isValidator[validator]) revert ValidatorNotFound();
        if (amount < MIN_DELEGATION) revert InsufficientDelegation();

        Validator storage v = validators[validator];
        if (v.status != ValidatorStatus.Active) revert ValidatorNotActive();

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        Delegation storage d = delegations[msg.sender][validator];
        
        // Claim pending rewards before updating
        if (d.amount > 0) {
            _claimDelegationRewards(msg.sender, validator);
        } else {
            delegatorValidators[msg.sender].push(validator);
        }

        d.delegator = msg.sender;
        d.validator = validator;
        d.amount += amount;
        d.rewardDebt = d.amount * validatorAccRewardsPerShare[validator] / PRECISION;

        v.delegatedStake += amount;
        totalStaked += amount;

        emit Delegated(msg.sender, validator, amount);
    }

    /**
     * @notice Initiate undelegation
     * @param validator Validator to undelegate from
     * @param amount Amount to undelegate
     */
    function undelegate(
        address validator,
        uint256 amount
    ) external nonReentrant {
        Delegation storage d = delegations[msg.sender][validator];
        if (d.amount == 0) revert DelegationNotFound();
        if (d.amount < amount) revert InsufficientDelegation();

        // Claim pending rewards
        _claimDelegationRewards(msg.sender, validator);

        d.amount -= amount;
        d.rewardDebt = d.amount * validatorAccRewardsPerShare[validator] / PRECISION;

        validators[validator].delegatedStake -= amount;
        totalStaked -= amount;

        uint256 completionEpoch = currentEpoch + UNBONDING_EPOCHS;
        uint256 requestId = ++unbondingRequestCount;

        unbondingRequests[requestId] = UnbondingRequest({
            staker: msg.sender,
            validator: validator,
            amount: amount,
            completionEpoch: completionEpoch,
            isDelegation: true,
            claimed: false
        });

        userUnbondings[msg.sender].push(requestId);

        emit UndelegationInitiated(msg.sender, validator, amount, completionEpoch);
    }

    /**
     * @notice Claim completed unbonding
     * @param requestId Unbonding request ID
     */
    function claimUnbonding(uint256 requestId) external nonReentrant {
        UnbondingRequest storage req = unbondingRequests[requestId];
        if (req.staker != msg.sender) revert DelegationNotFound();
        if (req.claimed) revert AlreadyClaimed();
        if (currentEpoch < req.completionEpoch) revert UnbondingNotComplete();

        req.claimed = true;
        stakingToken.safeTransfer(msg.sender, req.amount);

        emit UnbondingClaimed(msg.sender, requestId, req.amount);
    }

    /**
     * @notice Claim delegation rewards
     * @param validator Validator to claim from
     */
    function claimRewards(address validator) external nonReentrant {
        _claimDelegationRewards(msg.sender, validator);
    }

    /**
     * @notice Internal function to claim delegation rewards
     */
    function _claimDelegationRewards(address delegator, address validator) internal {
        Delegation storage d = delegations[delegator][validator];
        if (d.amount == 0) return;

        uint256 accRewards = validatorAccRewardsPerShare[validator];
        uint256 pending = d.amount * accRewards / PRECISION - d.rewardDebt;

        if (pending > 0) {
            d.rewardDebt = d.amount * accRewards / PRECISION;
            stakingToken.safeTransfer(delegator, pending);
            emit RewardsClaimed(delegator, validator, pending);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SLASHING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Slash a validator for misbehavior
     * @param validator Validator to slash
     * @param reason Slashing reason
     * @param evidenceHash Hash of evidence
     */
    function slashValidator(
        address validator,
        SlashReason reason,
        bytes32 evidenceHash
    ) external onlyRole(SLASHER_ROLE) {
        Validator storage v = validators[validator];
        if (!isValidator[validator]) revert ValidatorNotFound();

        uint256 slashRate;
        if (reason == SlashReason.DoubleSigning) {
            slashRate = DOUBLE_SIGN_SLASH_RATE;
        } else if (reason == SlashReason.Downtime) {
            slashRate = DOWNTIME_SLASH_RATE;
        } else if (reason == SlashReason.InvalidBlock) {
            slashRate = INVALID_BLOCK_SLASH_RATE;
        } else {
            slashRate = DOWNTIME_SLASH_RATE; // Default
        }

        uint256 totalValidatorStake = v.selfStake + v.delegatedStake;
        uint256 slashAmount = totalValidatorStake * slashRate / 10000;

        // Slash from self-stake first, then delegations proportionally
        uint256 selfSlash = v.selfStake * slashRate / 10000;
        uint256 delegationSlash = slashAmount - selfSlash;

        v.selfStake -= selfSlash;
        v.delegatedStake -= delegationSlash;
        totalStaked -= slashAmount;
        v.slashCount++;

        // Transfer slashed funds to treasury
        stakingToken.safeTransfer(treasury, slashAmount);

        slashRecords.push(SlashRecord({
            validator: validator,
            reason: reason,
            amount: slashAmount,
            epoch: currentEpoch,
            evidenceHash: evidenceHash
        }));

        emit ValidatorSlashed(validator, reason, slashAmount, evidenceHash);

        // Jail validator for double signing
        if (reason == SlashReason.DoubleSigning) {
            _jailValidator(validator, currentEpoch + 30); // Jail for 30 epochs
        }
    }

    /**
     * @notice Jail a validator
     */
    function _jailValidator(address validator, uint256 jailUntil) internal {
        Validator storage v = validators[validator];
        v.status = ValidatorStatus.Jailed;
        v.jailedUntilEpoch = jailUntil;
        emit ValidatorJailed(validator, jailUntil);
    }

    /**
     * @notice Unjail validator (self-service after jail period)
     */
    function unjailValidator() external nonReentrant {
        Validator storage v = validators[msg.sender];
        if (v.status != ValidatorStatus.Jailed) revert ValidatorNotFound();
        if (currentEpoch < v.jailedUntilEpoch) revert ValidatorJailed();
        if (v.selfStake < MIN_VALIDATOR_STAKE) revert InsufficientStake();

        v.status = ValidatorStatus.Active;
        v.jailedUntilEpoch = 0;

        emit ValidatorUnjailed(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EPOCH MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Advance to next epoch
     * @param rewardsAmount Rewards to distribute this epoch
     */
    function advanceEpoch(uint256 rewardsAmount) external onlyRole(EPOCH_MANAGER_ROLE) {
        Epoch storage currentEpochData = epochs[currentEpoch];
        
        // Finalize current epoch
        currentEpochData.finalized = true;
        currentEpochData.endBlock = block.number;

        // Distribute rewards
        if (rewardsAmount > 0 && totalStaked > 0) {
            stakingToken.safeTransferFrom(msg.sender, address(this), rewardsAmount);
            _distributeRewards(rewardsAmount);
        }

        // Apply pending commission changes
        _applyCommissionChanges();

        // Update active set
        _updateActiveSet();

        // Create next epoch
        currentEpoch++;
        epochs[currentEpoch] = Epoch({
            epochNumber: currentEpoch,
            startBlock: block.number,
            endBlock: block.number + EPOCH_BLOCKS,
            totalStake: totalStaked,
            rewardsPool: 0,
            validatorCount: activeSet.length,
            validatorSetHash: _computeValidatorSetHash(),
            finalized: false
        });

        emit EpochAdvanced(currentEpoch, totalStaked, activeSet.length);
    }

    /**
     * @notice Distribute rewards to validators and delegators
     */
    function _distributeRewards(uint256 amount) internal {
        uint256 totalActive = 0;
        
        // Calculate total active stake
        for (uint256 i = 0; i < activeSet.length; i++) {
            Validator storage v = validators[activeSet[i]];
            totalActive += v.selfStake + v.delegatedStake;
        }

        if (totalActive == 0) return;

        // Distribute to each validator proportionally
        for (uint256 i = 0; i < activeSet.length; i++) {
            address validatorAddr = activeSet[i];
            Validator storage v = validators[validatorAddr];
            
            uint256 validatorTotalStake = v.selfStake + v.delegatedStake;
            uint256 validatorRewards = amount * validatorTotalStake / totalActive;

            // Commission goes to validator
            uint256 commission = validatorRewards * v.commissionRate / 10000;
            
            // Transfer commission to validator reward address
            if (commission > 0) {
                stakingToken.safeTransfer(v.rewardAddress, commission);
            }

            // Remaining rewards distributed to delegators (including self-stake)
            uint256 delegatorRewards = validatorRewards - commission;
            if (validatorTotalStake > 0) {
                validatorAccRewardsPerShare[validatorAddr] += 
                    delegatorRewards * PRECISION / validatorTotalStake;
            }
        }

        emit RewardsDistributed(currentEpoch, amount);
    }

    /**
     * @notice Apply pending commission rate changes
     */
    function _applyCommissionChanges() internal {
        for (uint256 i = 0; i < validatorList.length; i++) {
            Validator storage v = validators[validatorList[i]];
            if (v.commissionChangeEpoch == currentEpoch + 1) {
                v.commissionRate = v.pendingCommissionRate;
            }
        }
    }

    /**
     * @notice Update active validator set (top validators by stake)
     */
    function _updateActiveSet() internal {
        delete activeSet;

        // Simple selection: take all active validators sorted by stake
        // (In production, use more efficient sorting)
        address[] memory candidates = new address[](validatorList.length);
        uint256 candidateCount = 0;

        for (uint256 i = 0; i < validatorList.length; i++) {
            Validator storage v = validators[validatorList[i]];
            if (v.status == ValidatorStatus.Active && v.selfStake >= MIN_VALIDATOR_STAKE) {
                candidates[candidateCount] = validatorList[i];
                candidateCount++;
            }
        }

        // Sort by total stake (bubble sort for simplicity, use better algorithm in production)
        for (uint256 i = 0; i < candidateCount; i++) {
            for (uint256 j = i + 1; j < candidateCount; j++) {
                uint256 stakeI = validators[candidates[i]].selfStake + validators[candidates[i]].delegatedStake;
                uint256 stakeJ = validators[candidates[j]].selfStake + validators[candidates[j]].delegatedStake;
                if (stakeJ > stakeI) {
                    (candidates[i], candidates[j]) = (candidates[j], candidates[i]);
                }
            }
        }

        // Take top MAX_VALIDATORS
        uint256 setSize = candidateCount > MAX_VALIDATORS ? MAX_VALIDATORS : candidateCount;
        for (uint256 i = 0; i < setSize; i++) {
            activeSet.push(candidates[i]);
        }

        emit ActiveSetUpdated(currentEpoch + 1, activeSet);
    }

    /**
     * @notice Compute validator set hash
     */
    function _computeValidatorSetHash() internal view returns (bytes32) {
        bytes memory packed;
        for (uint256 i = 0; i < activeSet.length; i++) {
            Validator storage v = validators[activeSet[i]];
            packed = abi.encodePacked(packed, activeSet[i], v.consensusKey, v.selfStake + v.delegatedStake);
        }
        return keccak256(packed);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get validator info
     */
    function getValidator(address validator) external view returns (Validator memory) {
        return validators[validator];
    }

    /**
     * @notice Get active validator set
     */
    function getActiveSet() external view returns (address[] memory) {
        return activeSet;
    }

    /**
     * @notice Get delegation info
     */
    function getDelegation(address delegator, address validator) external view returns (Delegation memory) {
        return delegations[delegator][validator];
    }

    /**
     * @notice Get pending delegation rewards
     */
    function pendingRewards(address delegator, address validator) external view returns (uint256) {
        Delegation storage d = delegations[delegator][validator];
        if (d.amount == 0) return 0;
        return d.amount * validatorAccRewardsPerShare[validator] / PRECISION - d.rewardDebt;
    }

    /**
     * @notice Get user's unbonding requests
     */
    function getUserUnbondings(address user) external view returns (uint256[] memory) {
        return userUnbondings[user];
    }

    /**
     * @notice Get validator count
     */
    function getValidatorCount() external view returns (uint256) {
        return validatorCount;
    }

    /**
     * @notice Get epoch info
     */
    function getEpoch(uint256 epochNum) external view returns (Epoch memory) {
        return epochs[epochNum];
    }

    /**
     * @notice Check if validator is in active set
     */
    function isInActiveSet(address validator) external view returns (bool) {
        for (uint256 i = 0; i < activeSet.length; i++) {
            if (activeSet[i] == validator) return true;
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════════════════

    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = _treasury;
    }
}
