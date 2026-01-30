import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useMediaMetrics } from '../hooks/useMediaMetrics';

// Simple test component that uses the hook and renders summary values
function TestComponent({ rpcUrl = 'http://localhost:9944', period = 'week' }: { rpcUrl?: string; period?: string }) {
  const { summary, loading, error } = useMediaMetrics({ rpcUrl, period, autoRefresh: false });

  if (loading) return <div>loading</div>;
  if (error) return <div>error</div>;

  return (
    <div>
      <div>sessionsScheduled:{summary?.sessionsScheduled}</div>
      <div>sessionsCompleted:{summary?.sessionsCompleted}</div>
    </div>
  );
}

describe('useMediaMetrics', () => {
  beforeEach(() => {
    // default fetch mock for the hook (the hook currently doesn't call fetch in our mock implementation,
    // but keep this to guard future changes)
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ({}) }) as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders summary when not loading', async () => {
    render(<TestComponent />);

    // The hook uses a short timeout to stop loading; wait for it
    await waitFor(() => expect(screen.queryByText('loading')).not.toBeInTheDocument());

    expect(screen.getByText(/sessionsScheduled:/)).toBeInTheDocument();
    expect(screen.getByText(/sessionsCompleted:/)).toBeInTheDocument();
  });
});
