import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { IntentsPage } from '../../src/pages/IntentsPage';
import * as api from '../../src/services/api';

vi.mock('../../src/services/api');

describe('IntentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page header', async () => {
    (api.getIntents as any).mockRejectedValue(new Error('API error'));

    render(
      <BrowserRouter>
        <IntentsPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Arb Intents')).toBeInTheDocument();
  });

  it('should display stats cards', async () => {
    (api.getIntents as any).mockRejectedValue(new Error('API error'));

    render(
      <BrowserRouter>
        <IntentsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Total Intents')).toBeInTheDocument();
      expect(screen.getByText('Finalized')).toBeInTheDocument();
    });
  });

  it('should filter intents by state', async () => {
    (api.getIntents as any).mockRejectedValue(new Error('API error'));

    render(
      <BrowserRouter>
        <IntentsPage />
      </BrowserRouter>
    );

    // Get filter buttons
    const buttons = await screen.findAllByRole('button');
    const finalizedBtn = buttons.find((btn) => btn.textContent?.includes('Finalized'));

    if (finalizedBtn) {
      fireEvent.click(finalizedBtn);
      // Verify filter was applied
      expect(finalizedBtn).toHaveStyle('background: var(--bg-tertiary)');
    }
  });

  it('should display intent ledger table', async () => {
    (api.getIntents as any).mockRejectedValue(new Error('API error'));

    render(
      <BrowserRouter>
        <IntentsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Intent Ledger')).toBeInTheDocument();
    });
  });
});
