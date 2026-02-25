// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/GPUMarketplace.sol";
import "../script/Deploy.s.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract GPUMarketplaceTest is Test {
    GPUMarketplace public marketplace;
    MockERC20 public token;

    address public admin = address(1);
    address public treasury = address(2);
    address public provider1 = address(3);
    address public provider2 = address(4);
    address public requester = address(5);

    uint256 constant MIN_STAKE_CONSUMER = 100e18;
    uint256 constant MIN_STAKE_PROSUMER = 500e18;

    function setUp() public {
        // Deploy mock token
        token = new MockERC20("X3 Token", "X3");

        // Deploy marketplace
        GPUMarketplace impl = new GPUMarketplace();
        bytes memory initData = abi.encodeWithSelector(
            GPUMarketplace.initialize.selector,
            admin,
            address(token),
            treasury,
            250 // 2.5% fee
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        marketplace = GPUMarketplace(address(proxy));

        // Mint tokens
        token.mint(provider1, 10000e18);
        token.mint(provider2, 10000e18);
        token.mint(requester, 10000e18);

        // Approve marketplace
        vm.prank(provider1);
        token.approve(address(marketplace), type(uint256).max);
        vm.prank(provider2);
        token.approve(address(marketplace), type(uint256).max);
        vm.prank(requester);
        token.approve(address(marketplace), type(uint256).max);
    }

    function testRegisterProvider() public {
        vm.prank(provider1);
        marketplace.registerProvider(
            "https://api.provider1.io",
            keccak256("US-WEST"),
            10e18 // hourly rate
        );

        (
            GPUMarketplace.ProviderStatus status,
            uint256 totalGPUs,
            uint256 availableGPUs,
            uint256 hourlyRate,
            uint256 reputation,
            uint256 jobsCompleted
        ) = marketplace.getProvider(provider1);

        assertEq(
            uint256(status),
            uint256(GPUMarketplace.ProviderStatus.INACTIVE)
        );
        assertEq(totalGPUs, 0);
        assertEq(hourlyRate, 10e18);
        assertEq(reputation, 500);
    }

    function testAddGPU() public {
        _setupProvider(provider1);

        // Add stake
        vm.prank(provider1);
        marketplace.addStake(MIN_STAKE_CONSUMER);

        // Add GPU
        vm.prank(provider1);
        marketplace.addGPU(
            "RTX 4090",
            24, // 24GB VRAM
            16384, // compute units
            GPUMarketplace.GPUTier.CONSUMER,
            true, // tensor cores
            100000 // benchmark score
        );

        (, uint256 totalGPUs, uint256 availableGPUs, , , ) = marketplace
            .getProvider(provider1);

        assertEq(totalGPUs, 1);
        assertEq(availableGPUs, 1);

        // Verify GPU specs
        GPUMarketplace.GPUSpec[] memory gpus = marketplace.getProviderGPUs(
            provider1
        );
        assertEq(gpus.length, 1);
        assertEq(gpus[0].vramGB, 24);
        assertTrue(gpus[0].tensorCores);
    }

    function testActivateProvider() public {
        _setupProviderWithGPU(provider1, GPUMarketplace.GPUTier.CONSUMER);

        vm.prank(provider1);
        marketplace.activate();

        (GPUMarketplace.ProviderStatus status, , , , , ) = marketplace
            .getProvider(provider1);
        assertEq(
            uint256(status),
            uint256(GPUMarketplace.ProviderStatus.ACTIVE)
        );
    }

    function testCreateJob() public {
        vm.prank(requester);
        uint256 jobId = marketplace.createJob(
            GPUMarketplace.JobType.INFERENCE,
            GPUMarketplace.GPUTier.CONSUMER,
            1, // required GPUs
            16, // required VRAM
            20e18, // max hourly rate
            3600, // 1 hour max duration
            abi.encode("Run inference model")
        );

        assertEq(jobId, 1);

        GPUMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(job.requester, requester);
        assertEq(
            uint256(job.jobType),
            uint256(GPUMarketplace.JobType.INFERENCE)
        );
        assertEq(
            uint256(job.status),
            uint256(GPUMarketplace.JobStatus.CREATED)
        );
    }

    function testPlaceBid() public {
        _setupProviderWithGPU(provider1, GPUMarketplace.GPUTier.CONSUMER);

        vm.prank(provider1);
        marketplace.activate();

        // Create job
        vm.prank(requester);
        uint256 jobId = marketplace.createJob(
            GPUMarketplace.JobType.INFERENCE,
            GPUMarketplace.GPUTier.CONSUMER,
            1,
            16,
            20e18,
            3600,
            abi.encode("Test job")
        );

        // Send heartbeat
        vm.prank(provider1);
        marketplace.heartbeat();

        // Place bid
        vm.prank(provider1);
        marketplace.placeBid(jobId, 15e18, 3000); // 15 tokens/hour, estimated 50 min

        GPUMarketplace.Bid[] memory bids = marketplace.getJobBids(jobId);
        assertEq(bids.length, 1);
        assertEq(bids[0].provider, provider1);
        assertEq(bids[0].hourlyRate, 15e18);
    }

    function testAcceptBid() public {
        _setupProviderWithGPU(provider1, GPUMarketplace.GPUTier.CONSUMER);

        vm.prank(provider1);
        marketplace.activate();

        // Create job
        vm.prank(requester);
        uint256 jobId = marketplace.createJob(
            GPUMarketplace.JobType.INFERENCE,
            GPUMarketplace.GPUTier.CONSUMER,
            1,
            16,
            20e18,
            3600,
            abi.encode("Test job")
        );

        // Place bid
        vm.prank(provider1);
        marketplace.heartbeat();
        vm.prank(provider1);
        marketplace.placeBid(jobId, 15e18, 3000);

        // Accept bid
        vm.prank(requester);
        marketplace.acceptBid(jobId, 0);

        GPUMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(job.provider, provider1);
        assertEq(
            uint256(job.status),
            uint256(GPUMarketplace.JobStatus.MATCHED)
        );
    }

    function testCompleteJob() public {
        _setupProviderWithGPU(provider1, GPUMarketplace.GPUTier.CONSUMER);

        vm.prank(provider1);
        marketplace.activate();

        // Create job
        vm.prank(requester);
        uint256 jobId = marketplace.createJob(
            GPUMarketplace.JobType.INFERENCE,
            GPUMarketplace.GPUTier.CONSUMER,
            1,
            16,
            20e18,
            3600,
            abi.encode("Test job")
        );

        // Place and accept bid
        vm.prank(provider1);
        marketplace.heartbeat();
        vm.prank(provider1);
        marketplace.placeBid(jobId, 10e18, 3600);
        vm.prank(requester);
        marketplace.acceptBid(jobId, 0);

        // Start job
        vm.prank(provider1);
        marketplace.startJob(jobId);

        // Fast forward 30 minutes
        vm.warp(block.timestamp + 1800);

        // Complete job
        uint256 providerBalanceBefore = token.balanceOf(provider1);

        vm.prank(provider1);
        marketplace.completeJob(jobId, keccak256("result"));

        GPUMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(
            uint256(job.status),
            uint256(GPUMarketplace.JobStatus.COMPLETED)
        );

        // Provider should have received payment
        uint256 providerBalanceAfter = token.balanceOf(provider1);
        assertTrue(providerBalanceAfter > providerBalanceBefore);
    }

    function testFindProviders() public {
        // Setup multiple providers
        _setupProviderWithGPU(provider1, GPUMarketplace.GPUTier.CONSUMER);
        _setupProviderWithGPU(provider2, GPUMarketplace.GPUTier.PROSUMER);

        vm.prank(provider1);
        marketplace.activate();
        vm.prank(provider2);
        marketplace.activate();

        // Find consumer tier providers with rate <= 20
        address[] memory found = marketplace.findProviders(
            GPUMarketplace.GPUTier.CONSUMER,
            1,
            20e18,
            10
        );

        assertEq(found.length, 2); // Both qualify
    }

    function testCancelJob() public {
        vm.prank(requester);
        uint256 jobId = marketplace.createJob(
            GPUMarketplace.JobType.INFERENCE,
            GPUMarketplace.GPUTier.CONSUMER,
            1,
            16,
            20e18,
            3600,
            abi.encode("Test job")
        );

        uint256 balanceBefore = token.balanceOf(requester);

        vm.prank(requester);
        marketplace.cancelJob(jobId);

        GPUMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(
            uint256(job.status),
            uint256(GPUMarketplace.JobStatus.CANCELLED)
        );

        // Should get 99% refund (1% cancellation fee)
        uint256 balanceAfter = token.balanceOf(requester);
        assertTrue(balanceAfter > balanceBefore);
    }

    function testMarketMetrics() public {
        GPUMarketplace.MarketMetrics memory metrics = marketplace
            .getMarketMetrics();
        assertEq(metrics.totalProviders, 0);
        assertEq(metrics.totalJobs, 0);

        _setupProviderWithGPU(provider1, GPUMarketplace.GPUTier.CONSUMER);
        vm.prank(provider1);
        marketplace.activate();

        metrics = marketplace.getMarketMetrics();
        assertEq(metrics.totalProviders, 1);
        assertEq(metrics.activeProviders, 1);
        assertEq(metrics.totalGPUs, 1);
    }

    // ============ Helper Functions ============

    function _setupProvider(address provider) internal {
        vm.prank(provider);
        marketplace.registerProvider(
            "https://api.test.io",
            keccak256("US-WEST"),
            10e18
        );
    }

    function _setupProviderWithGPU(
        address provider,
        GPUMarketplace.GPUTier tier
    ) internal {
        _setupProvider(provider);

        uint256 stake = tier == GPUMarketplace.GPUTier.CONSUMER
            ? MIN_STAKE_CONSUMER
            : MIN_STAKE_PROSUMER;

        vm.prank(provider);
        marketplace.addStake(stake);

        vm.prank(provider);
        marketplace.addGPU(
            tier == GPUMarketplace.GPUTier.CONSUMER ? "RTX 4090" : "A6000",
            tier == GPUMarketplace.GPUTier.CONSUMER ? 24 : 48,
            tier == GPUMarketplace.GPUTier.CONSUMER ? 16384 : 32768,
            tier,
            true,
            100000
        );
    }
}
