// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AISwarmCoordinator.sol";
import "../script/Deploy.s.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract AISwarmCoordinatorTest is Test {
    AISwarmCoordinator public coordinator;
    MockERC20 public token;

    address public admin = address(1);
    address public treasury = address(2);
    address public agent1 = address(3);
    address public agent2 = address(4);

    uint256 constant MIN_STAKE = 100e18;

    function setUp() public {
        // Deploy mock token
        token = new MockERC20("Atlas Token", "ATLAS");

        // Deploy coordinator
        AISwarmCoordinator impl = new AISwarmCoordinator();
        bytes memory initData = abi.encodeWithSelector(
            AISwarmCoordinator.initialize.selector,
            admin,
            address(token),
            address(token),
            treasury
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        coordinator = AISwarmCoordinator(address(proxy));

        // Mint tokens to agents
        token.mint(agent1, 1000e18);
        token.mint(agent2, 1000e18);

        // Approve coordinator
        vm.prank(agent1);
        token.approve(address(coordinator), type(uint256).max);
        vm.prank(agent2);
        token.approve(address(coordinator), type(uint256).max);
    }

    function testRegisterAgent() public {
        bytes32[] memory specializations = new bytes32[](2);
        specializations[0] = keccak256("DeFi");
        specializations[1] = keccak256("Arbitrage");

        vm.prank(agent1);
        coordinator.registerAgent(
            AISwarmCoordinator.AgentType.ARBITRAGE,
            "https://api.agent1.io",
            specializations
        );

        AISwarmCoordinator.Agent memory agent = coordinator.getAgent(agent1);
        assertEq(agent.owner, agent1);
        assertTrue(agent.active);
        assertEq(agent.stake, MIN_STAKE);
        assertEq(agent.reputation, 500); // Starting reputation
        assertEq(
            uint256(agent.agentType),
            uint256(AISwarmCoordinator.AgentType.ARBITRAGE)
        );
    }

    function testRegisterAgentInsufficientFunds() public {
        address poorAgent = address(5);
        token.mint(poorAgent, 50e18); // Less than MIN_STAKE

        bytes32[] memory specializations = new bytes32[](0);

        vm.prank(poorAgent);
        token.approve(address(coordinator), type(uint256).max);

        vm.prank(poorAgent);
        vm.expectRevert();
        coordinator.registerAgent(
            AISwarmCoordinator.AgentType.GENERAL,
            "https://api.poor.io",
            specializations
        );
    }

    function testCreateTask() public {
        _registerAgent(agent1, AISwarmCoordinator.AgentType.ARBITRAGE);

        // Create task as coordinator
        vm.prank(admin);
        uint256 taskId = coordinator.createTask(
            AISwarmCoordinator.AgentType.ARBITRAGE,
            AISwarmCoordinator.TaskPriority.MEDIUM,
            10e18, // reward
            AISwarmCoordinator.RewardType.FIXED,
            block.timestamp + 1 hours,
            abi.encode("Find arbitrage on Uniswap")
        );

        assertEq(taskId, 1);

        AISwarmCoordinator.Task memory task = coordinator.getTask(taskId);
        assertEq(task.taskId, 1);
        assertEq(
            uint256(task.status),
            uint256(AISwarmCoordinator.TaskStatus.CREATED)
        );
        assertEq(task.reward, 10e18);
    }

    function testClaimTask() public {
        _registerAgent(agent1, AISwarmCoordinator.AgentType.ARBITRAGE);

        // Create task
        vm.prank(admin);
        uint256 taskId = coordinator.createTask(
            AISwarmCoordinator.AgentType.ARBITRAGE,
            AISwarmCoordinator.TaskPriority.LOW, // Low priority = no min reputation
            10e18,
            AISwarmCoordinator.RewardType.FIXED,
            block.timestamp + 1 hours,
            abi.encode("Test task")
        );

        // Claim task
        vm.prank(agent1);
        coordinator.claimTask(taskId);

        AISwarmCoordinator.Task memory task = coordinator.getTask(taskId);
        assertEq(task.assignedAgent, agent1);
        assertEq(
            uint256(task.status),
            uint256(AISwarmCoordinator.TaskStatus.ASSIGNED)
        );
    }

    function testSubmitResult() public {
        _registerAgent(agent1, AISwarmCoordinator.AgentType.ARBITRAGE);

        // Create and claim task
        vm.prank(admin);
        uint256 taskId = coordinator.createTask(
            AISwarmCoordinator.AgentType.ARBITRAGE,
            AISwarmCoordinator.TaskPriority.LOW,
            10e18,
            AISwarmCoordinator.RewardType.FIXED,
            block.timestamp + 1 hours,
            abi.encode("Test task")
        );

        vm.prank(agent1);
        coordinator.claimTask(taskId);

        // Submit result
        bytes32 resultHash = keccak256("result data");
        bytes memory resultData = abi.encode("Arbitrage found: swap A->B->C");

        vm.prank(agent1);
        coordinator.submitResult(
            taskId,
            resultHash,
            resultData,
            850, // 85% confidence
            1e18 // 1 token profit
        );

        AISwarmCoordinator.Task memory task = coordinator.getTask(taskId);
        assertEq(
            uint256(task.status),
            uint256(AISwarmCoordinator.TaskStatus.SUBMITTED)
        );
        assertEq(task.resultHash, resultHash);
    }

    function testFullTaskLifecycle() public {
        _registerAgent(agent1, AISwarmCoordinator.AgentType.ARBITRAGE);

        // Fund treasury for rewards
        token.mint(treasury, 1000e18);
        vm.prank(treasury);
        token.approve(address(coordinator), type(uint256).max);

        // Create task
        vm.prank(admin);
        uint256 taskId = coordinator.createTask(
            AISwarmCoordinator.AgentType.ARBITRAGE,
            AISwarmCoordinator.TaskPriority.LOW,
            10e18,
            AISwarmCoordinator.RewardType.FIXED,
            block.timestamp + 1 hours,
            abi.encode("Find arbitrage")
        );

        // Claim
        vm.prank(agent1);
        coordinator.claimTask(taskId);

        // Submit
        vm.prank(agent1);
        coordinator.submitResult(
            taskId,
            keccak256("result"),
            abi.encode("Found opportunity"),
            900,
            5e18
        );

        // Validate
        vm.prank(admin);
        coordinator.validateResult(taskId, 800, true); // 80% validation score

        // Complete
        uint256 balanceBefore = token.balanceOf(agent1);

        vm.prank(admin);
        coordinator.completeTask(taskId);

        uint256 balanceAfter = token.balanceOf(agent1);
        assertEq(balanceAfter - balanceBefore, 10e18); // Full reward

        // Check agent stats
        AISwarmCoordinator.Agent memory agent = coordinator.getAgent(agent1);
        assertEq(agent.tasksCompleted, 1);
        assertEq(agent.totalEarnings, 10e18);
        assertTrue(agent.reputation > 500); // Reputation increased
    }

    function testAddStake() public {
        _registerAgent(agent1, AISwarmCoordinator.AgentType.ARBITRAGE);

        uint256 additionalStake = 50e18;

        vm.prank(agent1);
        coordinator.addStake(additionalStake);

        AISwarmCoordinator.Agent memory agent = coordinator.getAgent(agent1);
        assertEq(agent.stake, MIN_STAKE + additionalStake);
    }

    function testWithdrawStake() public {
        _registerAgent(agent1, AISwarmCoordinator.AgentType.ARBITRAGE);

        // Add extra stake first
        vm.prank(agent1);
        coordinator.addStake(50e18);

        // Withdraw extra
        uint256 balanceBefore = token.balanceOf(agent1);

        vm.prank(agent1);
        coordinator.withdrawStake(50e18);

        uint256 balanceAfter = token.balanceOf(agent1);
        assertEq(balanceAfter - balanceBefore, 50e18);

        AISwarmCoordinator.Agent memory agent = coordinator.getAgent(agent1);
        assertEq(agent.stake, MIN_STAKE);
    }

    function testGetAvailableTasks() public {
        _registerAgent(agent1, AISwarmCoordinator.AgentType.ARBITRAGE);
        _registerAgent(agent2, AISwarmCoordinator.AgentType.LENDING);

        // Create tasks
        vm.startPrank(admin);
        coordinator.createTask(
            AISwarmCoordinator.AgentType.ARBITRAGE,
            AISwarmCoordinator.TaskPriority.LOW,
            10e18,
            AISwarmCoordinator.RewardType.FIXED,
            block.timestamp + 1 hours,
            abi.encode("Arbitrage task 1")
        );
        coordinator.createTask(
            AISwarmCoordinator.AgentType.LENDING,
            AISwarmCoordinator.TaskPriority.LOW,
            10e18,
            AISwarmCoordinator.RewardType.FIXED,
            block.timestamp + 1 hours,
            abi.encode("Lending task 1")
        );
        coordinator.createTask(
            AISwarmCoordinator.AgentType.GENERAL,
            AISwarmCoordinator.TaskPriority.LOW,
            10e18,
            AISwarmCoordinator.RewardType.FIXED,
            block.timestamp + 1 hours,
            abi.encode("General task")
        );
        vm.stopPrank();

        // Agent1 (ARBITRAGE) should see arbitrage + general tasks
        uint256[] memory agent1Tasks = coordinator.getAvailableTasks(
            agent1,
            10
        );
        assertEq(agent1Tasks.length, 2);

        // Agent2 (LENDING) should see lending + general tasks
        uint256[] memory agent2Tasks = coordinator.getAvailableTasks(
            agent2,
            10
        );
        assertEq(agent2Tasks.length, 2);
    }

    function testSwarmMetrics() public {
        _registerAgent(agent1, AISwarmCoordinator.AgentType.ARBITRAGE);
        _registerAgent(agent2, AISwarmCoordinator.AgentType.LENDING);

        AISwarmCoordinator.SwarmMetrics memory metrics = coordinator
            .getSwarmMetrics();
        assertEq(metrics.totalAgents, 2);
        assertEq(metrics.activeAgents, 2);
    }

    // ============ Helper Functions ============

    function _registerAgent(
        address agent,
        AISwarmCoordinator.AgentType agentType
    ) internal {
        bytes32[] memory specializations = new bytes32[](0);

        vm.prank(agent);
        coordinator.registerAgent(
            agentType,
            "https://api.test.io",
            specializations
        );
    }
}
