const hre = require("hardhat");

async function main() {
  console.log("Deploying OrderbookV2 to local network...");
  
  // Get the contract factory
  const OrderbookV2 = await hre.ethers.getContractFactory("OrderbookV2");
  
  // Get the first account as the fee recipient
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  // Deploy the contract
  const orderbook = await OrderbookV2.deploy(deployer.address);
  await orderbook.waitForDeployment();
  
  const address = await orderbook.getAddress();
  console.log("OrderbookV2 deployed to:", address);
  
  // Save the contract address to a file for the frontend
  const fs = require('fs');
  const path = require('path');
  
  const configDir = path.join(__dirname, '..', 'dex', 'frontend', 'src', 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const configPath = path.join(configDir, 'contracts.json');
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      OrderbookV2: address,
      chainId: 3, // 3aiChain chain ID
      rpcUrl: "http://localhost:8545"
    }, null, 2)
  );
  
  console.log(`Contract address saved to ${configPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
