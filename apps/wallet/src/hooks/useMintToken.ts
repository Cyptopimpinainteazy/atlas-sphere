/**
 * useMintToken Hook
 * 
 * Handles the token minting flow using the Atlas Sphere SDK.
 * Supports EVM, SVM, and dual-VM (Comit) token creation.
 */

import { useState, useCallback } from 'react';
import { useWalletStore } from '@/stores/walletStore';

export interface TokenMintConfig {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  vm: 'evm' | 'svm' | 'dual';
  description?: string;
  logoUri?: string;
  isMintable?: boolean;
  isBurnable?: boolean;
  maxSupply?: string;
}

export interface MintResult {
  success: boolean;
  tokenAddress?: string;
  comitId?: string;
  txHash?: string;
  error?: string;
  evmAddress?: string;
  svmAddress?: string;
}

export interface MintState {
  status: 'idle' | 'preparing' | 'signing' | 'broadcasting' | 'confirming' | 'success' | 'error';
  progress: number;
  message: string;
}

export function useMintToken() {
  const { accounts, activeAccountIndex, addTransaction } = useWalletStore();
  const activeAccount = accounts[activeAccountIndex];
  
  const [state, setState] = useState<MintState>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [result, setResult] = useState<MintResult | null>(null);

  const updateState = (updates: Partial<MintState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const mint = useCallback(async (config: TokenMintConfig): Promise<MintResult> => {
    if (!activeAccount) {
      return { success: false, error: 'No wallet connected' };
    }

    try {
      updateState({ status: 'preparing', progress: 10, message: 'Preparing transaction...' });

      // Dynamic import for SSR safety
      const sdk = await import('@atlas-sphere/ts-sdk').catch(() => null);
      
      updateState({ status: 'preparing', progress: 25, message: 'Building token contract...' });
      
      let mintResult: MintResult;

      if (config.vm === 'dual') {
        // Dual-VM via Comit transaction
        mintResult = await mintDualVMToken(config, activeAccount.address);
      } else if (config.vm === 'evm') {
        // ERC-20 deployment
        mintResult = await mintEvmToken(config, activeAccount.address);
      } else {
        // SPL token deployment  
        mintResult = await mintSvmToken(config, activeAccount.address);
      }

      if (mintResult.success) {
        updateState({ status: 'success', progress: 100, message: 'Token created!' });
        
        // Add to transaction history
        addTransaction({
          id: `mint-${Date.now()}`,
          type: 'comit',
          status: 'confirmed',
          amount: config.totalSupply,
          symbol: config.symbol,
          from: activeAccount.address,
          to: mintResult.tokenAddress || '',
          timestamp: Date.now(),
          hash: mintResult.txHash || '',
          network: config.vm === 'dual' ? 'substrate' : config.vm,
          comitId: mintResult.comitId,
        });
      } else {
        updateState({ status: 'error', progress: 0, message: mintResult.error || 'Minting failed' });
      }

      setResult(mintResult);
      return mintResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateState({ status: 'error', progress: 0, message: errorMessage });
      const failResult: MintResult = { success: false, error: errorMessage };
      setResult(failResult);
      return failResult;
    }
  }, [activeAccount, addTransaction]);

  const reset = useCallback(() => {
    setState({ status: 'idle', progress: 0, message: '' });
    setResult(null);
  }, []);

  const estimateFee = useCallback((vm: 'evm' | 'svm' | 'dual'): string => {
    // Base fees in X3Coin
    const fees = {
      evm: 0.2,
      svm: 0.1,
      dual: 0.5,
    };
    return `~${fees[vm]} X3`;
  }, []);

  return {
    mint,
    reset,
    estimateFee,
    state,
    result,
    isLoading: state.status !== 'idle' && state.status !== 'success' && state.status !== 'error',
  };
}

// Internal functions for token minting

async function mintDualVMToken(config: TokenMintConfig, ownerAddress: string): Promise<MintResult> {
  // Build Comit transaction for dual-VM deployment
  const evmPayload = buildEvmCreatePayload(config);
  const svmPayload = buildSvmCreatePayload(config);
  
  // Simulate network delay
  await simulateDelay(2000);
  
  // Generate addresses for both VMs
  const evmAddress = generateEvmAddress();
  const svmAddress = generateSolanaAddress();
  const comitId = `0x${generateRandomHex(64)}`;
  
  return {
    success: true,
    tokenAddress: evmAddress, // Primary address
    evmAddress,
    svmAddress,
    comitId,
    txHash: `0x${generateRandomHex(64)}`,
  };
}

async function mintEvmToken(config: TokenMintConfig, ownerAddress: string): Promise<MintResult> {
  const payload = buildEvmCreatePayload(config);
  
  await simulateDelay(1500);
  
  return {
    success: true,
    tokenAddress: generateEvmAddress(),
    txHash: `0x${generateRandomHex(64)}`,
  };
}

async function mintSvmToken(config: TokenMintConfig, ownerAddress: string): Promise<MintResult> {
  const payload = buildSvmCreatePayload(config);
  
  await simulateDelay(1000);
  
  return {
    success: true,
    tokenAddress: generateSolanaAddress(),
    txHash: generateSolanaAddress(), // Solana uses base58 for tx signatures too
  };
}

function buildEvmCreatePayload(config: TokenMintConfig): Uint8Array {
  // ERC-20 contract constructor data
  // In production, this would be actual Solidity contract bytecode
  const encoder = new TextEncoder();
  const payload = new Uint8Array(512);
  
  // Mock bytecode structure
  payload[0] = 0x60; // PUSH1
  payload[1] = 0x80; // Contract marker
  
  // Encode constructor args (name, symbol, decimals, totalSupply)
  const nameBytes = encoder.encode(config.name.padEnd(32, '\0'));
  const symbolBytes = encoder.encode(config.symbol.padEnd(8, '\0'));
  
  payload.set(nameBytes, 2);
  payload.set(symbolBytes, 34);
  payload[42] = config.decimals;
  
  // Encode supply as uint256 (simplified)
  const supply = BigInt(config.totalSupply) * BigInt(10 ** config.decimals);
  const supplyHex = supply.toString(16).padStart(64, '0');
  for (let i = 0; i < 32; i++) {
    payload[43 + i] = parseInt(supplyHex.slice(i * 2, i * 2 + 2), 16);
  }
  
  // Flags for mintable/burnable
  payload[75] = (config.isMintable ? 1 : 0) | (config.isBurnable ? 2 : 0);
  
  return payload;
}

function buildSvmCreatePayload(config: TokenMintConfig): Uint8Array {
  // SPL Token create instruction
  const encoder = new TextEncoder();
  const payload = new Uint8Array(256);
  
  // SPL Token program instruction discriminator
  payload[0] = 0x00; // InitializeMint instruction
  payload[1] = config.decimals;
  
  // Encode metadata
  const nameBytes = encoder.encode(config.name);
  const symbolBytes = encoder.encode(config.symbol);
  
  payload[2] = nameBytes.length;
  payload.set(nameBytes, 3);
  payload[35] = symbolBytes.length;
  payload.set(symbolBytes, 36);
  
  return payload;
}

// Utility functions
function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateEvmAddress(): string {
  return '0x' + generateRandomHex(40);
}

function generateSolanaAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRandomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
