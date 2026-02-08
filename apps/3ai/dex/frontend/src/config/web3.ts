import { createConfig, configureChains, mainnet } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { chain } from './chains';

declare global {
  interface Window {
    ethereum?: any;
  }
}

// Get environment variables with fallbacks
const walletConnectProjectId = process.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID';

// List of supported chains
const supportedChains = [chain, mainnet];

// Configure chains & providers
const { publicClient, webSocketPublicClient } = configureChains(
  supportedChains,
  [publicProvider()],
);

// Create the Web3 configuration
export const config = createConfig({
  autoConnect: true,
  publicClient,
  webSocketPublicClient,
});

// Export the default chain
export { supportedChains, chain as defaultChain };
