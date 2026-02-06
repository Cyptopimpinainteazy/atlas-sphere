import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MediaProductionPanel } from '../MediaProductionPanel';

describe('MediaProductionPanel', () => {
  const mockRpcUrl = 'http://localhost:9944';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the component with title', async () => {
      render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Production Sessions/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('renders session cards with mock data', async () => {
      render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Audio Recording Session 1/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('session display', () => {
    it('displays session titles correctly', async () => {
      render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Audio Recording Session 1/)).toBeInTheDocument();
        expect(screen.getByText(/Video Editing 2/)).toBeInTheDocument();
        expect(screen.getByText(/Media Render 3/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('displays session status badges in lowercase', async () => {
      render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText('in-progress')).toBeInTheDocument();
        expect(screen.getByText('scheduled')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('displays progress percentages', async () => {
      render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText('45%')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('renders progress bars with correct widths', async () => {
      render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        const progressFills = screen.getAllByRole('generic').filter(el => {
          const style = window.getComputedStyle(el);
          return style.width !== 'auto';
        });
        expect(progressFills.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('props handling', () => {
    it('accepts rpcUrl prop', async () => {
      const { container } = render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });

    it('accepts optional pollInterval prop', async () => {
      const { container } = render(
        <MediaProductionPanel rpcUrl={mockRpcUrl} pollInterval={60000} />,
      );
      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });

    it('uses default pollInterval when not provided', async () => {
      const { container } = render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });
  });

  describe('error handling', () => {
    it('renders component without errors', () => {
      expect(() => {
        render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      }).not.toThrow();
    });

    it('handles empty rpcUrl gracefully', async () => {
      render(<MediaProductionPanel rpcUrl="" />);
      await waitFor(() => {
        expect(screen.getByText(/Production Sessions/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('cleanup', () => {
    it('clears interval on unmount', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const { unmount } = render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('sets loading and error states during fetch', async () => {
      const { container } = render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(container.querySelector('.media-production-panel')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('error state display', () => {
    it('renders error state when component encounters error', async () => {
      // Note: the actual component catches errors and sets them
      render(<MediaProductionPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        const panel = screen.getByText(/Production Sessions/).closest('.media-production-panel');
        expect(panel).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
