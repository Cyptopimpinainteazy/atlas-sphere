/**
 * Integration tests for @atlas-sphere/ts-sdk X3 modules
 *
 * INV-REF: tests/invariants/registry.toml — ts_sdk_x3_integration
 *
 * Tests the X3 client classes added to the ts-sdk:
 *  - X3SettlementClient
 *  - X3AtomicTradeClient
 *  - X3DomainClient
 *  - X3VerifierClient
 */

import {
  X3SettlementClient,
  X3AtomicTradeClient,
  X3DomainClient,
  X3VerifierClient,
  createX3SettlementClient,
  createX3TradeClient,
  createX3DomainClient,
  createX3VerifierClient,
  X3VmType,
  X3AmmProtocol,
} from '../src/x3';

// =============================================================================
// Enum / constant exports
// =============================================================================

describe('X3 enums', () => {
  test('X3VmType contains all VM variants', () => {
    expect(X3VmType.Evm).toBe('Evm');
    expect(X3VmType.Svm).toBe('Svm');
    expect(X3VmType.X3).toBe('X3');
    expect(X3VmType.CrossVm).toBe('CrossVm');
  });

  test('X3AmmProtocol contains all AMM protocols', () => {
    expect(X3AmmProtocol.UniswapV2).toBe('UniswapV2');
    expect(X3AmmProtocol.UniswapV3).toBe('UniswapV3');
    expect(X3AmmProtocol.Raydium).toBe('Raydium');
    expect(X3AmmProtocol.Orca).toBe('Orca');
    expect(X3AmmProtocol.AtlasNative).toBe('AtlasNative');
  });
});

// =============================================================================
// Factory Functions
// =============================================================================

describe('X3 factory functions', () => {
  // We mock ApiPromise to avoid network calls
  const mockApi = {
    tx: {
      x3SettlementEngine: {
        createIntent: jest.fn(),
        lockEscrow: jest.fn(),
        submitProof: jest.fn(),
        claim: jest.fn(),
        refund: jest.fn(),
        submitBtcProof: jest.fn(),
        depositBond: jest.fn(),
        requestBondWithdraw: jest.fn(),
      },
      atomicTradeEngine: {
        createBatch: jest.fn(),
        executeBatch: jest.fn(),
        cancelBatch: jest.fn(),
      },
      x3DomainRegistry: {
        registerDomain: jest.fn(),
        setRecords: jest.fn(),
      },
      x3Verifier: {
        registerExecutor: jest.fn(),
        submitJob: jest.fn(),
        submitReceipt: jest.fn(),
        disputeReceipt: jest.fn(),
      },
    },
    query: {
      x3SettlementEngine: {
        intents: jest.fn(),
        bonds: jest.fn(),
        btcBestHeight: jest.fn(),
      },
      atomicTradeEngine: {
        batches: jest.fn(),
        twapOracles: jest.fn(),
      },
      x3DomainRegistry: {
        domains: jest.fn(),
      },
      x3Verifier: {
        jobs: jest.fn(),
        executors: jest.fn(),
      },
    },
    rpc: {
      x3Settlement: {
        getIntent: jest.fn(),
        getIntentState: jest.fn(),
      },
      atomicTrade: {
        getBatch: jest.fn(),
        getTwap: jest.fn(),
      },
    },
  } as any;

  test('createX3SettlementClient returns client instance', () => {
    const client = createX3SettlementClient(mockApi);
    expect(client).toBeInstanceOf(X3SettlementClient);
  });

  test('createX3TradeClient returns client instance', () => {
    const client = createX3TradeClient(mockApi);
    expect(client).toBeInstanceOf(X3AtomicTradeClient);
  });

  test('createX3DomainClient returns client instance', () => {
    const client = createX3DomainClient(mockApi);
    expect(client).toBeInstanceOf(X3DomainClient);
  });

  test('createX3VerifierClient returns client instance', () => {
    const client = createX3VerifierClient(mockApi);
    expect(client).toBeInstanceOf(X3VerifierClient);
  });
});

// =============================================================================
// X3SettlementClient Tests
// =============================================================================

