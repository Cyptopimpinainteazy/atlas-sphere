'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PolkadexIndex() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to trading page by default
    router.replace('/polkadex/trading');
  }, [router]);

  return null;
}
