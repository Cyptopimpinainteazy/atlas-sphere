const hre = require("hardhat");

async function main() {
  // Get the contract factory
  const OrderbookV2 = await hre.ethers.getContractFactory("OrderbookV2");
  
  // Deploy the contract with the fee recipient address
  // For testing, we'll use the first account from Hardhat's built-in accounts
  const [deployer] = await hre.ethers.getSigners();
  const feeRecipient = deployer.address; // Using deployer as fee recipient for testing
  
  console.log("Deploying OrderbookV2 with fee recipient:", feeRecipient);
  
  const orderbook = await OrderbookV2.deploy(feeRecipient);
  
  // Wait for deployment to complete
  await orderbook.waitForDeployment();
  
  console.log("OrderbookV2 deployed to:", await orderbook.getAddress());
  
  // Verify contract on Etherscan if on a testnet or mainnet
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Waiting for block confirmations...");
    await orderbook.deploymentTransaction().wait(6);
    
    console.log("Verifying contract on Etherscan...");
    await hre.run("verify:verify", {
      address: await orderbook.getAddress(),
      constructorArguments: [feeRecipient],
    });
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
