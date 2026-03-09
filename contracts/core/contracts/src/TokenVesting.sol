// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TokenVesting
 * @notice Token vesting contract for X3 Chain with multiple vesting schedules
 * @dev Supports linear vesting, cliff vesting, and milestone-based vesting
 * 
 * Use cases:
 * - Team token vesting
 * - Investor allocations
 * - Advisor grants
 * - Community rewards
 * - Ecosystem fund distributions
 */
contract TokenVesting is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    enum VestingType {
        LINEAR,           // Linear release over time
        CLIFF_LINEAR,     // Cliff then linear
        MILESTONE,        // Milestone-based releases
        INSTANT_CLIFF     // Instant release after cliff
    }

    struct VestingSchedule {
        uint256 scheduleId;
        address beneficiary;
        address token;
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 vestingDuration;
        VestingType vestingType;
        bool revocable;
        bool revoked;
        uint256 revokedTime;
        string category; // "team", "investor", "advisor", "community"
    }

    struct Milestone {
        string description;
        uint256 releasePercent; // In BPS (10000 = 100%)
        bool completed;
        uint256 completedTime;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS & ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant VESTING_MANAGER_ROLE = keccak256("VESTING_MANAGER_ROLE");
    bytes32 public constant MILESTONE_MANAGER_ROLE = keccak256("MILESTONE_MANAGER_ROLE");

    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_SCHEDULES_PER_BENEFICIARY = 10;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    // Schedule counter
    uint256 public nextScheduleId;

    // All vesting schedules
    mapping(uint256 => VestingSchedule) public schedules;

    // Schedules per beneficiary
    mapping(address => uint256[]) public beneficiarySchedules;

    // Milestones per schedule (for MILESTONE type)
    mapping(uint256 => Milestone[]) public scheduleMilestones;

    // Total tokens locked per token address
    mapping(address => uint256) public totalLockedTokens;

    // Revoked tokens destination
    address public revokedTokensRecipient;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event VestingScheduleCreated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        address indexed token,
        uint256 totalAmount,
        VestingType vestingType,
        string category
    );

    event TokensReleased(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount
    );

    event VestingRevoked(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 unreleasedAmount
    );

    event MilestoneCompleted(
        uint256 indexed scheduleId,
        uint256 milestoneIndex,
        string description
    );

    event BeneficiaryChanged(
        uint256 indexed scheduleId,
        address indexed oldBeneficiary,
        address indexed newBeneficiary
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(address _revokedTokensRecipient) {
        require(_revokedTokensRecipient != address(0), "Invalid recipient");
        revokedTokensRecipient = _revokedTokensRecipient;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VESTING_MANAGER_ROLE, msg.sender);
        _grantRole(MILESTONE_MANAGER_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VESTING SCHEDULE CREATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a linear vesting schedule
     */
    function createLinearVesting(
        address beneficiary,
        address token,
        uint256 totalAmount,
        uint256 startTime,
        uint256 vestingDuration,
        bool revocable,
        string calldata category
    ) external onlyRole(VESTING_MANAGER_ROLE) returns (uint256) {
        return _createSchedule(
            beneficiary,
            token,
            totalAmount,
            startTime,
            0, // no cliff
            vestingDuration,
            VestingType.LINEAR,
            revocable,
            category
        );
    }

    /**
     * @notice Create a cliff + linear vesting schedule
     */
    function createCliffVesting(
        address beneficiary,
        address token,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable,
        string calldata category
    ) external onlyRole(VESTING_MANAGER_ROLE) returns (uint256) {
        require(cliffDuration < vestingDuration, "Cliff must be < vesting");
        
        return _createSchedule(
            beneficiary,
            token,
            totalAmount,
            startTime,
            cliffDuration,
            vestingDuration,
            VestingType.CLIFF_LINEAR,
            revocable,
            category
        );
    }

    /**
     * @notice Create a milestone-based vesting schedule
     */
    function createMilestoneVesting(
        address beneficiary,
        address token,
        uint256 totalAmount,
        uint256 startTime,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestonePercents,
        bool revocable,
        string calldata category
    ) external onlyRole(VESTING_MANAGER_ROLE) returns (uint256) {
        require(
            milestoneDescriptions.length == milestonePercents.length,
            "Array length mismatch"
        );
        require(milestoneDescriptions.length > 0, "Need milestones");
        require(milestoneDescriptions.length <= 20, "Too many milestones");

        // Verify percents sum to 100%
        uint256 totalPercent;
        for (uint256 i = 0; i < milestonePercents.length; i++) {
            totalPercent += milestonePercents[i];
        }
        require(totalPercent == BPS_DENOMINATOR, "Percents must sum to 100%");

        uint256 scheduleId = _createSchedule(
            beneficiary,
            token,
            totalAmount,
            startTime,
            0,
            0, // No duration for milestone vesting
            VestingType.MILESTONE,
            revocable,
            category
        );

        // Create milestones
        for (uint256 i = 0; i < milestoneDescriptions.length; i++) {
            scheduleMilestones[scheduleId].push(Milestone({
                description: milestoneDescriptions[i],
                releasePercent: milestonePercents[i],
                completed: false,
                completedTime: 0
            }));
        }

        return scheduleId;
    }

    /**
     * @notice Create instant cliff vesting (all tokens released after cliff)
     */
    function createInstantCliffVesting(
        address beneficiary,
        address token,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        bool revocable,
        string calldata category
    ) external onlyRole(VESTING_MANAGER_ROLE) returns (uint256) {
        return _createSchedule(
            beneficiary,
            token,
            totalAmount,
            startTime,
            cliffDuration,
            cliffDuration, // Duration equals cliff
            VestingType.INSTANT_CLIFF,
            revocable,
            category
        );
    }

    /**
     * @notice Batch create vesting schedules
     */
    function batchCreateLinearVesting(
        address[] calldata beneficiaries,
        address token,
        uint256[] calldata amounts,
        uint256 startTime,
        uint256 vestingDuration,
        bool revocable,
        string calldata category
    ) external onlyRole(VESTING_MANAGER_ROLE) returns (uint256[] memory) {
        require(beneficiaries.length == amounts.length, "Array mismatch");

        uint256[] memory scheduleIds = new uint256[](beneficiaries.length);

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            scheduleIds[i] = _createSchedule(
                beneficiaries[i],
                token,
                amounts[i],
                startTime,
                0,
                vestingDuration,
                VestingType.LINEAR,
                revocable,
                category
            );
        }

        return scheduleIds;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOKEN RELEASE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Release vested tokens for a schedule
     */
    function release(uint256 scheduleId) external nonReentrant {
        VestingSchedule storage schedule = schedules[scheduleId];
        
        require(schedule.beneficiary != address(0), "Schedule not found");
        require(!schedule.revoked, "Schedule revoked");
        require(
            msg.sender == schedule.beneficiary || hasRole(VESTING_MANAGER_ROLE, msg.sender),
            "Not authorized"
        );

        uint256 releasable = _computeReleasableAmount(scheduleId);
        require(releasable > 0, "Nothing to release");

        schedule.releasedAmount += releasable;
        totalLockedTokens[schedule.token] -= releasable;

        IERC20(schedule.token).safeTransfer(schedule.beneficiary, releasable);

        emit TokensReleased(scheduleId, schedule.beneficiary, releasable);
    }

    /**
     * @notice Release tokens for all of sender's schedules
     */
    function releaseAll() external nonReentrant {
        uint256[] storage userSchedules = beneficiarySchedules[msg.sender];
        
        for (uint256 i = 0; i < userSchedules.length; i++) {
            uint256 scheduleId = userSchedules[i];
            VestingSchedule storage schedule = schedules[scheduleId];
            
            if (schedule.revoked) continue;

            uint256 releasable = _computeReleasableAmount(scheduleId);
            if (releasable > 0) {
                schedule.releasedAmount += releasable;
                totalLockedTokens[schedule.token] -= releasable;
                
                IERC20(schedule.token).safeTransfer(msg.sender, releasable);
                
                emit TokensReleased(scheduleId, msg.sender, releasable);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MILESTONE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Complete a milestone (releases associated tokens)
     */
    function completeMilestone(
        uint256 scheduleId,
        uint256 milestoneIndex
    ) external onlyRole(MILESTONE_MANAGER_ROLE) {
        VestingSchedule storage schedule = schedules[scheduleId];
        require(schedule.vestingType == VestingType.MILESTONE, "Not milestone vesting");
        require(!schedule.revoked, "Schedule revoked");

        Milestone[] storage milestones = scheduleMilestones[scheduleId];
        require(milestoneIndex < milestones.length, "Invalid index");
        require(!milestones[milestoneIndex].completed, "Already completed");

        milestones[milestoneIndex].completed = true;
        milestones[milestoneIndex].completedTime = block.timestamp;

        emit MilestoneCompleted(
            scheduleId,
            milestoneIndex,
            milestones[milestoneIndex].description
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REVOCATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Revoke a vesting schedule
     */
    function revoke(uint256 scheduleId) external onlyRole(VESTING_MANAGER_ROLE) {
        VestingSchedule storage schedule = schedules[scheduleId];
        
        require(schedule.beneficiary != address(0), "Schedule not found");
        require(schedule.revocable, "Not revocable");
        require(!schedule.revoked, "Already revoked");

        // Release any vested but unreleased tokens first
        uint256 releasable = _computeReleasableAmount(scheduleId);
        if (releasable > 0) {
            schedule.releasedAmount += releasable;
            IERC20(schedule.token).safeTransfer(schedule.beneficiary, releasable);
            emit TokensReleased(scheduleId, schedule.beneficiary, releasable);
        }

        // Calculate unreleased amount
        uint256 unreleased = schedule.totalAmount - schedule.releasedAmount;

        schedule.revoked = true;
        schedule.revokedTime = block.timestamp;

        if (unreleased > 0) {
            totalLockedTokens[schedule.token] -= unreleased;
            IERC20(schedule.token).safeTransfer(revokedTokensRecipient, unreleased);
        }

        emit VestingRevoked(scheduleId, schedule.beneficiary, unreleased);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BENEFICIARY MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Transfer beneficiary rights to new address
     */
    function transferBeneficiary(
        uint256 scheduleId,
        address newBeneficiary
    ) external {
        VestingSchedule storage schedule = schedules[scheduleId];
        
        require(msg.sender == schedule.beneficiary, "Not beneficiary");
        require(newBeneficiary != address(0), "Invalid address");
        require(!schedule.revoked, "Schedule revoked");

        address oldBeneficiary = schedule.beneficiary;

        // Update beneficiary
        schedule.beneficiary = newBeneficiary;

        // Update beneficiary schedules mapping
        _removeScheduleFromBeneficiary(oldBeneficiary, scheduleId);
        beneficiarySchedules[newBeneficiary].push(scheduleId);

        emit BeneficiaryChanged(scheduleId, oldBeneficiary, newBeneficiary);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get releasable amount for a schedule
     */
    function getReleasableAmount(uint256 scheduleId) external view returns (uint256) {
        return _computeReleasableAmount(scheduleId);
    }

    /**
     * @notice Get vested amount for a schedule
     */
    function getVestedAmount(uint256 scheduleId) external view returns (uint256) {
        return _computeVestedAmount(scheduleId);
    }

    /**
     * @notice Get all schedules for a beneficiary
     */
    function getBeneficiarySchedules(
        address beneficiary
    ) external view returns (uint256[] memory) {
        return beneficiarySchedules[beneficiary];
    }

    /**
     * @notice Get schedule details
     */
    function getSchedule(uint256 scheduleId) external view returns (VestingSchedule memory) {
        return schedules[scheduleId];
    }

    /**
     * @notice Get milestones for a schedule
     */
    function getMilestones(uint256 scheduleId) external view returns (Milestone[] memory) {
        return scheduleMilestones[scheduleId];
    }

    /**
     * @notice Get total releasable for beneficiary across all schedules
     */
    function getTotalReleasable(address beneficiary) external view returns (uint256 total) {
        uint256[] storage userSchedules = beneficiarySchedules[beneficiary];
        
        for (uint256 i = 0; i < userSchedules.length; i++) {
            if (!schedules[userSchedules[i]].revoked) {
                total += _computeReleasableAmount(userSchedules[i]);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function setRevokedTokensRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRecipient != address(0), "Invalid address");
        revokedTokensRecipient = newRecipient;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function _createSchedule(
        address beneficiary,
        address token,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 vestingDuration,
        VestingType vestingType,
        bool revocable,
        string calldata category
    ) internal returns (uint256) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(token != address(0), "Invalid token");
        require(totalAmount > 0, "Invalid amount");
        require(startTime >= block.timestamp, "Start in past");
        require(
            beneficiarySchedules[beneficiary].length < MAX_SCHEDULES_PER_BENEFICIARY,
            "Too many schedules"
        );

        // Transfer tokens to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        uint256 scheduleId = nextScheduleId++;

        schedules[scheduleId] = VestingSchedule({
            scheduleId: scheduleId,
            beneficiary: beneficiary,
            token: token,
            totalAmount: totalAmount,
            releasedAmount: 0,
            startTime: startTime,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            vestingType: vestingType,
            revocable: revocable,
            revoked: false,
            revokedTime: 0,
            category: category
        });

        beneficiarySchedules[beneficiary].push(scheduleId);
        totalLockedTokens[token] += totalAmount;

        emit VestingScheduleCreated(
            scheduleId,
            beneficiary,
            token,
            totalAmount,
            vestingType,
            category
        );

        return scheduleId;
    }

    function _computeReleasableAmount(uint256 scheduleId) internal view returns (uint256) {
        VestingSchedule storage schedule = schedules[scheduleId];
        
        if (schedule.revoked) {
            return 0;
        }

        uint256 vested = _computeVestedAmount(scheduleId);
        return vested - schedule.releasedAmount;
    }

    function _computeVestedAmount(uint256 scheduleId) internal view returns (uint256) {
        VestingSchedule storage schedule = schedules[scheduleId];

        if (block.timestamp < schedule.startTime) {
            return 0;
        }

        if (schedule.vestingType == VestingType.MILESTONE) {
            return _computeMilestoneVested(scheduleId);
        }

        uint256 elapsed = block.timestamp - schedule.startTime;

        // Check cliff
        if (elapsed < schedule.cliffDuration) {
            return 0;
        }

        if (schedule.vestingType == VestingType.INSTANT_CLIFF) {
            // All tokens vest after cliff
            if (elapsed >= schedule.cliffDuration) {
                return schedule.totalAmount;
            }
            return 0;
        }

        // Linear vesting
        if (elapsed >= schedule.vestingDuration) {
            return schedule.totalAmount;
        }

        return (schedule.totalAmount * elapsed) / schedule.vestingDuration;
    }

    function _computeMilestoneVested(uint256 scheduleId) internal view returns (uint256) {
        VestingSchedule storage schedule = schedules[scheduleId];
        Milestone[] storage milestones = scheduleMilestones[scheduleId];

        uint256 vestedPercent;
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestones[i].completed) {
                vestedPercent += milestones[i].releasePercent;
            }
        }

        return (schedule.totalAmount * vestedPercent) / BPS_DENOMINATOR;
    }

    function _removeScheduleFromBeneficiary(
        address beneficiary,
        uint256 scheduleId
    ) internal {
        uint256[] storage userSchedules = beneficiarySchedules[beneficiary];
        
        for (uint256 i = 0; i < userSchedules.length; i++) {
            if (userSchedules[i] == scheduleId) {
                userSchedules[i] = userSchedules[userSchedules.length - 1];
                userSchedules.pop();
                break;
            }
        }
    }
}
