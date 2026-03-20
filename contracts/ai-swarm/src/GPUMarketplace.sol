// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GPUMarketplace
 * @notice On-chain marketplace for GPU compute resources
 * @dev Matches GPU providers with AI agents needing compute
 *
 * Provider Types:
 * - Single GPU (gaming rigs)
 * - Multi-GPU cluster
 * - Data center class
 *
 * Resource Tiers:
 * - CONSUMER: RTX 30xx/40xx class
 * - PROSUMER: A4000, RTX A6000
 * - DATACENTER: A100, H100
 */
contract GPUMarketplace is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant BPS_PRECISION = 10000;
    uint256 public constant HOUR = 3600;
    uint256 public constant DAY = 86400;

    // ============ Enums ============

    enum GPUTier {
        CONSUMER,
        PROSUMER,
        DATACENTER
    }

    enum JobType {
        INFERENCE,
        TRAINING,
        FINE_TUNING,
        RENDERING,
        GENERAL
    }

    enum ProviderStatus {
        INACTIVE,
        ACTIVE,
        BUSY,
        MAINTENANCE,
        BANNED
    }

    enum JobStatus {
        CREATED,
        MATCHED,
        RUNNING,
        COMPLETED,
        FAILED,
        CANCELLED,
        DISPUTED
    }

    // ============ Structs ============

    struct GPUSpec {
        string model;
        uint256 vramGB;
        uint256 computeUnits;
        GPUTier tier;
        bool tensorCores;
        uint256 benchmarkScore;
    }

    struct Provider {
        address owner;
        ProviderStatus status;
        GPUSpec[] gpus;
        uint256 totalGPUs;
        uint256 availableGPUs;
        uint256 stake;
        uint256 hourlyRate;
        uint256 reputation;
        uint256 jobsCompleted;
        uint256 jobsFailed;
        uint256 totalEarnings;
        uint256 registeredAt;
        uint256 lastHeartbeat;
        string endpoint;
        bytes32 regionHash; // Geographic region for latency
    }

    struct Job {
        uint256 jobId;
        address requester;
        address provider;
        JobType jobType;
        JobStatus status;
        GPUTier minTier;
        uint256 requiredGPUs;
        uint256 requiredVRAM;
        uint256 maxHourlyRate;
        uint256 maxDuration;
        uint256 startTime;
        uint256 endTime;
        uint256 totalCost;
        uint256 escrowAmount;
        bytes jobSpec;
        bytes32 resultHash;
    }

    struct Bid {
        address provider;
        uint256 hourlyRate;
        uint256 estimatedDuration;
        uint256 timestamp;
        bool accepted;
    }

    struct MarketMetrics {
        uint256 totalProviders;
        uint256 activeProviders;
        uint256 totalGPUs;
        uint256 availableGPUs;
        uint256 totalJobs;
        uint256 completedJobs;
        uint256 totalVolume;
        uint256 averageHourlyRate;
    }

    // ============ State Variables ============

    // Providers
    mapping(address => Provider) internal providers;
    address[] public providerList;
    mapping(GPUTier => address[]) public providersByTier;

    // Jobs
    mapping(uint256 => Job) internal jobs;
    uint256 public jobCount;
    mapping(uint256 => Bid[]) internal jobBids;

    // Escrow
    mapping(uint256 => uint256) public jobEscrow;

    // Payment token
    IERC20 public paymentToken;

    // Platform fee
    uint256 public platformFee; // In BPS

    // Treasury
    address public treasury;

    // Metrics
    MarketMetrics public metrics;

    // Min stake by tier
    mapping(GPUTier => uint256) public minStakeByTier;

    // Heartbeat timeout
    uint256 public heartbeatTimeout;

    // ============ Events ============

    event ProviderRegistered(
        address indexed provider,
        uint256 totalGPUs,
        GPUTier highestTier
    );

    event ProviderUpdated(address indexed provider, ProviderStatus status);

    event GPUAdded(address indexed provider, string model, GPUTier tier);

    event JobCreated(
        uint256 indexed jobId,
        address indexed requester,
        JobType jobType,
        uint256 escrowAmount
    );

    event JobBidPlaced(
        uint256 indexed jobId,
        address indexed provider,
        uint256 hourlyRate
    );

    event JobMatched(uint256 indexed jobId, address indexed provider);

    event JobCompleted(
        uint256 indexed jobId,
        address indexed provider,
        uint256 duration,
        uint256 payment
    );

    event JobFailed(uint256 indexed jobId, string reason);

    event PaymentReleased(
        uint256 indexed jobId,
        address indexed provider,
        uint256 amount
    );

    event EscrowRefunded(
        uint256 indexed jobId,
        address indexed requester,
        uint256 amount
    );

    // ============ Errors ============

    error ProviderNotRegistered();
    error ProviderNotActive();
    error InsufficientStake();
    error JobNotFound();
    error InvalidJobStatus();
    error NotJobProvider();
    error NotJobRequester();
    error InsufficientEscrow();
    error HeartbeatExpired();

    // ============ Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _paymentToken,
        address _treasury,
        uint256 _platformFee
    ) external initializer {
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
        platformFee = _platformFee;

        // Set minimum stakes
        minStakeByTier[GPUTier.CONSUMER] = 100e18;
        minStakeByTier[GPUTier.PROSUMER] = 500e18;
        minStakeByTier[GPUTier.DATACENTER] = 2000e18;

        heartbeatTimeout = 5 minutes;
    }

    // ============ Provider Management ============

    /**
     * @notice Register as GPU provider
     */
    function registerProvider(
        string calldata endpoint,
        bytes32 regionHash,
        uint256 hourlyRate
    ) external nonReentrant {
        require(
            providers[msg.sender].owner == address(0),
            "Already registered"
        );

        providers[msg.sender] = Provider({
            owner: msg.sender,
            status: ProviderStatus.INACTIVE,
            gpus: new GPUSpec[](0),
            totalGPUs: 0,
            availableGPUs: 0,
            stake: 0,
            hourlyRate: hourlyRate,
            reputation: 500,
            jobsCompleted: 0,
            jobsFailed: 0,
            totalEarnings: 0,
            registeredAt: block.timestamp,
            lastHeartbeat: block.timestamp,
            endpoint: endpoint,
            regionHash: regionHash
        });

        providerList.push(msg.sender);
        metrics.totalProviders++;

        emit ProviderRegistered(msg.sender, 0, GPUTier.CONSUMER);
    }

    /**
     * @notice Add GPU to provider inventory
     */
    function addGPU(
        string calldata model,
        uint256 vramGB,
        uint256 computeUnits,
        GPUTier tier,
        bool tensorCores,
        uint256 benchmarkScore
    ) external nonReentrant {
        Provider storage provider = providers[msg.sender];
        if (provider.owner == address(0)) revert ProviderNotRegistered();

        // Check stake requirement
        uint256 requiredStake = minStakeByTier[tier] * (provider.totalGPUs + 1);
        if (provider.stake < requiredStake) revert InsufficientStake();

        provider.gpus.push(
            GPUSpec({
                model: model,
                vramGB: vramGB,
                computeUnits: computeUnits,
                tier: tier,
                tensorCores: tensorCores,
                benchmarkScore: benchmarkScore
            })
        );

        provider.totalGPUs++;
        provider.availableGPUs++;
        metrics.totalGPUs++;
        metrics.availableGPUs++;

        // Update tier index
        providersByTier[tier].push(msg.sender);

        emit GPUAdded(msg.sender, model, tier);
    }

    /**
     * @notice Add stake
     */
    function addStake(uint256 amount) external nonReentrant {
        Provider storage provider = providers[msg.sender];
        if (provider.owner == address(0)) revert ProviderNotRegistered();

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        provider.stake += amount;
    }

    /**
     * @notice Activate provider
     */
    function activate() external {
        Provider storage provider = providers[msg.sender];
        if (provider.owner == address(0)) revert ProviderNotRegistered();

        uint256 requiredStake = _getRequiredStake(provider);
        if (provider.stake < requiredStake) revert InsufficientStake();

        provider.status = ProviderStatus.ACTIVE;
        provider.lastHeartbeat = block.timestamp;
        metrics.activeProviders++;

        emit ProviderUpdated(msg.sender, ProviderStatus.ACTIVE);
    }

    /**
     * @notice Send heartbeat
     */
    function heartbeat() external {
        Provider storage provider = providers[msg.sender];
        if (provider.owner == address(0)) revert ProviderNotRegistered();

        provider.lastHeartbeat = block.timestamp;
    }

    /**
     * @notice Update hourly rate
     */
    function updateHourlyRate(uint256 newRate) external {
        Provider storage provider = providers[msg.sender];
        if (provider.owner == address(0)) revert ProviderNotRegistered();

        provider.hourlyRate = newRate;
    }

    // ============ Job Management ============

    /**
     * @notice Create a compute job
     */
    function createJob(
        JobType jobType,
        GPUTier minTier,
        uint256 requiredGPUs,
        uint256 requiredVRAM,
        uint256 maxHourlyRate,
        uint256 maxDuration,
        bytes calldata jobSpec
    ) external nonReentrant returns (uint256 jobId) {
        // Calculate max escrow
        uint256 maxCost = maxHourlyRate * requiredGPUs * (maxDuration / HOUR);
        uint256 escrowAmount = maxCost +
            ((maxCost * platformFee) / BPS_PRECISION);

        paymentToken.safeTransferFrom(msg.sender, address(this), escrowAmount);

        jobId = ++jobCount;

        jobs[jobId] = Job({
            jobId: jobId,
            requester: msg.sender,
            provider: address(0),
            jobType: jobType,
            status: JobStatus.CREATED,
            minTier: minTier,
            requiredGPUs: requiredGPUs,
            requiredVRAM: requiredVRAM,
            maxHourlyRate: maxHourlyRate,
            maxDuration: maxDuration,
            startTime: 0,
            endTime: 0,
            totalCost: 0,
            escrowAmount: escrowAmount,
            jobSpec: jobSpec,
            resultHash: bytes32(0)
        });

        jobEscrow[jobId] = escrowAmount;
        metrics.totalJobs++;

        emit JobCreated(jobId, msg.sender, jobType, escrowAmount);
    }

    /**
     * @notice Place bid on job
     */
    function placeBid(
        uint256 jobId,
        uint256 hourlyRate,
        uint256 estimatedDuration
    ) external {
        Job storage job = jobs[jobId];
        if (job.jobId == 0) revert JobNotFound();
        if (job.status != JobStatus.CREATED) revert InvalidJobStatus();

        Provider storage provider = providers[msg.sender];
        if (provider.owner == address(0)) revert ProviderNotRegistered();
        if (provider.status != ProviderStatus.ACTIVE)
            revert ProviderNotActive();
        if (block.timestamp - provider.lastHeartbeat > heartbeatTimeout)
            revert HeartbeatExpired();
        if (provider.availableGPUs < job.requiredGPUs)
            revert("Not enough GPUs");

        require(hourlyRate <= job.maxHourlyRate, "Rate too high");

        // Check GPU specs
        require(
            _hasQualifyingGPUs(
                provider,
                job.minTier,
                job.requiredGPUs,
                job.requiredVRAM
            ),
            "GPUs don't qualify"
        );

        jobBids[jobId].push(
            Bid({
                provider: msg.sender,
                hourlyRate: hourlyRate,
                estimatedDuration: estimatedDuration,
                timestamp: block.timestamp,
                accepted: false
            })
        );

        emit JobBidPlaced(jobId, msg.sender, hourlyRate);
    }

    /**
     * @notice Accept bid and start job
     */
    function acceptBid(uint256 jobId, uint256 bidIndex) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.jobId == 0) revert JobNotFound();
        if (job.requester != msg.sender) revert NotJobRequester();
        if (job.status != JobStatus.CREATED) revert InvalidJobStatus();

        Bid storage bid = jobBids[jobId][bidIndex];
        require(!bid.accepted, "Bid already accepted");

        Provider storage provider = providers[bid.provider];
        if (provider.status != ProviderStatus.ACTIVE)
            revert ProviderNotActive();

        // Mark bid accepted
        bid.accepted = true;

        // Update job
        job.provider = bid.provider;
        job.status = JobStatus.MATCHED;
        job.startTime = block.timestamp;

        // Update provider
        provider.availableGPUs -= job.requiredGPUs;
        if (provider.availableGPUs == 0) {
            provider.status = ProviderStatus.BUSY;
        }

        metrics.availableGPUs -= job.requiredGPUs;

        emit JobMatched(jobId, bid.provider);
    }

    /**
     * @notice Provider marks job as started
     */
    function startJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (job.jobId == 0) revert JobNotFound();
        if (job.provider != msg.sender) revert NotJobProvider();
        if (job.status != JobStatus.MATCHED) revert InvalidJobStatus();

        job.status = JobStatus.RUNNING;
        job.startTime = block.timestamp;
    }

    /**
     * @notice Complete job
     */
    function completeJob(
        uint256 jobId,
        bytes32 resultHash
    ) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.jobId == 0) revert JobNotFound();
        if (job.provider != msg.sender) revert NotJobProvider();
        if (job.status != JobStatus.RUNNING) revert InvalidJobStatus();

        Provider storage provider = providers[msg.sender];

        // Calculate actual cost
        uint256 duration = block.timestamp - job.startTime;
        if (duration > job.maxDuration) {
            duration = job.maxDuration;
        }

        Bid storage acceptedBid = _getAcceptedBid(jobId);
        uint256 actualCost = acceptedBid.hourlyRate *
            job.requiredGPUs *
            (duration / HOUR);
        if (actualCost == 0) {
            actualCost = acceptedBid.hourlyRate * job.requiredGPUs; // Minimum 1 hour
        }

        uint256 fee = (actualCost * platformFee) / BPS_PRECISION;
        uint256 providerPayment = actualCost;
        uint256 refund = job.escrowAmount - actualCost - fee;

        // Update job
        job.status = JobStatus.COMPLETED;
        job.endTime = block.timestamp;
        job.totalCost = actualCost;
        job.resultHash = resultHash;

        // Update provider
        provider.jobsCompleted++;
        provider.totalEarnings += providerPayment;
        provider.availableGPUs += job.requiredGPUs;
        if (provider.status == ProviderStatus.BUSY) {
            provider.status = ProviderStatus.ACTIVE;
        }

        // Update reputation
        _updateReputation(provider, true);

        // Release payments
        paymentToken.safeTransfer(msg.sender, providerPayment);
        paymentToken.safeTransfer(treasury, fee);
        if (refund > 0) {
            paymentToken.safeTransfer(job.requester, refund);
        }

        // Clear escrow
        jobEscrow[jobId] = 0;

        // Update metrics
        metrics.completedJobs++;
        metrics.totalVolume += actualCost;
        metrics.availableGPUs += job.requiredGPUs;

        emit JobCompleted(jobId, msg.sender, duration, providerPayment);
        emit PaymentReleased(jobId, msg.sender, providerPayment);
        if (refund > 0) {
            emit EscrowRefunded(jobId, job.requester, refund);
        }
    }

    /**
     * @notice Cancel job (requester only, before matched)
     */
    function cancelJob(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.jobId == 0) revert JobNotFound();
        if (job.requester != msg.sender) revert NotJobRequester();
        if (job.status != JobStatus.CREATED) revert InvalidJobStatus();

        job.status = JobStatus.CANCELLED;

        // Refund escrow minus small cancellation fee
        uint256 cancellationFee = job.escrowAmount / 100; // 1%
        uint256 refund = job.escrowAmount - cancellationFee;

        paymentToken.safeTransfer(msg.sender, refund);
        paymentToken.safeTransfer(treasury, cancellationFee);
        jobEscrow[jobId] = 0;

        emit EscrowRefunded(jobId, msg.sender, refund);
    }

    /**
     * @notice Report job failure
     */
    function reportFailure(
        uint256 jobId,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) {
        Job storage job = jobs[jobId];
        if (job.jobId == 0) revert JobNotFound();
        if (job.status != JobStatus.RUNNING) revert InvalidJobStatus();

        Provider storage provider = providers[job.provider];

        // Update job
        job.status = JobStatus.FAILED;
        job.endTime = block.timestamp;

        // Update provider
        provider.jobsFailed++;
        provider.availableGPUs += job.requiredGPUs;
        _updateReputation(provider, false);

        // Refund requester
        paymentToken.safeTransfer(job.requester, job.escrowAmount);
        jobEscrow[jobId] = 0;

        emit JobFailed(jobId, reason);
        emit EscrowRefunded(jobId, job.requester, job.escrowAmount);
    }

    // ============ View Functions ============

    /**
     * @notice Get provider info
     */
    function getProvider(
        address addr
    )
        external
        view
        returns (
            ProviderStatus status,
            uint256 totalGPUs,
            uint256 availableGPUs,
            uint256 hourlyRate,
            uint256 reputation,
            uint256 jobsCompleted
        )
    {
        Provider storage p = providers[addr];
        return (
            p.status,
            p.totalGPUs,
            p.availableGPUs,
            p.hourlyRate,
            p.reputation,
            p.jobsCompleted
        );
    }

    /**
     * @notice Get provider GPUs
     */
    function getProviderGPUs(
        address addr
    ) external view returns (GPUSpec[] memory) {
        return providers[addr].gpus;
    }

    /**
     * @notice Get job info
     */
    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    /**
     * @notice Get job bids
     */
    function getJobBids(uint256 jobId) external view returns (Bid[] memory) {
        return jobBids[jobId];
    }

    /**
     * @notice Get market metrics
     */
    function getMarketMetrics() external view returns (MarketMetrics memory) {
        return metrics;
    }

    /**
     * @notice Find available providers
     */
    function findProviders(
        GPUTier minTier,
        uint256 requiredGPUs,
        uint256 maxRate,
        uint256 limit
    ) external view returns (address[] memory) {
        address[] memory result = new address[](limit);
        uint256 count = 0;

        for (uint256 i = 0; i < providerList.length && count < limit; i++) {
            Provider storage p = providers[providerList[i]];

            if (
                p.status == ProviderStatus.ACTIVE &&
                p.availableGPUs >= requiredGPUs &&
                p.hourlyRate <= maxRate &&
                _hasQualifyingGPUs(p, minTier, requiredGPUs, 0)
            ) {
                result[count++] = providerList[i];
            }
        }

        assembly {
            mstore(result, count)
        }
        return result;
    }

    // ============ Internal Functions ============

    function _getRequiredStake(
        Provider storage provider
    ) internal view returns (uint256) {
        uint256 maxTier = 0;
        for (uint256 i = 0; i < provider.gpus.length; i++) {
            if (uint256(provider.gpus[i].tier) > maxTier) {
                maxTier = uint256(provider.gpus[i].tier);
            }
        }
        return minStakeByTier[GPUTier(maxTier)] * provider.totalGPUs;
    }

    function _hasQualifyingGPUs(
        Provider storage provider,
        GPUTier minTier,
        uint256 requiredGPUs,
        uint256 minVRAM
    ) internal view returns (bool) {
        uint256 qualifyingCount = 0;

        for (uint256 i = 0; i < provider.gpus.length; i++) {
            GPUSpec storage gpu = provider.gpus[i];
            if (
                uint256(gpu.tier) >= uint256(minTier) && gpu.vramGB >= minVRAM
            ) {
                qualifyingCount++;
                if (qualifyingCount >= requiredGPUs) return true;
            }
        }

        return false;
    }

    function _getAcceptedBid(
        uint256 jobId
    ) internal view returns (Bid storage) {
        Bid[] storage bids = jobBids[jobId];
        for (uint256 i = 0; i < bids.length; i++) {
            if (bids[i].accepted) {
                return bids[i];
            }
        }
        revert("No accepted bid");
    }

    function _updateReputation(
        Provider storage provider,
        bool success
    ) internal {
        if (success) {
            if (provider.reputation < 950) {
                provider.reputation += 5;
            }
        } else {
            if (provider.reputation > 50) {
                provider.reputation -= 50;
            }
        }
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}
}
