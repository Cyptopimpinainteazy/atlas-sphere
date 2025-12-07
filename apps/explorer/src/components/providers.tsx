/**
 * Explorer App Providers
 * 
 * Wraps the explorer app with necessary providers for chain connectivity.
 */

'use client';

import { ReactNode, useState, useEffect } from 'react';
import { SWRConfig } from 'swr';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          dedupingInterval: 2000,
        }}
      >
        {children}
      </SWRConfig>
    );
  }

  const networkEnv = getNetworkEnv();
  const wsEndpoint = RPC_ENDPOINTS[networkEnv].ws;

  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 2000,
        errorRetryCount: 3,
        errorRetryInterval: 5000,
      }}
    >
      <ChainProvider endpoint={wsEndpoint} autoConnect>
        {children}
      </ChainProvider>
    </SWRConfig>
  );
}

export default Providers;
