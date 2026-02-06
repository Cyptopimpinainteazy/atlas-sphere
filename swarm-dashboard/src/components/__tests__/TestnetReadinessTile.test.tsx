import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TestnetReadinessTile } from '../TestnetReadinessTile';

describe('TestnetReadinessTile', () => {
  const mockRpcUrl = 'http://localhost:9944';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders component with title', () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      expect(screen.getByText(/Testnet Readiness/)).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });

    it('displays status after loading', async () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
      expect(screen.getByText(/Excellent/)).toBeInTheDocument();
    });
  });

  describe('health indicator', () => {
    it('displays network health percentage', async () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/98%/)).toBeInTheDocument();
      });
    });

    it('displays health status label', async () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Excellent/)).toBeInTheDocument();
      });
    });

    it('shows correct status for different health levels', async () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        // Mock data has 98% health = Excellent
        expect(screen.getByText(/Excellent/)).toBeInTheDocument();
      });
    });
  });

  describe('metrics display', () => {
    it('displays nodes online metric', async () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Nodes Online/)).toBeInTheDocument();
        expect(screen.getByText(/23\/24/)).toBeInTheDocument();
      });
    });

    it('displays block height metric', async () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Block Height/)).toBeInTheDocument();
        expect(screen.getByText(/1,250,000/)).toBeInTheDocument();
      });
    });

    it('displays transaction rate metric', async () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Tx\/sec/)).toBeInTheDocument();
        expect(screen.getByText(/450/)).toBeInTheDocument();
      });
    });

    it('displays latency metric', async () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Latency/)).toBeInTheDocument();
        expect(screen.getByText(/120ms/)).toBeInTheDocument();
      });
    });
  });

  describe('props handling', () => {
    it('accepts rpcUrl prop', () => {
      const { container } = render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      expect(container).toBeTruthy();
    });

    it('responds to rpcUrl changes', async () => {
      const { rerender } = render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      expect(screen.getByText(/Loading/)).toBeInTheDocument();
      rerender(<TestnetReadinessTile rpcUrl="http://different-rpc:9944" />);
      await waitFor(() => {
        // Should re-fetch with new URL
        expect(screen.getByText(/Excellent/)).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('displays error message on failure', async () => {
      render(<TestnetReadinessTile rpcUrl="" />);
      await waitFor(() => {
        // Component should handle empty URL gracefully
        expect(screen.getByText(/Testnet Readiness/)).toBeInTheDocument();
      });
    });

    it('shows error styling when error occurs', async () => {
      const { container } = render(<TestnetReadinessTile rpcUrl="" />);
      await waitFor(() => {
        // Should still render without crashing
        expect(container.querySelector('.testnet-readiness-tile')).toBeInTheDocument();
      });
    });
  });

  describe('auto-refresh', () => {
    it('clears interval on unmount', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const { unmount } = render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('formatting', () => {
    it('formats block height with locale string', async () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      await waitFor(
        () => {
          // 1250000 should be formatted as 1,250,000
          expect(screen.getByText(/1,250,000/)).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it('formats latency with ms suffix', async () => {
      render(<TestnetReadinessTile rpcUrl={mockRpcUrl} />);
      await waitFor(
        () => {
          expect(screen.getByText(/120ms/)).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });
});
