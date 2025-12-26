import { render, screen, waitFor } from '@testing-library/react';
import path from 'path';


beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

test.skip('CiStatusTile displays status and updates on fetch', async () => {
  const CiStatusTile: any = require(path.join(__dirname, '..', 'CiStatusTile')).CiStatusTile;

  (global as any).fetch = jest.fn().mockResolvedValue({
    json: async () => ({ result: { status: 'success', last_checked: 'now' } })
  });

  render(<CiStatusTile rpcUrl="http://localhost:9944" pollInterval={1000} />);

  await waitFor(() => expect(screen.getByText(/CI Status/)).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText(/SUCCESS/)).toBeInTheDocument());
});