describe('X3SettlementClient', () => {
  let client: X3SettlementClient;

  const mockSubmittable = {
    signAndSend: jest.fn(),
    paymentInfo: jest.fn().mockResolvedValue({ partialFee: { toBigInt: () => 100n } }),
  };

  const mockApi = {
    tx: {
      x3SettlementEngine: {
        createIntent: jest.fn().mockReturnValue(mockSubmittable),
        lockEscrow: jest.fn().mockReturnValue(mockSubmittable),
        submitProof: jest.fn().mockReturnValue(mockSubmittable),
        claim: jest.fn().mockReturnValue(mockSubmittable),
        refund: jest.fn().mockReturnValue(mockSubmittable),
        submitBtcProof: jest.fn().mockReturnValue(mockSubmittable),
        depositBond: jest.fn().mockReturnValue(mockSubmittable),
        requestBondWithdraw: jest.fn().mockReturnValue(mockSubmittable),
      },
    },
    query: {
      x3SettlementEngine: {
        intents: jest.fn().mockResolvedValue({ toJSON: () => ({ initiator: 'alice', amount: 1000, state: 'Pending' }) }),
        bonds: jest.fn().mockResolvedValue({ toJSON: () => ({ owner: 'alice', amount: 500, locked: true }) }),
        btcBestHeight: jest.fn().mockResolvedValue({ toNumber: () => 850000 }),
      },
    },
  } as any;

  beforeEach(() => {
    client = new X3SettlementClient(mockApi);
    jest.clearAllMocks();
  });

  test('createIntent returns extrinsic', () => {
    const ext = client.createIntent({
      chain: 'Ethereum',
      hashLock: '0x1234',
      timeLock: 3600,
      amount: 1000,
      recipient: '0xabc',
    });
    expect(ext).toBeDefined();
    expect(mockApi.tx.x3SettlementEngine.createIntent).toHaveBeenCalledWith(
      'Ethereum', '0x1234', 3600, 1000, '0xabc'
    );
  });

  test('lockEscrow returns extrinsic', () => {
    const ext = client.lockEscrow('intent-1', 1000);
    expect(ext).toBeDefined();
    expect(mockApi.tx.x3SettlementEngine.lockEscrow).toHaveBeenCalledWith('intent-1', 1000);
  });

  test('getIntent queries storage', async () => {
    const intent = await client.getIntent('intent-1');
    expect(intent).toEqual({ initiator: 'alice', amount: 1000, state: 'Pending' });
    expect(mockApi.query.x3SettlementEngine.intents).toHaveBeenCalledWith('intent-1');
  });

  test('getBtcBestHeight queries storage', async () => {
    const height = await client.getBtcBestHeight();
    expect(height).toBe(850000);
    expect(mockApi.query.x3SettlementEngine.btcBestHeight).toHaveBeenCalled();
  });
});

// =============================================================================
// X3AtomicTradeClient Tests
// =============================================================================

describe('X3AtomicTradeClient', () => {
  let client: X3AtomicTradeClient;

  const mockSubmittable = {
    signAndSend: jest.fn(),
  };

  const mockApi = {
    tx: {
      atomicTradeEngine: {
        createBatch: jest.fn().mockReturnValue(mockSubmittable),
        executeBatch: jest.fn().mockReturnValue(mockSubmittable),
        cancelBatch: jest.fn().mockReturnValue(mockSubmittable),
      },
    },
    query: {
      atomicTradeEngine: {
        batches: jest.fn().mockResolvedValue({
          toJSON: () => ({
            id: 'batch-1',
            legs: [{ fromVm: 'Evm', toVm: 'Svm', amount: 100 }],
            status: 'Pending',
          }),
        }),
      },
    },
  } as any;

  beforeEach(() => {
    client = new X3AtomicTradeClient(mockApi);
    jest.clearAllMocks();
  });

  test('createBatch builds extrinsic from legs', () => {
    const legs = [
      { fromVm: X3VmType.Evm, toVm: X3VmType.Svm, fromAsset: 'USDC', toAsset: 'SOL', amount: 100, minOut: 1 },
    ];
    const ext = client.createBatch(legs);
    expect(ext).toBeDefined();
    expect(mockApi.tx.atomicTradeEngine.createBatch).toHaveBeenCalled();
  });

  test('executeBatch builds extrinsic', () => {
    const ext = client.executeBatch('batch-1');
    expect(ext).toBeDefined();
    expect(mockApi.tx.atomicTradeEngine.executeBatch).toHaveBeenCalledWith('batch-1');
  });

  test('cancelBatch builds extrinsic', () => {
    const ext = client.cancelBatch('batch-1');
    expect(ext).toBeDefined();
    expect(mockApi.tx.atomicTradeEngine.cancelBatch).toHaveBeenCalledWith('batch-1');
  });

  test('getBatch queries storage', async () => {
    const batch = await client.getBatch('batch-1');
    expect(batch).toBeDefined();
    expect(batch.id).toBe('batch-1');
    expect(mockApi.query.atomicTradeEngine.batches).toHaveBeenCalledWith('batch-1');
  });
});

