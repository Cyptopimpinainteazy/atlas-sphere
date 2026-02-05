import { discoverPallets, encodeSettlementExtrinsic } from '../src/handlers/x3vm-encoder';

const ws = process.env.X3VM_WS_URL;

describe('X3VM encoder (integration)', () => {
  if (!ws) {
    it('skips because X3VM_WS_URL not set', () => {
      console.warn('Skipping X3VM encoder tests; set X3VM_WS_URL to run');
    });
    return;
  }

  it('discovers pallets and finds settlement or swarm pallet', async function () {
    this.timeout(20000);
    const pallets = await discoverPallets(ws);
    expect(Array.isArray(pallets)).toBe(true);
    const found = pallets.find((p:any)=>p.pallet.toLowerCase().includes('settlement')||p.pallet.toLowerCase().includes('swarm'));
    expect(found).toBeDefined();
  });

  it('encodes a sample extrinsic for settlement', async function () {
    this.timeout(20000);
    const pallets = await discoverPallets(ws);
    const candidate = pallets.find((p:any)=>p.pallet.toLowerCase().includes('settlement')) || pallets[0];
    const pallet = candidate.pallet;
    const method = (candidate.calls && candidate.calls[0]) || 'settle';
    const hex = await encodeSettlementExtrinsic(ws, pallet, method, { shipmentId: 'ship-1', parts: ['part-1'], amount: 100 });
    expect(typeof hex).toBe('string');
    expect(hex.startsWith('0x')).toBeTruthy();
  });
});