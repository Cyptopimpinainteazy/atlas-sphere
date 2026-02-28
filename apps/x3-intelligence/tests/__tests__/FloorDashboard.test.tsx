import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { FloorDashboard } from '../../src/pages/FloorDashboard';
import * as api from '../../src/services/api';

vi.mock('../../src/services/api');

describe('FloorDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page header', async () => {
    (api.getFloorStats as any).mockRejectedValue(new Error('API error'));
    (api.getIntents as any).mockRejectedValue(new Error('API error'));

    render(
      <BrowserRouter>
        <FloorDashboard />
      </BrowserRouter>
    );

    expect(screen.getByText('X3 Floor')).toBeInTheDocument();
    expect(screen.getByText('Arbitrage jurisdiction — live')).toBeInTheDocument();
  });

  it('should display stats cards', async () => {
    (api.getFloorStats as any).mockRejectedValue(new Error('API error'));
    (api.getIntents as any).mockRejectedValue(new Error('API error'));

    render(
      <BrowserRouter>
        <FloorDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('Total Intents')).toBeInTheDocument();
    });
  });

  it('should fetch and display live data', async () => {
    const mockStats = {
      activeAgents: 50,
      totalIntents: 15000,
      totalVolume: '100,000,000',
      totalSlashes: 30,
      totalDisputes: 10,
      avgSuccessRate: 95.5,
      activeFlashloans: 5,
    };

    const mockIntents = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    };

    (api.getFloorStats as any).mockResolvedValue(mockStats);
    (api.getIntents as any).mockResolvedValue(mockIntents);

    render(
      <BrowserRouter>
        <FloorDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(api.getFloorStats).toHaveBeenCalled();
      expect(api.getIntents).toHaveBeenCalled();
    });
  });
});
