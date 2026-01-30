'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { ChainProvider, RPC_ENDPOINTS, type NetworkEnv } from '@atlas-sphere/shared';

// Determine the network environment
const getNetworkEnv = (): NetworkEnv => {
  if (typeof window === 'undefined') return 'local';
  const url = window.location.hostname;
  if (url.includes('testnet')) return 'testnet';
  if (url.includes('atlas-sphere.io')) return 'mainnet';
  return 'local';
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchInterval: 10 * 1000,
          },
        },
      })
  );

  const networkEnv = getNetworkEnv();
  const wsEndpoint = RPC_ENDPOINTS[networkEnv].ws;

  return (
    <QueryClientProvider client={queryClient}>
      <ChainProvider endpoint={wsEndpoint} autoConnect>
        {children}
      </ChainProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'hsl(220 20% 12%)',
            color: 'white',
            border: '1px solid hsl(220 15% 25%)',
          },
        }}
      />
    </QueryClientProvider>
  );
}
