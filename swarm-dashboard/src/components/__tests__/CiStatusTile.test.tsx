import { render, screen, waitFor } from '@testing-library/react';

let CiStatusTile: any;

beforeAll(async () => {
  // dynamically import the component using a relative path so Jest can resolve it
  // @ts-ignore
  CiStatusTile = (await import('../CiStatusTile')).CiStatusTile;
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

test('CiStatusTile displays status and updates on fetch', async () => {
  (global as any).fetch = jest.fn().mockResolvedValue({
    json: async () => ({ result: { status: 'success', last_checked: 'now' } })
  });

  render(<CiStatusTile rpcUrl="http://localhost:9944" pollInterval={1000} />);

  await waitFor(() => expect(screen.getByText(/CI Status/)).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText(/SUCCESS/)).toBeInTheDocument());
});
