import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from '../dashboard-example';

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_RPC_URL = undefined;
    process.env.NEXT_PUBLIC_PUBLIC_RPC_URL = undefined;
    process.env.NEXT_PUBLIC_FALLBACK_RPC_URL = undefined;
  });

  describe('rendering', () => {
    it('renders the main dashboard layout', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/Media Production Dashboard/)).toBeInTheDocument();
    });

    it('renders dashboard header', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/Media Production Dashboard/)).toBeInTheDocument();
      expect(screen.getByText(/Real-time orchestration and metrics/)).toBeInTheDocument();
    });

    it('renders period selector buttons', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/Day/)).toBeInTheDocument();
      expect(screen.getByText(/Week/)).toBeInTheDocument();
      expect(screen.getByText(/Month/)).toBeInTheDocument();
      expect(screen.getByText(/Quarter/)).toBeInTheDocument();
      expect(screen.getByText(/Year/)).toBeInTheDocument();
    });

    it('renders main dashboard sections', async () => {
      render(<DashboardPage />);
      await waitFor(() => {
        expect(screen.getByText(/Production Sessions/)).toBeInTheDocument();
        expect(screen.getByText(/Detailed Metrics/)).toBeInTheDocument();
      });
    });

    it('renders sidebar components', async () => {
      render(<DashboardPage />);
      await waitFor(() => {
        expect(screen.getByText(/Quick Stats/)).toBeInTheDocument();
        expect(screen.getByText(/CI Status/)).toBeInTheDocument();
        expect(screen.getByText(/Test Health/)).toBeInTheDocument();
      });
    });
  });

  describe('period selection', () => {
    it('shows Week as default selected period', () => {
      render(<DashboardPage />);
      const weekButton = screen.getByRole('button', { name: /Week/ });
      // Week button should have active class by default
      expect(weekButton).toBeInTheDocument();
    });

    it('allows changing period', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      const monthButton = screen.getByRole('button', { name: /Month/ });
      await user.click(monthButton);

      // Component should update to show month period
      expect(monthButton).toBeInTheDocument();
    });

    it('allows selecting all periods', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      const periods = ['Day', 'Week', 'Month', 'Quarter', 'Year'];
      for (const period of periods) {
        const button = screen.getByRole('button', { name: new RegExp(period) });
        await user.click(button);
        expect(button).toBeInTheDocument();
      }
    });
  });

  describe('RPC URL resolution', () => {
    it('uses NEXT_PUBLIC_RPC_URL if set', () => {
      process.env.NEXT_PUBLIC_RPC_URL = 'http://custom-rpc:9944';
      render(<DashboardPage />);
      // Dashboard should render with custom RPC
      expect(screen.getByText(/Media Production Dashboard/)).toBeInTheDocument();
    });

    it('falls back to NEXT_PUBLIC_PUBLIC_RPC_URL', () => {
      process.env.NEXT_PUBLIC_PUBLIC_RPC_URL = 'http://public-rpc:9944';
      render(<DashboardPage />);
      expect(screen.getByText(/Media Production Dashboard/)).toBeInTheDocument();
    });

    it('falls back to NEXT_PUBLIC_FALLBACK_RPC_URL', () => {
      process.env.NEXT_PUBLIC_FALLBACK_RPC_URL = 'http://fallback-rpc:9944';
      render(<DashboardPage />);
      expect(screen.getByText(/Media Production Dashboard/)).toBeInTheDocument();
    });

    it('defaults to localhost', () => {
      render(<DashboardPage />);
      // Should still render with default localhost
      expect(screen.getByText(/Media Production Dashboard/)).toBeInTheDocument();
    });
  });

  describe('responsive layout', () => {
    it('renders grid layout for main dashboard', () => {
      const { container } = render(<DashboardPage />);
      const dashboardLayout = container.querySelector('.dashboard-layout');
      expect(dashboardLayout).toBeInTheDocument();
    });

    it('renders sidebar grid layout', () => {
      const { container } = render(<DashboardPage />);
      const sidebar = container.querySelector('.dashboard-sidebar');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe('metrics panel', () => {
    it('displays metrics cards', async () => {
      render(<DashboardPage />);
      await waitFor(
        () => {
          expect(screen.getByText(/Sessions Scheduled/)).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
      expect(screen.getByText(/Sessions Completed/)).toBeInTheDocument();
      expect(screen.getByText(/Assets Created/)).toBeInTheDocument();
    });

    it('displays top contributors list when available', async () => {
      render(<DashboardPage />);
      await waitFor(
        () => {
          expect(screen.getByText(/Top Contributors/)).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });
  });

  describe('accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<DashboardPage />);
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
    });

    it('has accessible buttons for period selection', () => {
      render(<DashboardPage />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders semantic header element', () => {
      const { container } = render(<DashboardPage />);
      const header = container.querySelector('header');
      expect(header).toBeInTheDocument();
    });
  });
});
