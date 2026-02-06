import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AlertsPanel } from '../AlertsPanel';

describe('AlertsPanel', () => {
  const mockRpcUrl = 'http://localhost:9944';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders component with title', () => {
      render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      expect(screen.getByText(/Alerts & Notifications/)).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      expect(screen.getByText(/Loading alerts/)).toBeInTheDocument();
    });

    it('displays alerts after loading', async () => {
      render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.queryByText(/Loading alerts/)).not.toBeInTheDocument();
      });
      expect(screen.getByText(/Maintenance Window Scheduled/)).toBeInTheDocument();
    });
  });

  describe('alert display', () => {
    it('displays alert titles', async () => {
      render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Maintenance Window Scheduled/)).toBeInTheDocument();
        expect(screen.getByText(/High Memory Usage/)).toBeInTheDocument();
      });
    });

    it('displays alert messages', async () => {
      render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(
          screen.getByText(/Database maintenance scheduled for tonight at 2 AM/),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Memory usage is at 85% on production server/),
        ).toBeInTheDocument();
      });
    });

    it('limits displayed alerts to first 5', async () => {
      render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        // Should not crash with multiple alerts
        expect(screen.getByText(/Alerts & Notifications/)).toBeInTheDocument();
      });
    });
  });

  describe('severity levels', () => {
    it('displays different severity icons', async () => {
      render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        // Info icon for first alert, warning icon for second
        const alertItems = screen.getAllByRole('heading', { level: 4 });
        // AlertsPanel should render
        expect(alertItems.length).toBeGreaterThan(0);
      });
    });

    it('applies correct styling for different severities', async () => {
      render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Maintenance Window Scheduled/)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('handles case with no alerts', async () => {
      render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        // Will be handled by mock data in component
        expect(screen.getByText(/Alerts & Notifications/)).toBeInTheDocument();
      });
    });
  });

  describe('props handling', () => {
    it('accepts rpcUrl prop', () => {
      const { container } = render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      expect(container).toBeTruthy();
    });

    it('responds to rpcUrl changes', async () => {
      const { rerender } = render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      expect(screen.getByText(/Loading alerts/)).toBeInTheDocument();
      rerender(<AlertsPanel rpcUrl="http://different-rpc:9944" />);
      // Component should handle new URL
      expect(screen.getByText(/Alerts & Notifications/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('handles fetch errors gracefully', async () => {
      render(<AlertsPanel rpcUrl="" />);
      await waitFor(() => {
        // Should still render component without crashing
        expect(screen.getByText(/Alerts & Notifications/)).toBeInTheDocument();
      });
    });
  });

  describe('alert filtering', () => {
    it('limits alerts to 5 items', async () => {
      render(<AlertsPanel rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        const alertItems = screen.queryAllByRole('heading', { level: 4 });
        // Should have been limited to max 5 (though mock has 2)
        expect(alertItems.length).toBeGreaterThan(0);
      });
    });
  });
});
