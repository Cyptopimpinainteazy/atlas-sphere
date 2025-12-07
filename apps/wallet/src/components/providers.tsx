/**
 * Wallet App Providers
 * 
 * Wraps the wallet app with necessary providers for chain connectivity.
 */

'use client';

import { ReactNode, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChainProvider, RPC_ENDPOINTS, type NetworkEnv } from '@atlas-sphere/shared';

// Determine the network environment
const getNetworkEnv = (): NetworkEnv => {
  if (typeof window === 'undefined') return 'local';
  const url = window.location.hostname;
  if (url.includes('testnet')) return 'testnet';
  if (url.includes('atlas-sphere.io')) return 'mainnet';
  return 'local';
};

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchInterval: 12 * 1000,
          },
        },
      })
  );

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  const networkEnv = getNetworkEnv();
  const wsEndpoint = RPC_ENDPOINTS[networkEnv].ws;

  return (
    <QueryClientProvider client={queryClient}>
      <ChainProvider endpoint={wsEndpoint} autoConnect>
        {children}
      </ChainProvider>
    </QueryClientProvider>
  );
}

export default Providers;
