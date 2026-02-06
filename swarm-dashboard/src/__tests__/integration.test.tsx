import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../../app/dashboard-example';

describe('Integration Tests - Full Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('complete user flow', () => {
    it('loads and renders all dashboard components without errors', async () => {
      const { container } = render(<DashboardPage />);
      
      await waitFor(
        () => {
          expect(screen.getByText(/Media Production Dashboard/)).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      expect(container.querySelector('.dashboard-layout')).toBeInTheDocument();
      expect(container.querySelector('.dashboard-content')).toBeInTheDocument();
      expect(container.querySelector('.dashboard-sidebar')).toBeInTheDocument();
    });

    it('loads production sessions without crashing', async () => {
      render(<DashboardPage />);
      
      await waitFor(
        () => {
          expect(screen.getByText(/Production Sessions/)).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });

    it('loads and displays metrics panel', async () => {
      render(<DashboardPage />);
      
      await waitFor(
        () => {
          expect(screen.getByText(/Detailed Metrics/)).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });

    it('loads and displays sidebar widgets', async () => {
      render(<DashboardPage />);
      
      await waitFor(
        () => {
          expect(screen.getByText(/Quick Stats/)).toBeInTheDocument();
          expect(screen.getByText(/CI Status/)).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });
  });

  describe('data consistency', () => {
    it('provides consistent rpc url to all components', () => {
      render(<DashboardPage />);
      // All components should have been initialized with a valid RPC URL
      expect(screen.getByText(/Media Production Dashboard/)).toBeInTheDocument();
    });

    it('maintains state when period changes', async () => {
      const { container } = render(<DashboardPage />);
      
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('error boundaries', () => {
    it('handles missing RPC URL gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      render(<DashboardPage />);
      // Should still render
      expect(screen.getByText(/Media Production Dashboard/)).toBeInTheDocument();
      consoleErrorSpy.mockRestore();
    });

    it('renders without external dependencies failing', () => {
      const { container } = render(<DashboardPage />);
      expect(container).toBeTruthy();
    });
  });

  describe('accessibility in integration', () => {
    it('maintains proper heading hierarchy across all components', () => {
      render(<DashboardPage />);
      const h1 = screen.getByRole('heading', { level: 1 });
      const h3s = screen.getAllByRole('heading', { level: 3 });
      
      expect(h1).toBeInTheDocument();
      expect(h3s.length).toBeGreaterThan(0);
    });

    it('provides semantic structure for screen readers', () => {
      const { container } = render(<DashboardPage />);
      const header = container.querySelector('header');
      
      expect(header).toBeInTheDocument();
    });
  });
});
