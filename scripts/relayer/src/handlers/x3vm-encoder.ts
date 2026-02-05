import { ApiPromise, WsProvider } from '@polkadot/api';

export interface SettlementPayload {
  shipmentId: string; // treated as bytes/Vec<u8>
  parts: string[]; // array of part ids
  amount: string | number; // u128
}

/**
 * Discover pallets and calls from node metadata
 */
export async function discoverPallets(wsUrl: string) {
  const provider = new WsProvider(wsUrl);
  const api = await ApiPromise.create({ provider });
  const pallets = api.runtimeVersion ? api.tx : null;

  const list = Object.keys((api.tx as any) || {}).map((p) => ({ pallet: p, calls: Object.keys((api.tx as any)[p]) }));
  await api.disconnect();
  return list;
}

/**
 * Encode a settlement extrinsic for pallet.method using live node types.
 * If the pallet or method doesn't exist an error is thrown.
 */
export async function encodeSettlementExtrinsic(wsUrl: string, pallet: string, method: string, payload: SettlementPayload): Promise<string> {
  const provider = new WsProvider(wsUrl);
  const api = await ApiPromise.create({ provider });

  if (!(api.tx as any)[pallet] || !(api.tx as any)[pallet][method]) {
    await api.disconnect();
    throw new Error(`Pallet/method ${pallet}.${method} not found on node`);
  }

  // Map payload to arguments - assume (shipmentId: Vec<u8>, parts: Vec<Vec<u8>>, amount: u128)
  const shipment = new TextEncoder().encode(payload.shipmentId);
  const parts = payload.parts.map((p) => new TextEncoder().encode(p));
  const amount = (typeof payload.amount === 'string') ? BigInt(payload.amount) : BigInt(payload.amount || 0);

  // Create extrinsic (unsigned) and return hex
  const tx = (api.tx as any)[pallet][method](shipment, parts, amount);
  const hex = tx.method.toHex();

  await api.disconnect();
  return hex;
}

export default { discoverPallets, encodeSettlementExtrinsic };