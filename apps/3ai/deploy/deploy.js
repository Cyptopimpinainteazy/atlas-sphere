const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Orderbook contract...");

  // Get the contract factory
  const Orderbook = await ethers.getContractFactory("Orderbook");

  // Deploy the contract
  const orderbook = await Orderbook.deploy();

  // Wait for deployment to finish
  await orderbook.deployed();

  console.log("Orderbook deployed to:", orderbook.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
