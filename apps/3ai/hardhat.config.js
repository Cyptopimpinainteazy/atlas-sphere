require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 3, // 3aiChain chain ID
      allowUnlimitedContractSize: true,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        accountsBalance: "1000000000000000000000000" // 1,000,000 3AI
      },
      blockGasLimit: 30000000,
      mining: {
        auto: true,
        interval: 1000
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 3, // 3aiChain chain ID
      chainName: '3aiChain Local',
      nativeCurrency: {
        name: '3AI',
        symbol: '3AI',
        decimals: 18
      }
    },
    '3aichain': {
      url: process.env.RPC_URL_3AICHAIN || "http://localhost:8545",
      chainId: 3,
      chainName: '3aiChain',
      nativeCurrency: {
        name: '3AI',
        symbol: '3AI',
        decimals: 18
      },
      blockExplorerUrls: [process.env.BLOCK_EXPLORER_URL_3AICHAIN || "https://explorer.3ai.xyz"],
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
};
