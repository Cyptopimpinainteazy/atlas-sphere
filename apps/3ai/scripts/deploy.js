const hre = require("hardhat");

async function main() {
  console.log("Deploying OrderBook contract...");

  // Get the contract factory
  const OrderBook = await hre.ethers.getContractFactory("Orderbook");
  
  // Deploy the contract
  const orderbook = await OrderBook.deploy();
  await orderbook.deployed();

  console.log("OrderBook deployed to:", orderbook.address);
  
  // Verify the contract on Etherscan (if needed)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Waiting for block confirmations...");
    await orderbook.deployTransaction.wait(6);
    
    console.log("Verifying contract on Etherscan...");
    await hre.run("verify:verify", {
      address: orderbook.address,
      constructorArguments: [],
    });
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
