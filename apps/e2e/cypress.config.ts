import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    experimentalRunAllSpecs: true,
    viewportWidth: 1920,
    viewportHeight: 1080,
    setupNodeEvents(on, config) {
      // Implement node event listeners here
    },
    env: {
      TEST_WALLET_ADDRESS: '5Hj6Y7...', // Example substrate address
      TESTNET_RPC: 'wss://atlas-testnet.example.com'
    }
  },
  component: {
    devServer: {
      framework: 'next',
      bundler: 'frontend/webpack',
    }
  }
})
