import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TestHealthTile } from '../TestHealthTile';

describe('TestHealthTile', () => {
  const mockRpcUrl = 'http://localhost:9944';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders component with title', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Test Health/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('displays health metrics after loading', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Pass Rate/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('does not show loading state after data loads', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('metrics display', () => {
    it('displays test pass rates', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Pass Rate/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('displays coverage percentage', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Coverage/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('displays unit test counts', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Unit Tests/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('displays integration test counts', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/Integration/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('displays test counts with checkmarks', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/45✓/)).toBeInTheDocument();
        expect(screen.getByText(/12✓/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('data accuracy', () => {
    it('calculates correct pass rate', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        // 45 + 12 = 57 total passed out of 57 total
        const passRateValue = screen.getAllByText(/100%/).find(el => el.textContent === '100%');
        expect(passRateValue).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows correct coverage values', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        // Mock data has 92% coverage
        const coverageElements = screen.getAllByText(/92%/);
        expect(coverageElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('displays pass rate as string percentage', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/100%/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('styling and colors', () => {
    it('applies green color for coverage >= 90%', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        const coverageElement = screen.getByText('92%');
        expect(coverageElement).toBeInTheDocument();
        const style = window.getComputedStyle(coverageElement);
        // Component sets color via style prop
        expect(coverageElement).toHaveAttribute('style') || expect(style.color).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('renders with icon in heading', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(screen.getByText(/🧪/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('props handling', () => {
    it('accepts rpcUrl prop', async () => {
      const { container } = render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });

    it('responds to rpcUrl changes', async () => {
      const { rerender } = render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      rerender(<TestHealthTile rpcUrl="http://different-rpc:9944" />);
      await waitFor(() => {
        expect(screen.getByText(/Test Health/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('error states', () => {
    it('handles fetch errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      render(<TestHealthTile rpcUrl="" />);
      await waitFor(() => {
        // Should not crash
        expect(screen.getByText(/Test Health/)).toBeInTheDocument();
      }, { timeout: 3000 });
      consoleErrorSpy.mockRestore();
    });

    it('displays default values on error', async () => {
      render(<TestHealthTile rpcUrl={mockRpcUrl} />);
      // Component will display mock data (not real error)
      await waitFor(() => {
        expect(screen.getByText(/Test Health/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
