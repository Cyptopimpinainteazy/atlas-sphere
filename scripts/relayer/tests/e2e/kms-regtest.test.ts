import assert from 'assert';
import fetch from 'node-fetch';
import { URL } from 'url';

// Mocha-style test
describe('e2e: Local KMS + bitcoind (regtest)', function () {
  this.timeout(120000);

  const bitcoinRpc = process.env.BITCOIN_RPC_URL;
  const kmsWif = process.env.RELAYER_LOCAL_KMS_WIF;

  if (!bitcoinRpc || !kmsWif) {
    it('skips when BITCOIN_RPC_URL or RELAYER_LOCAL_KMS_WIF not set', function () {
      this.skip();
    });
    return;
  }

  async function rpc(method: string, params: any[] = []) {
    const u = new URL(bitcoinRpc as string);
    const auth = u.username && u.password ? { username: u.username, password: u.password } : null;
    const bodyObj = { jsonrpc: '1.0', id: 'e2e', method, params };
    const headers: any = { 'Content-Type': 'application/json' };
    if (auth) {
      const creds = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      headers.Authorization = `Basic ${creds}`;
    }

    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(bitcoinRpc as string, { method: 'POST', body: JSON.stringify(bodyObj), headers });
        if (!res.ok) {
          const txt = await res.text().catch(() => '<no-body>');
          throw new Error(`RPC HTTP ${res.status}: ${txt}`);
        }
        const j = await res.json();
        if (j.error) throw new Error(JSON.stringify(j.error));
        return j.result;
      } catch (err: any) {
        console.warn(`[TEST] rpc ${method} attempt ${attempt} failed: ${err && err.message ? err.message : err}`);
        if (attempt === maxAttempts) throw err;
        // exponential-ish backoff
        await new Promise((r) => setTimeout(r, attempt * 500));
      }
    }

    throw new Error('unreachable');
  }

  it('registers LocalKms from env, builds and broadcasts tx signed by KMS', async () => {
    // Init Local KMS provider from env (this will register a provider with id like `local-1`)
    // The bootstrap exports an init function that reads RELAYER_LOCAL_KMS_WIF
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initLocalKmsFromEnv } = require('../../src/kms/bootstrap');
    const provider = initLocalKmsFromEnv();
    console.info(`[TEST] initLocalKmsFromEnv returned provider: ${provider ? provider.name : 'null'}`);
    // ensure provider registered
    const kmsMod = require('../../src/kms');
    const currentProvider = kmsMod.getProvider && kmsMod.getProvider();
    console.info(`[TEST] getProvider() -> ${currentProvider ? currentProvider.name : 'null'}`);
    if (!currentProvider) throw new Error('KMS provider not registered by bootstrap');

    // create wallet with HD keys (disable_private_keys=false, blank=false)
    // createwallet automatically loads the wallet on success
    try {
      await rpc('createwallet', ['e2e-wallet', false, false]);
      console.info('[TEST] created wallet e2e-wallet');
    } catch (err: any) {
      // Wallet may already exist; check if message indicates so
      if (err.message && err.message.includes('already exists')) {
        console.info('[TEST] wallet e2e-wallet already exists, loading...');
        await rpc('loadwallet', ['e2e-wallet']);
      } else {
        throw err;
      }
    }

    // ensure a funded address to spend from
    const minerAddr = await rpc('getnewaddress', ['miner']);
    console.info(`[TEST] minerAddr=${minerAddr}`);
    await rpc('generatetoaddress', [101, minerAddr]);

    // create a target address we will send from to a KMS-signed spend
    const depositAddr = await rpc('getnewaddress', ['deposit']);
    console.info(`[TEST] depositAddr=${depositAddr}`);
    const depositTxid = await rpc('sendtoaddress', [depositAddr, '1.0']);
    console.info(`[TEST] depositTxid=${depositTxid}`);
    await rpc('generatetoaddress', [1, minerAddr]); // confirm

    // find the UTXO
    const unspent = await rpc('listunspent', [1, 9999999, [depositAddr]]);
    console.info(`[TEST] found ${unspent.length} utxo(s) for depositAddr`);
    assert(unspent.length >= 1, 'no utxo found');
    const utxo = unspent[0];
    // fetch the raw tx hex for nonWitnessUtxo (requires -txindex on bitcoind)
    const rawtx = await rpc('getrawtransaction', [utxo.txid, true]);
    utxo.hex = rawtx.hex;
    console.info(`[TEST] utxo txid=${utxo.txid}, vout=${utxo.vout}, amount=${utxo.amount}`);

    // prepare a simple payload that the bitcoin builder expects for signing
    // This test uses the builder to create and sign a tx spending the utxo to a fresh address
    const toAddr = await rpc('getnewaddress', ['to']);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildAndSignRefund } = require('../../src/handlers/bitcoin-builder');

    // The builder expects: payload.lock.{utxos, refundTo, feeRate, privateKeyWIF, kmsKeyId}
    const payload = {
      lock: {
        utxos: [
          {
            txid: utxo.txid,
            vout: utxo.vout,
            value: BigInt(Math.floor(utxo.amount * 1e8)),
            scriptPubKey: utxo.scriptPubKey,
            hex: utxo.hex,
            address: depositAddr,
          },
        ],
        // refundTo must be inside lock
        refundTo: toAddr,
        feeRate: 10,
        // privateKeyWIF is only needed if not using KMS; provide the env WIF as fallback
        privateKeyWIF: process.env.RELAYER_LOCAL_KMS_WIF,
        // instruct builder to sign with KMS key id; bootstrap registered key 'local-1'
        kmsKeyId: process.env.RELAYER_KMS_KEY_ID || 'local-1',
      },
    };

    const hex = await buildAndSignRefund(payload);
    console.info(`[TEST] builder returned hex length=${hex ? hex.length : 0}`);
    assert(hex && typeof hex === 'string', 'builder did not return raw hex');

    // broadcast via sendrawtransaction
    const txid = await rpc('sendrawtransaction', [hex]);
    console.info(`[TEST] broadcast returned txid=${txid}`);
    assert(txid && typeof txid === 'string', 'sendrawtransaction did not return txid');

    // ensure mempool contains it
    const mempoolAfter = await rpc('getrawmempool');
    assert(mempoolAfter.includes(txid), 'tx not found in mempool after broadcast');
    // log success marker for CI
    console.info(`[TEST] E2E KMS signing and broadcast successful for keyId=${payload.lock.kmsKeyId}, txid=${txid}`);
  });
});
