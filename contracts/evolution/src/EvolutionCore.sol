// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title EvolutionCore
 * @notice Metrics-driven mutation system for autonomous strategy evolution
 * @dev Enables AI + on-chain feedback loops for strategy optimization
 *
 * Core Concepts:
 * - Metrics: On-chain performance data (APY, drawdown, Sharpe, etc.)
 * - Proposals: Suggested parameter changes from AI or governance
 * - Evolution: Automatic parameter adjustments based on metrics
 * - Kill Switches: Emergency stops based on risk thresholds
 */
contract EvolutionCore is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ============ Constants ============

    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant AI_AGENT_ROLE = keccak256("AI_AGENT_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant BPS_PRECISION = 10000;
    uint256 public constant METRIC_PRECISION = 1e18;
    uint256 public constant MAX_EVOLUTION_RATE = 500; // 5% max change per evolution
    uint256 public constant MIN_PROPOSAL_DELAY = 1 hours;
    uint256 public constant MAX_PROPOSAL_DELAY = 7 days;

    // ============ Enums ============

    enum MetricType {
        APY, // Annual percentage yield
        TVL, // Total value locked
        DRAWDOWN, // Maximum drawdown
        SHARPE_RATIO, // Risk-adjusted return
        VOLATILITY, // Price volatility
        UTILIZATION, // Resource utilization
        GAS_EFFICIENCY, // Gas cost per operation
        SUCCESS_RATE, // Transaction success rate
        SLIPPAGE, // Execution slippage
        IMPERMANENT_LOSS, // LP impermanent loss
        HEALTH_FACTOR, // Lending health
        LIQUIDATION_RISK, // Liquidation probability
        CORRELATION, // Cross-asset correlation
        CUSTOM // User-defined metrics
    }

    enum ProposalStatus {
        PENDING,
        APPROVED,
        REJECTED,
        EXECUTED,
        CANCELLED,
        EXPIRED
    }

    enum EvolutionTrigger {
        MANUAL, // Human-initiated
        AI_RECOMMENDATION, // AI agent suggested
        METRIC_THRESHOLD, // Automatic on metric breach
        SCHEDULED, // Time-based
        GOVERNANCE // DAO vote
    }

    enum RiskAction {
        NONE,
        REDUCE_EXPOSURE,
        PAUSE_STRATEGY,
        EMERGENCY_EXIT,
        REBALANCE
    }

    // ============ Structs ============

    struct Strategy {
        bytes32 strategyId;
        string name;
        address owner;
        address executor;
        bool active;
        bool evolutionEnabled;
        uint256 createdAt;
        uint256 lastEvolved;
        uint256 evolutionCount;
        bytes32[] parameterKeys;
        mapping(bytes32 => StrategyParameter) parameters;
        mapping(MetricType => MetricData) metrics;
        RiskConfig riskConfig;
    }

    struct StrategyParameter {
        bytes32 key;
        string name;
        uint256 value;
        uint256 minValue;
        uint256 maxValue;
        uint256 evolutionRate; // Max % change per evolution
        bool evolvable;
    }

    struct MetricData {
        MetricType metricType;
        uint256 currentValue;
        uint256 targetValue;
        uint256 minThreshold;
        uint256 maxThreshold;
        uint256 weight; // Importance in evolution decisions
        uint256 lastUpdated;
        uint256[] history; // Rolling history
        uint256 historySize;
    }

    struct RiskConfig {
        uint256 maxDrawdown; // Max acceptable drawdown
        uint256 minHealthFactor; // Min health factor
        uint256 maxVolatility; // Max acceptable volatility
        uint256 killSwitchThreshold; // Trigger emergency exit
        bool autoRebalance;
        bool emergencyExitEnabled;
    }

    struct Proposal {
        uint256 proposalId;
        bytes32 strategyId;
        address proposer;
        ProposalStatus status;
        EvolutionTrigger trigger;
        bytes32[] parameterKeys;
        uint256[] newValues;
        string rationale;
        uint256 confidence; // AI confidence score
        uint256 proposedAt;
        uint256 executeAfter;
        uint256 expiresAt;
        uint256 votesFor;
        uint256 votesAgainst;
    }

    struct EvolutionRecord {
        uint256 recordId;
        bytes32 strategyId;
        uint256 proposalId;
        EvolutionTrigger trigger;
        bytes32[] parameterKeys;
        uint256[] oldValues;
        uint256[] newValues;
        uint256 timestamp;
        uint256 metricsBefore; // Encoded metrics snapshot
        uint256 metricsAfter;
    }

    // ============ State Variables ============

    // Strategies
    mapping(bytes32 => Strategy) internal strategies;
    bytes32[] public strategyIds;

    // Proposals
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    // Evolution history
    mapping(bytes32 => EvolutionRecord[]) public evolutionHistory;

    // AI agent registry
    mapping(address => bool) public registeredAgents;
    mapping(address => uint256) public agentReputation;

    // Global settings
    uint256 public minProposalDelay;
    uint256 public maxProposalDelay;
    bool public globalEvolutionEnabled;

    // Metrics oracle
    address public metricsOracle;

    // ============ Events ============

    event StrategyCreated(
        bytes32 indexed strategyId,
        string name,
        address indexed owner
    );

    event StrategyUpdated(
        bytes32 indexed strategyId,
        bool active,
        bool evolutionEnabled
    );

    event MetricUpdated(
        bytes32 indexed strategyId,
        MetricType metricType,
        uint256 oldValue,
        uint256 newValue
    );

    event ProposalCreated(
        uint256 indexed proposalId,
        bytes32 indexed strategyId,
        address indexed proposer,
        EvolutionTrigger trigger
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        bytes32 indexed strategyId
    );

    event ProposalRejected(uint256 indexed proposalId, string reason);

    event EvolutionTriggered(
        bytes32 indexed strategyId,
        EvolutionTrigger trigger,
        uint256 parametersChanged
    );

    event RiskActionTaken(
        bytes32 indexed strategyId,
        RiskAction action,
        string reason
    );

    event AgentRegistered(address indexed agent, uint256 reputation);

    event KillSwitchActivated(
        bytes32 indexed strategyId,
        address indexed activator,
        string reason
    );

    // ============ Errors ============

    error StrategyNotFound();
    error StrategyNotActive();
    error EvolutionDisabled();
    error ProposalNotFound();
    error ProposalNotExecutable();
    error InvalidParameter();
    error ValueOutOfRange();
    error RateLimitExceeded();
    error UnauthorizedAgent();
    error KillSwitchActive();

    // ============ Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _metricsOracle
    ) external initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PROPOSER_ROLE, _admin);
        _grantRole(EXECUTOR_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        metricsOracle = _metricsOracle;
        minProposalDelay = MIN_PROPOSAL_DELAY;
        maxProposalDelay = MAX_PROPOSAL_DELAY;
        globalEvolutionEnabled = true;
    }

    // ============ Strategy Management ============

    /**
     * @notice Create a new strategy
     */
    function createStrategy(
        string calldata name,
        address executor,
        bytes32[] calldata parameterKeys,
        string[] calldata parameterNames,
        uint256[] calldata initialValues,
        uint256[] calldata minValues,
        uint256[] calldata maxValues,
        uint256[] calldata evolutionRates,
        RiskConfig calldata riskConfig
    ) external returns (bytes32 strategyId) {
        require(
            parameterKeys.length == initialValues.length,
            "Length mismatch"
        );
        require(parameterKeys.length == minValues.length, "Length mismatch");
        require(parameterKeys.length == maxValues.length, "Length mismatch");

        strategyId = keccak256(
            abi.encodePacked(name, msg.sender, block.timestamp)
        );

        Strategy storage strategy = strategies[strategyId];
        strategy.strategyId = strategyId;
        strategy.name = name;
        strategy.owner = msg.sender;
        strategy.executor = executor;
        strategy.active = true;
        strategy.evolutionEnabled = true;
        strategy.createdAt = block.timestamp;
        strategy.parameterKeys = parameterKeys;
        strategy.riskConfig = riskConfig;

        for (uint256 i = 0; i < parameterKeys.length; i++) {
            strategy.parameters[parameterKeys[i]] = StrategyParameter({
                key: parameterKeys[i],
                name: parameterNames[i],
                value: initialValues[i],
                minValue: minValues[i],
                maxValue: maxValues[i],
                evolutionRate: evolutionRates[i],
                evolvable: evolutionRates[i] > 0
            });
        }

        strategyIds.push(strategyId);

        emit StrategyCreated(strategyId, name, msg.sender);
    }

    /**
     * @notice Toggle strategy active status
     */
    function setStrategyActive(bytes32 strategyId, bool active) external {
        Strategy storage strategy = strategies[strategyId];
        if (strategy.strategyId == bytes32(0)) revert StrategyNotFound();
        require(
            msg.sender == strategy.owner || hasRole(GUARDIAN_ROLE, msg.sender),
            "Unauthorized"
        );

        strategy.active = active;

        emit StrategyUpdated(strategyId, active, strategy.evolutionEnabled);
    }

    /**
     * @notice Toggle evolution for strategy
     */
    function setEvolutionEnabled(bytes32 strategyId, bool enabled) external {
        Strategy storage strategy = strategies[strategyId];
        if (strategy.strategyId == bytes32(0)) revert StrategyNotFound();
        require(msg.sender == strategy.owner, "Unauthorized");

        strategy.evolutionEnabled = enabled;

        emit StrategyUpdated(strategyId, strategy.active, enabled);
    }

    // ============ Metrics Management ============

    /**
     * @notice Update a metric for a strategy
     */
    function updateMetric(
        bytes32 strategyId,
        MetricType metricType,
        uint256 newValue
    ) external {
        require(
            msg.sender == metricsOracle ||
                hasRole(AI_AGENT_ROLE, msg.sender) ||
                hasRole(EXECUTOR_ROLE, msg.sender),
            "Unauthorized"
        );

        Strategy storage strategy = strategies[strategyId];
        if (strategy.strategyId == bytes32(0)) revert StrategyNotFound();

        MetricData storage metric = strategy.metrics[metricType];
        uint256 oldValue = metric.currentValue;

        metric.currentValue = newValue;
        metric.lastUpdated = block.timestamp;

        // Add to history
        if (
            metric.history.length >= metric.historySize &&
            metric.historySize > 0
        ) {
            // Shift history
            for (uint256 i = 0; i < metric.history.length - 1; i++) {
                metric.history[i] = metric.history[i + 1];
            }
            metric.history[metric.history.length - 1] = newValue;
        } else {
            metric.history.push(newValue);
        }

        emit MetricUpdated(strategyId, metricType, oldValue, newValue);

        // Check for automatic risk actions
        _checkRiskThresholds(strategy, metricType, newValue);
    }

    /**
     * @notice Batch update metrics
     */
    function batchUpdateMetrics(
        bytes32 strategyId,
        MetricType[] calldata metricTypes,
        uint256[] calldata values
    ) external {
        require(metricTypes.length == values.length, "Length mismatch");

        for (uint256 i = 0; i < metricTypes.length; i++) {
            this.updateMetric(strategyId, metricTypes[i], values[i]);
        }
    }

    /**
     * @notice Configure a metric
     */
    function configureMetric(
        bytes32 strategyId,
        MetricType metricType,
        uint256 targetValue,
        uint256 minThreshold,
        uint256 maxThreshold,
        uint256 weight,
        uint256 historySize
    ) external {
        Strategy storage strategy = strategies[strategyId];
        require(msg.sender == strategy.owner, "Unauthorized");

        MetricData storage metric = strategy.metrics[metricType];
        metric.metricType = metricType;
        metric.targetValue = targetValue;
        metric.minThreshold = minThreshold;
        metric.maxThreshold = maxThreshold;
        metric.weight = weight;
        metric.historySize = historySize;
    }

    // ============ Proposal System ============

    /**
     * @notice Create an evolution proposal
     */
    function proposeEvolution(
        bytes32 strategyId,
        bytes32[] calldata parameterKeys,
        uint256[] calldata newValues,
        string calldata rationale,
        uint256 confidence,
        EvolutionTrigger trigger
    ) external onlyRole(PROPOSER_ROLE) returns (uint256 proposalId) {
        Strategy storage strategy = strategies[strategyId];
        if (strategy.strategyId == bytes32(0)) revert StrategyNotFound();
        if (!strategy.active) revert StrategyNotActive();
        if (!strategy.evolutionEnabled) revert EvolutionDisabled();

        require(parameterKeys.length == newValues.length, "Length mismatch");

        // Validate parameters
        for (uint256 i = 0; i < parameterKeys.length; i++) {
            StrategyParameter storage param = strategy.parameters[
                parameterKeys[i]
            ];
            if (!param.evolvable) revert InvalidParameter();
            if (
                newValues[i] < param.minValue || newValues[i] > param.maxValue
            ) {
                revert ValueOutOfRange();
            }

            // Check evolution rate
            uint256 change = newValues[i] > param.value
                ? newValues[i] - param.value
                : param.value - newValues[i];
            uint256 changeRate = (change * BPS_PRECISION) / param.value;
            if (changeRate > param.evolutionRate) revert RateLimitExceeded();
        }

        proposalId = ++proposalCount;

        proposals[proposalId] = Proposal({
            proposalId: proposalId,
            strategyId: strategyId,
            proposer: msg.sender,
            status: ProposalStatus.PENDING,
            trigger: trigger,
            parameterKeys: parameterKeys,
            newValues: newValues,
            rationale: rationale,
            confidence: confidence,
            proposedAt: block.timestamp,
            executeAfter: block.timestamp + minProposalDelay,
            expiresAt: block.timestamp + maxProposalDelay,
            votesFor: 0,
            votesAgainst: 0
        });

        emit ProposalCreated(proposalId, strategyId, msg.sender, trigger);
    }

    /**
     * @notice Execute an approved proposal
     */
    function executeProposal(
        uint256 proposalId
    ) external nonReentrant onlyRole(EXECUTOR_ROLE) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.proposalId == 0) revert ProposalNotFound();
        if (
            proposal.status != ProposalStatus.PENDING &&
            proposal.status != ProposalStatus.APPROVED
        ) {
            revert ProposalNotExecutable();
        }
        if (block.timestamp < proposal.executeAfter)
            revert ProposalNotExecutable();
        if (block.timestamp > proposal.expiresAt) {
            proposal.status = ProposalStatus.EXPIRED;
            revert ProposalNotExecutable();
        }

        Strategy storage strategy = strategies[proposal.strategyId];
        if (!strategy.active) revert StrategyNotActive();

        // Store old values for history
        uint256[] memory oldValues = new uint256[](
            proposal.parameterKeys.length
        );
        for (uint256 i = 0; i < proposal.parameterKeys.length; i++) {
            oldValues[i] = strategy.parameters[proposal.parameterKeys[i]].value;
            strategy.parameters[proposal.parameterKeys[i]].value = proposal
                .newValues[i];
        }

        proposal.status = ProposalStatus.EXECUTED;
        strategy.lastEvolved = block.timestamp;
        strategy.evolutionCount++;

        // Record evolution
        evolutionHistory[proposal.strategyId].push(
            EvolutionRecord({
                recordId: evolutionHistory[proposal.strategyId].length,
                strategyId: proposal.strategyId,
                proposalId: proposalId,
                trigger: proposal.trigger,
                parameterKeys: proposal.parameterKeys,
                oldValues: oldValues,
                newValues: proposal.newValues,
                timestamp: block.timestamp,
                metricsBefore: 0,
                metricsAfter: 0
            })
        );

        emit ProposalExecuted(proposalId, proposal.strategyId);
        emit EvolutionTriggered(
            proposal.strategyId,
            proposal.trigger,
            proposal.parameterKeys.length
        );
    }

    /**
     * @notice Reject a proposal
     */
    function rejectProposal(
        uint256 proposalId,
        string calldata reason
    ) external onlyRole(GUARDIAN_ROLE) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.proposalId == 0) revert ProposalNotFound();

        proposal.status = ProposalStatus.REJECTED;

        emit ProposalRejected(proposalId, reason);
    }

    // ============ AI Agent Integration ============

    /**
     * @notice Register an AI agent
     */
    function registerAgent(
        address agent,
        uint256 initialReputation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(AI_AGENT_ROLE, agent);
        registeredAgents[agent] = true;
        agentReputation[agent] = initialReputation;

        emit AgentRegistered(agent, initialReputation);
    }

    /**
     * @notice AI agent proposes evolution
     */
    function aiProposeEvolution(
        bytes32 strategyId,
        bytes32[] calldata parameterKeys,
        uint256[] calldata newValues,
        string calldata rationale,
        uint256 confidence
    ) external onlyRole(AI_AGENT_ROLE) returns (uint256) {
        if (!registeredAgents[msg.sender]) revert UnauthorizedAgent();

        // Higher reputation = faster execution
        uint256 reputation = agentReputation[msg.sender];
        uint256 delay = minProposalDelay;
        if (reputation > 90) {
            delay = minProposalDelay / 2;
        }

        return
            this.proposeEvolution(
                strategyId,
                parameterKeys,
                newValues,
                rationale,
                confidence,
                EvolutionTrigger.AI_RECOMMENDATION
            );
    }

    /**
     * @notice Update agent reputation based on proposal outcomes
     */
    function updateAgentReputation(
        address agent,
        int256 change
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (change > 0) {
            agentReputation[agent] += uint256(change);
            if (agentReputation[agent] > 100) agentReputation[agent] = 100;
        } else {
            uint256 decrease = uint256(-change);
            if (decrease >= agentReputation[agent]) {
                agentReputation[agent] = 0;
            } else {
                agentReputation[agent] -= decrease;
            }
        }
    }

    // ============ Emergency Functions ============

    /**
     * @notice Activate kill switch for a strategy
     */
    function activateKillSwitch(
        bytes32 strategyId,
        string calldata reason
    ) external onlyRole(GUARDIAN_ROLE) {
        Strategy storage strategy = strategies[strategyId];
        if (strategy.strategyId == bytes32(0)) revert StrategyNotFound();

        strategy.active = false;
        strategy.evolutionEnabled = false;

        emit KillSwitchActivated(strategyId, msg.sender, reason);

        // Call strategy executor emergency exit if configured
        if (
            strategy.riskConfig.emergencyExitEnabled &&
            strategy.executor != address(0)
        ) {
            (bool success, ) = strategy.executor.call(
                abi.encodeWithSignature("emergencyExit(bytes32)", strategyId)
            );
            // Don't revert on failure, just log
            if (success) {
                emit RiskActionTaken(
                    strategyId,
                    RiskAction.EMERGENCY_EXIT,
                    reason
                );
            }
        }
    }

    /**
     * @notice Global pause
     */
    function setGlobalEvolutionEnabled(
        bool enabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        globalEvolutionEnabled = enabled;
    }

    // ============ View Functions ============

    /**
     * @notice Get strategy info
     */
    function getStrategy(
        bytes32 strategyId
    )
        external
        view
        returns (
            string memory name,
            address owner,
            address executor,
            bool active,
            bool evolutionEnabled,
            uint256 createdAt,
            uint256 lastEvolved,
            uint256 evolutionCount,
            bytes32[] memory parameterKeys
        )
    {
        Strategy storage s = strategies[strategyId];
        return (
            s.name,
            s.owner,
            s.executor,
            s.active,
            s.evolutionEnabled,
            s.createdAt,
            s.lastEvolved,
            s.evolutionCount,
            s.parameterKeys
        );
    }

    /**
     * @notice Get parameter value
     */
    function getParameter(
        bytes32 strategyId,
        bytes32 parameterKey
    ) external view returns (StrategyParameter memory) {
        return strategies[strategyId].parameters[parameterKey];
    }

    /**
     * @notice Get all parameters for a strategy
     */
    function getAllParameters(
        bytes32 strategyId
    ) external view returns (bytes32[] memory keys, uint256[] memory values) {
        Strategy storage s = strategies[strategyId];
        keys = s.parameterKeys;
        values = new uint256[](keys.length);

        for (uint256 i = 0; i < keys.length; i++) {
            values[i] = s.parameters[keys[i]].value;
        }
    }

    /**
     * @notice Get metric data
     */
    function getMetric(
        bytes32 strategyId,
        MetricType metricType
    )
        external
        view
        returns (
            uint256 currentValue,
            uint256 targetValue,
            uint256 minThreshold,
            uint256 maxThreshold,
            uint256 lastUpdated
        )
    {
        MetricData storage m = strategies[strategyId].metrics[metricType];
        return (
            m.currentValue,
            m.targetValue,
            m.minThreshold,
            m.maxThreshold,
            m.lastUpdated
        );
    }

    /**
     * @notice Get proposal details
     */
    function getProposal(
        uint256 proposalId
    ) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    /**
     * @notice Get evolution history for a strategy
     */
    function getEvolutionHistory(
        bytes32 strategyId
    ) external view returns (EvolutionRecord[] memory) {
        return evolutionHistory[strategyId];
    }

    /**
     * @notice Get all strategy IDs
     */
    function getAllStrategies() external view returns (bytes32[] memory) {
        return strategyIds;
    }

    // ============ Internal Functions ============

    function _checkRiskThresholds(
        Strategy storage strategy,
        MetricType metricType,
        uint256 value
    ) internal {
        MetricData storage metric = strategy.metrics[metricType];
        RiskConfig storage risk = strategy.riskConfig;

        RiskAction action = RiskAction.NONE;
        string memory reason = "";

        // Check drawdown
        if (metricType == MetricType.DRAWDOWN && value > risk.maxDrawdown) {
            if (value > risk.killSwitchThreshold) {
                action = RiskAction.EMERGENCY_EXIT;
                reason = "Drawdown exceeded kill switch threshold";
            } else {
                action = RiskAction.REDUCE_EXPOSURE;
                reason = "Drawdown exceeded max threshold";
            }
        }

        // Check health factor
        if (
            metricType == MetricType.HEALTH_FACTOR &&
            value < risk.minHealthFactor
        ) {
            action = RiskAction.REBALANCE;
            reason = "Health factor below minimum";
        }

        // Check volatility
        if (metricType == MetricType.VOLATILITY && value > risk.maxVolatility) {
            action = RiskAction.REDUCE_EXPOSURE;
            reason = "Volatility exceeded threshold";
        }

        // Check min/max thresholds
        if (value < metric.minThreshold || value > metric.maxThreshold) {
            if (action == RiskAction.NONE && risk.autoRebalance) {
                action = RiskAction.REBALANCE;
                reason = "Metric out of bounds";
            }
        }

        if (action != RiskAction.NONE) {
            emit RiskActionTaken(strategy.strategyId, action, reason);

            // Execute action if strategy has executor
            if (strategy.executor != address(0)) {
                _executeRiskAction(strategy, action);
            }
        }
    }

    function _executeRiskAction(
        Strategy storage strategy,
        RiskAction action
    ) internal {
        bytes memory callData;

        if (action == RiskAction.EMERGENCY_EXIT) {
            callData = abi.encodeWithSignature(
                "emergencyExit(bytes32)",
                strategy.strategyId
            );
        } else if (action == RiskAction.REDUCE_EXPOSURE) {
            callData = abi.encodeWithSignature(
                "reduceExposure(bytes32,uint256)",
                strategy.strategyId,
                5000
            );
        } else if (action == RiskAction.REBALANCE) {
            callData = abi.encodeWithSignature(
                "rebalance(bytes32)",
                strategy.strategyId
            );
        } else if (action == RiskAction.PAUSE_STRATEGY) {
            strategy.active = false;
            return;
        }

        if (callData.length > 0) {
            (bool success, ) = strategy.executor.call(callData);
            // Don't revert on failure - this is a best-effort action
        }
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}
}