// =============================================================================
// X3DomainClient Tests
// =============================================================================

describe('X3DomainClient', () => {
  let client: X3DomainClient;

  const mockSubmittable = { signAndSend: jest.fn() };

  const mockApi = {
    tx: {
      x3DomainRegistry: {
        registerDomain: jest.fn().mockReturnValue(mockSubmittable),
        setRecords: jest.fn().mockReturnValue(mockSubmittable),
      },
    },
    query: {
      x3DomainRegistry: {
        domains: jest.fn().mockResolvedValue({
          isSome: true,
          unwrap: () => ({ toJSON: () => ({ name: 'alice.x3', owner: 'alice-addr', records: {} }) }),
        }),
      },
    },
  } as any;

  beforeEach(() => {
    client = new X3DomainClient(mockApi);
    jest.clearAllMocks();
  });

  test('register builds extrinsic', () => {
    const ext = client.register('alice.x3');
    expect(ext).toBeDefined();
    expect(mockApi.tx.x3DomainRegistry.registerDomain).toHaveBeenCalledWith('alice.x3');
  });

  test('setRecords builds extrinsic', () => {
    const ext = client.setRecords('alice.x3', [{ key: 'evm', value: '0xabc' }]);
    expect(ext).toBeDefined();
    expect(mockApi.tx.x3DomainRegistry.setRecords).toHaveBeenCalled();
  });

  test('lookup queries storage', async () => {
    const result = await client.lookup('alice.x3');
    expect(result).toBeDefined();
    expect(result.name).toBe('alice.x3');
    expect(mockApi.query.x3DomainRegistry.domains).toHaveBeenCalledWith('alice.x3');
  });

  test('isAvailable returns true for unregistered domain', async () => {
    mockApi.query.x3DomainRegistry.domains.mockResolvedValueOnce({
      isSome: false,
    });
    const available = await client.isAvailable('new-name.x3');
    expect(available).toBe(true);
  });
});

// =============================================================================
// X3VerifierClient Tests
// =============================================================================

describe('X3VerifierClient', () => {
  let client: X3VerifierClient;

  const mockSubmittable = { signAndSend: jest.fn() };

  const mockApi = {
    tx: {
      x3Verifier: {
        registerExecutor: jest.fn().mockReturnValue(mockSubmittable),
        submitJob: jest.fn().mockReturnValue(mockSubmittable),
        submitReceipt: jest.fn().mockReturnValue(mockSubmittable),
        disputeReceipt: jest.fn().mockReturnValue(mockSubmittable),
      },
    },
    query: {
      x3Verifier: {
        jobs: jest.fn().mockResolvedValue({
          toJSON: () => ({ id: 'job-1', wasm: '0x00', status: 'Pending' }),
        }),
        executors: jest.fn().mockResolvedValue({
          toJSON: () => ({ id: 'executor-1', active: true, stake: 10000 }),
        }),
      },
    },
  } as any;

  beforeEach(() => {
    client = new X3VerifierClient(mockApi);
    jest.clearAllMocks();
  });

  test('registerExecutor builds extrinsic', () => {
    const ext = client.registerExecutor('executor-1', 10000);
    expect(ext).toBeDefined();
    expect(mockApi.tx.x3Verifier.registerExecutor).toHaveBeenCalledWith('executor-1', 10000);
  });

  test('submitJob builds extrinsic', () => {
    const ext = client.submitJob('0x00', { gasLimit: 1000000 });
    expect(ext).toBeDefined();
    expect(mockApi.tx.x3Verifier.submitJob).toHaveBeenCalled();
  });

  test('getJob queries storage', async () => {
    const job = await client.getJob('job-1');
    expect(job).toBeDefined();
    expect(job.id).toBe('job-1');
    expect(mockApi.query.x3Verifier.jobs).toHaveBeenCalledWith('job-1');
  });

  test('getExecutor queries storage', async () => {
    const exec = await client.getExecutor('executor-1');
    expect(exec.active).toBe(true);
    expect(mockApi.query.x3Verifier.executors).toHaveBeenCalledWith('executor-1');
  });
});
