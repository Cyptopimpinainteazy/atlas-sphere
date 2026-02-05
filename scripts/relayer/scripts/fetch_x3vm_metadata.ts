import fs from 'fs';
import path from 'path';
import { ApiPromise, WsProvider } from '@polkadot/api';

async function main() {
  const ws = process.env.X3VM_WS_URL || 'ws://localhost:9944';
  console.log('[fetch-metadata] connecting to', ws);
  const provider = new WsProvider(ws);
  const api = await ApiPromise.create({ provider });
  const meta = api.runtimeMetadata.toJSON();

  const outPath = path.join(__dirname, '../metadata.json');
  fs.writeFileSync(outPath, JSON.stringify(meta, null, 2));
  console.log('[fetch-metadata] saved metadata to', outPath);

  // List pallets and calls
  const pallets = meta.asLatest.pallets.map((p: any) => ({ name: p.name, calls: p.calls ? p.calls.map((c: any) => c.name) : [] }));
  console.log('[fetch-metadata] pallets with calls:');
  pallets.forEach((p: any) => {
    if (p.calls.length) console.log(` - ${p.name}: ${p.calls.join(', ')}`);
  });

  await api.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });