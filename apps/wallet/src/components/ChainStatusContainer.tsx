'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChainStatusBanner } from '@atlas-sphere/shared/components';
import { sdkIntegration } from '@/lib/sdkIntegration';

export function ChainStatusContainer() {
  const [isConnected, setIsConnected] = useState(false);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const subRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await sdkIntegration.connect();
        if (!mounted) return;
        setIsConnected(true);

        const n = await sdkIntegration.getBlockNumber();
        if (mounted) setBlockNumber(n);

        const sub = await sdkIntegration.subscribeToBlocks((bn: number) => {
          if (mounted) setBlockNumber(bn);
        });

        subRef.current = sub;
      } catch (e) {
        console.warn('[ChainStatusContainer] connection failed', e);
        if (mounted) setIsConnected(false);
      }
    })();

    return () => {
      mounted = false;
      if (subRef.current) sdkIntegration.unsubscribe(subRef.current).catch(() => {});
      sdkIntegration.disconnect().catch(() => {});
    };
  }, []);

  const status = isConnected ? `#${blockNumber ?? '...'}` : 'Disconnected';

  return <ChainStatusBanner status={status} isConnected={isConnected} />;
}

export default ChainStatusContainer;
