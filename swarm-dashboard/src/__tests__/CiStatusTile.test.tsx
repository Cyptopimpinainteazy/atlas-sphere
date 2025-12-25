import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { CiStatusTile } from '../components/CiStatusTile';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

test('CiStatusTile displays status and updates on fetch', async () => {
  // mock fetch to return a successful status
  global.fetch = jest.fn().mockResolvedValue({
    json: async () => ({ result: { status: 'success', last_checked: 'now' } })
  }) as any;

  render(<CiStatusTile rpcUrl="http://localhost:9944" pollInterval={1000} />);

  // Wait for the effect to run and update
  await waitFor(() => expect(screen.getByText(/CI Status/)).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText(/SUCCESS/)).toBeInTheDocument());
});
