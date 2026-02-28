// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AISwarmCoordinator.sol";
import "../src/GPUMarketplace.sol";
import "../src/PredictionMarket.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployAISwarm
 * @notice Deployment script for AI Swarm contracts
 */
contract DeployAISwarm is Script {
    // Deployed addresses
    address public aiSwarmCoordinator;
    address public gpuMarketplace;
    address public predictionMarket;

    // Config
    address public admin;
    address public stakingToken;
    address public rewardToken;
    address public paymentToken;
    address public treasury;

    function setUp() public {
        // Load from environment
        admin = vm.envOr("ADMIN", address(this));
        stakingToken = vm.envOr("STAKING_TOKEN", address(0));
        rewardToken = vm.envOr("REWARD_TOKEN", address(0));
        paymentToken = vm.envOr("PAYMENT_TOKEN", address(0));
        treasury = vm.envOr("TREASURY", address(this));
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy AI Swarm Coordinator
        aiSwarmCoordinator = _deployAISwarmCoordinator();
        console.log("AISwarmCoordinator deployed at:", aiSwarmCoordinator);

        // Deploy GPU Marketplace
        gpuMarketplace = _deployGPUMarketplace();
        console.log("GPUMarketplace deployed at:", gpuMarketplace);

        // Deploy Prediction Market
        predictionMarket = _deployPredictionMarket();
        console.log("PredictionMarket deployed at:", predictionMarket);

        vm.stopBroadcast();

        // Log deployment summary
        _logDeployment();
    }

    function _deployAISwarmCoordinator() internal returns (address) {
        // Deploy implementation
        AISwarmCoordinator impl = new AISwarmCoordinator();

        // Encode initialization
        bytes memory initData = abi.encodeWithSelector(
            AISwarmCoordinator.initialize.selector,
            admin,
            stakingToken,
            rewardToken,
            treasury
        );

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        return address(proxy);
    }

    function _deployGPUMarketplace() internal returns (address) {
        // Deploy implementation
        GPUMarketplace impl = new GPUMarketplace();

        // Encode initialization (2.5% platform fee)
        bytes memory initData = abi.encodeWithSelector(
            GPUMarketplace.initialize.selector,
            admin,
            paymentToken,
            treasury,
            250 // 2.5% fee in BPS
        );

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        return address(proxy);
    }

    function _deployPredictionMarket() internal returns (address) {
        // Deploy implementation
        PredictionMarket impl = new PredictionMarket();

        // Encode initialization (1% platform fee)
        bytes memory initData = abi.encodeWithSelector(
            PredictionMarket.initialize.selector,
            admin,
            paymentToken, // Use same token as collateral
            treasury,
            100 // 1% fee in BPS
        );

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        return address(proxy);
    }

    function _logDeployment() internal view {
        console.log("\n========== AI Swarm Deployment Summary ==========");
        console.log("Network:", block.chainid);
        console.log("Admin:", admin);
        console.log("Treasury:", treasury);
        console.log("\nContracts:");
        console.log("  AISwarmCoordinator:", aiSwarmCoordinator);
        console.log("  GPUMarketplace:", gpuMarketplace);
        console.log("  PredictionMarket:", predictionMarket);
        console.log("\nTokens:");
        console.log("  Staking Token:", stakingToken);
        console.log("  Reward Token:", rewardToken);
        console.log("  Payment Token:", paymentToken);
        console.log("=================================================\n");
    }
}

/**
 * @title DeployAISwarmLocal
 * @notice Local deployment with mock tokens
 */
contract DeployAISwarmLocal is DeployAISwarm {
    function setUp() public override {
        admin = address(this);
        treasury = address(this);
        // Will deploy mock tokens
    }

    function run() public override {
        vm.startBroadcast();

        // Deploy mock ERC20 for testing
        MockERC20 mockToken = new MockERC20("X3 Token", "X3");
        stakingToken = address(mockToken);
        rewardToken = address(mockToken);
        paymentToken = address(mockToken);

        console.log("Mock Token deployed at:", address(mockToken));

        // Deploy AI Swarm contracts
        aiSwarmCoordinator = _deployAISwarmCoordinator();
        gpuMarketplace = _deployGPUMarketplace();
        predictionMarket = _deployPredictionMarket();

        vm.stopBroadcast();

        _logDeployment();
    }
}

/**
 * @title MockERC20
 * @notice Simple mock ERC20 for testing
 */
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
