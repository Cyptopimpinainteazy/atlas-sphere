import { CollateralManagerClient } from '../src/collateral';

describe('CollateralManagerClient', () => {
  it('creates a deposit receipt', async () => {
    const client = new CollateralManagerClient('http://localhost');
    const r = await client.depositBond('acct1', 'USDC', 100n);
    expect(r.bondId).toMatch(/^bond-/);
  });
});