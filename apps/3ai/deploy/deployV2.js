// scripts/deployV2.js
const { ethers } = reqfrontend/uire("hardhat");

async function main() {
  console.log("Deploying OrderbookV2 contract...");

  // Get the contract factory
  const OrderbookV2 = await ethers.getContractFactory("OrderbookV2");
  
  // Deploy the contract with the fee recipient address (can be the deployer or a multisig)
  const [deployer] = await ethers.getSigners();
  const feeRecipient = deployer.address; // In production, use a dedicated fee recipient address
  
  console.log(`Deploying with fee recipient: ${feeRecipient}`);
  
  const orderbook = await OrderbookV2.deploy(feeRecipient);
  
  // Wait for deployment to finish
  await orderbook.waitForDeployment();

  console.log(`OrderbookV2 deployed to: ${await orderbook.getAddress()}`);
  
  // Verify contract on Etherscan (if applicable)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Verifying contract on Etherscan...");
    await hre.run("verify:verify", {
      address: await orderbook.getAddress(),
      constructorArguments: [feeRecipient],
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
