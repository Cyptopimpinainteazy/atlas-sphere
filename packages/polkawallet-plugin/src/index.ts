/**
 * @module @atlas-sphere/polkawallet-plugin
 *
 * Polkawallet JS API plugin for Atlas Sphere x3chain.
 *
 * Provides full integration with:
 * - Atlas Kernel (Comit submission, tri-VM execution)
 * - X3 Settlement Engine (cross-chain atomic settlement, BTC light-client)
 * - Atomic Trade Engine (multi-leg DeFi trades across EVM/SVM/X3)
 * - X3 Domain Registry (.x3 domains)
 * - X3 Verifier (off-chain execution verification)
 * - X3VM (compile, deploy, call x3 lang contracts, flash loans)
 * - Governance (conviction voting, AI governance, kill switch)
 * - Treasury (multi-sig spending, yield strategies)
 * - SVM Runtime (Solana VM on Atlas)
 *
 * @example
 * ```typescript
 * import { AtlasX3Plugin } from '@atlas-sphere/polkawallet-plugin';
 *
 * const plugin = new AtlasX3Plugin({ endpoint: 'ws://localhost:9944' });
 * await plugin.init();
 *
 * // Atomic swap across chains
 * await plugin.settlement.createIntent(account, {
 *   taker: '5GrwvaEF...',
 *   assetA: { chain: 'Atlas', assetId: 'ATLAS', amount: 1000n },
 *   assetB: { chain: 'Ethereum', assetId: 'USDC', amount: 500n },
 *   secretHash: '0x...',
 * });
 *
 * // Multi-leg DEX trade
 * await plugin.trades.swap(account, {
 *   ammProtocol: 'AtlasNative',
 *   vmType: 'X3',
 *   assetIn: '0x...ATLAS',
 *   assetOut: '0x...USDC',
 *   amountIn: 1000n,
 *   minAmountOut: 950n,
 * });
 *
 * // Deploy x3 contract
 * const compiled = await plugin.x3vm.compile('contract MyToken { ... }');
 * await plugin.x3vm.deploy(account, compiled.bytecode);
 *
 * // Register .x3 domain
 * await plugin.domains.registerDomain(account, 'myapp.x3');
 * ```
 */

// Main plugin
export {
  AtlasX3Plugin,
  createLocalPlugin,
  createTestnetPlugin,
  createMainnetPlugin,
} from './plugin';

// Core
export { X3ChainApi, createX3Api, signAndSend, estimateFee, batchTx } from './core';
export type { SignerAccount, ApiEvents } from './core';

// Services
export { KernelService } from './services/kernel';
export { SettlementService } from './services/settlement';
export { AtomicTradeService } from './services/trades';
export { DomainService } from './services/domains';
export { VerifierService } from './services/verifier';
export { GovernanceService } from './services/governance';
export { TreasuryService } from './services/treasury';
export { SvmService } from './services/svm';

// X3VM
export { X3VmClient } from './x3vm';
export type {
  X3CompileResult,
  X3ContractAbi,
  X3Function,
  X3Param,
  X3Event,
  X3Error,
  X3DeployResult,
  X3CallParams,
  X3CallResult,
} from './x3vm';

// Runtime types (for custom API configurations)
export { X3ChainCustomTypes, X3ChainRpc, X3ChainSignedExtensions } from './types';

// All TypeScript interfaces
export type {
  X3ChainConfig,
  X3Network,
  ConnectionState,
  X3Account,
  X3Balance,
  ComitParams,
  ComitResult,
  ComitEvent,
  CreateIntentParams,
  AssetSpec,
  ExternalChainId,
  IntentState,
  SettlementIntentInfo,
  LockEscrowParams,
  BtcProofParams,
  BtcBlockHeader,
  BondParams,
  CreateTradeBatchParams,
  TradeLegInput,
  VmType,
  AmmProtocol,
  TradeBatchStatus,
  TradeBatchInfo,
  TradeResult,
  TradeLegResult,
  RegisterDomainParams,
  SetRecordsParams,
  X3DnsRecord,
  X3RecordData,
  DomainInfo,
  RegisterExecutorParams,
  SubmitJobParams,
  SubmitReceiptParams,
  JobStatus,
  JobInfo,
  SubmitProposalParams,
  VoteParams,
  DelegateParams,
  VoteDirection,
  ConvictionLevel,
  AIProposalParams,
  AIProposalType,
  ImpactAssessment,
  SimulationRequirements,
  KillSwitchLevel,
  TreasuryProposalParams,
  RecurringPaymentParams,
  YieldStrategyParams,
  RiskLevel,
  SvmCreateAccountParams,
  SvmDeployProgramParams,
  SvmTransferParams,
  EventCallback,
  UnsubscribeFn,
  TxStatus,
  TxStatusCallback,
} from './types';
