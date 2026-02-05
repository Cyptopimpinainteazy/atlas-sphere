// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/core/Pool.sol";
import "../src/core/OracleRouter.sol";
import "../src/core/InterestRateModel.sol";
import "../src/core/CollateralManager.sol";
import "../src/core/PoolConfigurator.sol";

/**
 * @title DeployLendingProtocol
 * @notice Deployment script for Atlas Sphere Lending Protocol
 *
 * Deployment order:
 * 1. OracleRouter (price feeds)
 * 2. InterestRateModel (rate calculations)
 * 3. CollateralManager (risk parameters)
 * 4. Pool (core lending logic)
 * 5. PoolConfigurator (admin interface)
 * 6. Initialize all contracts
 * 7. Configure initial reserves
 */
contract DeployLendingProtocol is Script {
    // Deployed contract addresses
    OracleRouter public oracle;
    InterestRateModel public irm;
    CollateralManager public collateralManager;
    Pool public pool;
    PoolConfigurator public configurator;

    // Configuration
    address public treasury;
    address public incentivesController;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        treasury = vm.envOr("TREASURY", deployer);
        incentivesController = vm.envOr("INCENTIVES", address(0));

        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Oracle Router
        oracle = new OracleRouter();
        console.log("OracleRouter deployed:", address(oracle));

        // 2. Deploy Interest Rate Model
        // Base: 2%, Slope1: 8%, Slope2: 100%, Optimal: 80%
        irm = new InterestRateModel(
            0.02e27, // baseRate
            0.08e27, // slope1
            1.00e27, // slope2
            0.80e27 // optimalUtilization
        );
        console.log("InterestRateModel deployed:", address(irm));

        // 3. Deploy Collateral Manager
        collateralManager = new CollateralManager(address(oracle));
        console.log("CollateralManager deployed:", address(collateralManager));

        // 4. Deploy Pool
        pool = new Pool(deployer); // addressesProvider = deployer for now
        console.log("Pool deployed:", address(pool));

        // 5. Deploy Configurator
        configurator = new PoolConfigurator();
        console.log("PoolConfigurator deployed:", address(configurator));

        // 6. Initialize contracts
        pool.initialize(address(oracle), treasury, address(configurator));
        console.log("Pool initialized");

        configurator.initialize(
            address(pool),
            address(collateralManager),
            address(oracle),
            address(irm)
        );
        console.log("Configurator initialized");

        collateralManager.setPool(address(pool));
        console.log("CollateralManager pool set");

        vm.stopBroadcast();

        // Log deployment summary
        _logDeployment();
    }

    function _logDeployment() internal view {
        console.log("\n========== DEPLOYMENT SUMMARY ==========");
        console.log("OracleRouter:      ", address(oracle));
        console.log("InterestRateModel: ", address(irm));
        console.log("CollateralManager: ", address(collateralManager));
        console.log("Pool:              ", address(pool));
        console.log("PoolConfigurator:  ", address(configurator));
        console.log("========================================\n");
    }
}

/**
 * @title ConfigureReserves
 * @notice Configure initial reserves (run after deployment)
 */
contract ConfigureReserves is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        address configuratorAddr = vm.envAddress("CONFIGURATOR");
        address oracleAddr = vm.envAddress("ORACLE");
        address treasuryAddr = vm.envAddress("TREASURY");

        PoolConfigurator configurator = PoolConfigurator(configuratorAddr);
        OracleRouter oracle = OracleRouter(oracleAddr);

        vm.startBroadcast(deployerPrivateKey);

        // Example: Configure USDC reserve
        address usdc = vm.envOr("USDC", address(0));
        if (usdc != address(0)) {
            // Set price: $1.00
            oracle.setManualPrice(usdc, 1e8);

            // Initialize reserve
            configurator.initReserve(
                PoolConfigurator.InitReserveInput({
                    underlying: usdc,
                    treasury: treasuryAddr,
                    incentivesController: address(0),
                    aTokenName: "Atlas USDC",
                    aTokenSymbol: "aUSDC",
                    variableDebtTokenName: "Atlas Variable Debt USDC",
                    variableDebtTokenSymbol: "vdUSDC",
                    stableDebtTokenName: "Atlas Stable Debt USDC",
                    stableDebtTokenSymbol: "sdUSDC",
                    ltv: 8000, // 80%
                    liquidationThreshold: 8500, // 85%
                    liquidationBonus: 10500, // 5% bonus
                    decimals: 6
                })
            );
            console.log("USDC reserve configured");
        }

        // Example: Configure WETH reserve
        address weth = vm.envOr("WETH", address(0));
        if (weth != address(0)) {
            // Set price: $2500
            oracle.setManualPrice(weth, 2500e8);

            configurator.initReserve(
                PoolConfigurator.InitReserveInput({
                    underlying: weth,
                    treasury: treasuryAddr,
                    incentivesController: address(0),
                    aTokenName: "Atlas WETH",
                    aTokenSymbol: "aWETH",
                    variableDebtTokenName: "Atlas Variable Debt WETH",
                    variableDebtTokenSymbol: "vdWETH",
                    stableDebtTokenName: "Atlas Stable Debt WETH",
                    stableDebtTokenSymbol: "sdWETH",
                    ltv: 8000,
                    liquidationThreshold: 8250,
                    liquidationBonus: 10500,
                    decimals: 18
                })
            );
            console.log("WETH reserve configured");
        }

        // Example: Configure WBTC reserve
        address wbtc = vm.envOr("WBTC", address(0));
        if (wbtc != address(0)) {
            // Set price: $95000
            oracle.setManualPrice(wbtc, 95000e8);

            configurator.initReserve(
                PoolConfigurator.InitReserveInput({
                    underlying: wbtc,
                    treasury: treasuryAddr,
                    incentivesController: address(0),
                    aTokenName: "Atlas WBTC",
                    aTokenSymbol: "aWBTC",
                    variableDebtTokenName: "Atlas Variable Debt WBTC",
                    variableDebtTokenSymbol: "vdWBTC",
                    stableDebtTokenName: "Atlas Stable Debt WBTC",
                    stableDebtTokenSymbol: "sdWBTC",
                    ltv: 7000,
                    liquidationThreshold: 7500,
                    liquidationBonus: 11000,
                    decimals: 8
                })
            );
            console.log("WBTC reserve configured");
        }

        vm.stopBroadcast();
    }
}

/**
 * @title SetupTestnet
 * @notice Deploy mock tokens and configure for testnet
 */
contract SetupTestnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock tokens
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        MockERC20 wbtc = new MockERC20("Wrapped Bitcoin", "WBTC", 8);

        console.log("Mock USDC:", address(usdc));
        console.log("Mock WETH:", address(weth));
        console.log("Mock WBTC:", address(wbtc));

        // Mint initial supply to deployer
        address deployer = vm.addr(deployerPrivateKey);
        usdc.mint(deployer, 1_000_000e6); // 1M USDC
        weth.mint(deployer, 1_000e18); // 1000 WETH
        wbtc.mint(deployer, 100e8); // 100 WBTC

        vm.stopBroadcast();
    }
}

/**
 * @title MockERC20
 * @notice Simple mock token for testing
 */
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external {
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
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
