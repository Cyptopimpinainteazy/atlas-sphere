/**
 * Wallet App Providers
 * 
 * Wraps the wallet app with necessary providers for chain connectivity.
 */

'use client';

import { ReactNode, useState, useEffect } from 'react';

// Simplified providers without shared dependencies to fix compilation
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
    return null;
  }

  return <>{children}</>;
}

export default Providers;
