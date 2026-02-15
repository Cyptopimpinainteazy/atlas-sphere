import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock the substrate hooks used by the component
vi.mock('@/hooks/useSubstrate', () => ({
  useRecentBlocks: (count = 6) => ({
    data: [
      { number: 42, hash: '0xabcde0123456789abcdef', extrinsicsCount: 3, timestamp: Date.now() - 5000 },
    ],
    isLoading: false,
    mutate: () => Promise.resolve(),
  }),
  useNewHeads: () => ({ data: null }),
}));

import ExplorerHomePanel from '../ExplorerHomePanel';

describe('ExplorerHomePanel', () => {
  it('renders live recent blocks when available', () => {
    render(<ExplorerHomePanel />);
    // block number should be rendered
    expect(screen.getByText('#42')).toBeInTheDocument();
    // truncated hash should appear (shortHash format)
    expect(screen.getByText(/0xabcde0.*[0-9a-f]{4}$/i) || screen.getByText(/0xabcde0/)).toBeTruthy();
  });

  it('falls back to static sample blocks when no live data', () => {
    // simulate no live data by updating the mocked hook implementation
    const mod = require('@/hooks/useSubstrate');
    mod.useRecentBlocks = (count = 6) => ({ data: undefined, isLoading: false, mutate: () => Promise.resolve() });

    render(<ExplorerHomePanel />);
    // fallback block number from the component's mock array
    expect(screen.getByText('#1,284,520')).toBeInTheDocument();
  });
});
