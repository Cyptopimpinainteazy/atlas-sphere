import winston from 'winston';
import { Connection } from '@solana/web3.js';

// Export types and interfaces
export * from './types';

// Export new Solana DEX services
export { AldrinService } from './solana/AldrinService';
export { SaberService } from './solana/SaberService';
export { LifinityService } from './solana/LifinityService';
export { InvariantService } from './solana/InvariantService';
export { CropperService } from './solana/CropperService';
export { SoldexService } from './solana/SoldexService';
export { AtrixService } from './solana/AtrixService';

// Factory functions for each new DEX service
export function createAldrinService(
  connection: Connection,
  logger: winston.Logger,
  config?: any
) {
  const { AldrinService } = require('./solana/AldrinService');
  const defaultConfig = {
    enabled: process.env.ALDRIN_ENABLED !== 'false',
    priority: 5,
    maxSlippage: 500, // 5%
    maxPriceImpact: 10, // 10%
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    ammProgramId: process.env.ALDRIN_AMM_PROGRAM || '',
    farmProgramId: process.env.ALDRIN_FARM_PROGRAM,
    clobProgramId: process.env.ALDRIN_CLOB_PROGRAM,
    apiUrl: process.env.ALDRIN_API_URL,
    useSDK: true,
    features: {
      arbitrage: true,
      flashLoans: false,
      liquidityProvision: true,
      staking: true,
      farming: true,
    },
  };

  return new AldrinService(connection, logger, { ...defaultConfig, ...config });
}

export function createSaberService(
  connection: Connection,
  logger: winston.Logger,
  config?: any
) {
  const { SaberService } = require('./solana/SaberService');
  const defaultConfig = {
    enabled: process.env.SABER_ENABLED !== 'false',
    priority: 6,
    maxSlippage: 100, // Lower slippage for stablecoins
    maxPriceImpact: 2,
    timeout: 30000,
    retryAttempts: parseInt(process.env.SABER_MAX_RETRIES || '3'),
    retryDelay: 1000,
    stableswapProgramId: process.env.SABER_STABLESWAP_PROGRAM || 'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ',
    decimalsProgramId: process.env.SABER_DECIMALS_PROGRAM,
    registryUrl: process.env.SABER_REGISTRY_URL || 'https://registry.saber.so/data/pools-info.mainnet.json',
    useRegistry: true,
    features: {
      arbitrage: true,
      flashLoans: false,
      liquidityProvision: true,
      staking: false,
      farming: false,
    },
  };

  return new SaberService(connection, logger, { ...defaultConfig, ...config });
}

export function createLifinityService(
  connection: Connection,
  logger: winston.Logger,
  config?: any
) {
  const { LifinityService } = require('./solana/LifinityService');
  const defaultConfig = {
    enabled: process.env.LIFINITY_ENABLED !== 'false',
    priority: 4,
    maxSlippage: 300,
    maxPriceImpact: 5,
    timeout: 30000,
    retryAttempts: parseInt(process.env.LIFINITY_MAX_RETRIES || '3'),
    retryDelay: 1000,
    programId: process.env.LIFINITY_PROGRAM, // Will be resolved from SDK
    useSDK: true,
    features: {
      arbitrage: true,
      flashLoans: true,
      liquidityProvision: true,
      staking: false,
      farming: false,
    },
  };

  return new LifinityService(connection, logger, { ...defaultConfig, ...config });
}

export function createInvariantService(
  connection: Connection,
  logger: winston.Logger,
  config?: any
) {
  const { InvariantService } = require('./solana/InvariantService');
  const defaultConfig = {
    enabled: process.env.INVARIANT_ENABLED !== 'false',
    priority: 3,
    maxSlippage: 200,
    maxPriceImpact: 3,
    timeout: 30000,
    retryAttempts: parseInt(process.env.INVARIANT_MAX_RETRIES || '3'),
    retryDelay: 1000,
    programId: process.env.INVARIANT_PROGRAM || '48XDC18nH5FLq8kKfE6MJK2hcPFD7xsJQc4dSAgQWNAi',
    useSDK: true,
    features: {
      arbitrage: true,
      flashLoans: false,
      liquidityProvision: true,
      staking: false,
      farming: false,
    },
  };

  return new InvariantService(connection, logger, { ...defaultConfig, ...config });
}

export function createCropperService(
  connection: Connection,
  logger: winston.Logger,
  config?: any
) {
  const { CropperService } = require('./solana/CropperService');
  const defaultConfig = {
    enabled: process.env.CROPPER_ENABLED !== 'false',
    priority: 7,
    maxSlippage: 500,
    maxPriceImpact: 10,
    timeout: 30000,
    retryAttempts: parseInt(process.env.CROPPER_MAX_RETRIES || '3'),
    retryDelay: 1000,
    ammProgramId: process.env.CROPPER_AMM_PROGRAM || 'H8W3ctz92svYg6mkn1UtGfu2aQr2fnUFHM1RhScEtQDt',
    legacyAmmProgramId: process.env.CROPPER_LEGACY_AMM_PROGRAM,
    supportLegacy: true,
    features: {
      arbitrage: true,
      flashLoans: false,
      liquidityProvision: true,
      staking: true,
      farming: true,
    },
  };

  return new CropperService(connection, logger, { ...defaultConfig, ...config });
}

export function createSoldexService(
  connection: Connection,
  logger: winston.Logger,
  config?: any
) {
  const { SoldexService } = require('./solana/SoldexService');
  const defaultConfig = {
    enabled: false, // Disabled until program ID is confirmed
    priority: 8,
    maxSlippage: 500,
    maxPriceImpact: 10,
    timeout: 30000,
    retryAttempts: parseInt(process.env.SOLDEX_MAX_RETRIES || '3'),
    retryDelay: 1000,
    ammProgramId: undefined, // TBD - research required
    placeholder: true,
    features: {
      arbitrage: false,
      flashLoans: false,
      liquidityProvision: false,
      staking: false,
      farming: false,
    },
  };

  return new SoldexService(connection, logger, { ...defaultConfig, ...config });
}

export function createAtrixService(
  connection: Connection,
  logger: winston.Logger,
  config?: any
) {
  const { AtrixService } = require('./solana/AtrixService');
  const defaultConfig = {
    enabled: false, // Disabled until program IDs are confirmed
    priority: 9,
    maxSlippage: 500,
    maxPriceImpact: 10,
    timeout: 30000,
    retryAttempts: parseInt(process.env.ATRIX_MAX_RETRIES || '3'),
    retryDelay: 1000,
    poolProgramId: undefined, // TBD - research required
    farmProgramId: undefined, // TBD - research required
    placeholder: true,
    features: {
      arbitrage: false,
      flashLoans: false,
      liquidityProvision: false,
      staking: false,
      farming: false,
    },
  };

  return new AtrixService(connection, logger, { ...defaultConfig, ...config });
}
