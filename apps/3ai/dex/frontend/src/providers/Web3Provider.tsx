import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode, useEffect, useState } from 'react';
import { WagmiConfig, configureChains, createConfig, mainnet } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { chain } from '../config/chains';

// Create a client
const queryClient = new QueryClient();

// Configure chains & providers with the 3ai chain and mainnet
const { publicClient, frontend/webSocketPublicClient } = configureChains(
  [chain, mainnet],
  [
    publicProvider(),
    jsonRpcProvider({
      rpc: (chain) => ({
        http: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
      }),
    }),
  ]
);

// Create wagmi config
const config = createConfig({
  autoConnect: true,
  publicClient,
  frontend/webSocketPublicClient,
});

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiConfig>
  );
}
