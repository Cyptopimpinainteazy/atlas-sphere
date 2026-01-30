/**
 * X3VM React Hooks for Next.js
 *
 * Provides React hooks for interacting with X3VM programs on Solana.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useWalletUi } from '@wallet-ui/react';
import { PublicKey } from '@solana/web3.js';
import {
  X3BytecodeBuilder,
  X3BC_MAGIC,
  X3VM_PROGRAM_ID,
  createAddProgram,
  createFactorialProgram,
  createFibonacciProgram,
} from '@/lib/x3vm-client';
import type { X3VMProgram, X3VMExecutionResult } from '@/lib/x3vm-client';

// Re-export utilities
export {
  X3BytecodeBuilder,
  X3BC_MAGIC,
  createAddProgram,
  createFactorialProgram,
  createFibonacciProgram,
};

export interface UseX3VMOptions {
  programId?: string;
}

export interface X3VMState {
  isLoading: boolean;
  error: string | null;
  programs: X3VMProgram[];
  lastResult: X3VMExecutionResult | null;
}

export interface X3VMActions {
  validateBytecode: (bytecode: Uint8Array) => { valid: boolean; error?: string };
  estimateGas: (bytecode: Uint8Array) => number;
  deployProgram: (name: string, bytecode: Uint8Array) => Promise<string | null>;
  executeProgram: (
    programAddress: string,
    functionIndex: number,
    args: bigint[],
    gasLimit?: bigint
  ) => Promise<X3VMExecutionResult | null>;
  clearError: () => void;
}

/**
 * Validate X3 bytecode
 */
function validateBytecodeImpl(bytecode: Uint8Array): { valid: boolean; error?: string } {
  // Check minimum size (12 byte header)
  if (bytecode.length < 12) {
    return { valid: false, error: 'Bytecode too small (min 12 bytes for header)' };
  }

  // Check magic bytes "X3BC"
  if (
    bytecode[0] !== 0x58 ||
    bytecode[1] !== 0x33 ||
    bytecode[2] !== 0x42 ||
    bytecode[3] !== 0x43
  ) {
    return { valid: false, error: 'Invalid magic bytes (expected X3BC)' };
  }

  // Check version (bytes 4-7, little-endian u32)
  const version =
    bytecode[4] | (bytecode[5] << 8) | (bytecode[6] << 16) | (bytecode[7] << 24);
  if (version !== 1) {
    return { valid: false, error: `Unsupported version: ${version}` };
  }

  // Check max size (16KB for on-chain)
  if (bytecode.length > 16 * 1024) {
    return { valid: false, error: 'Bytecode too large (max 16KB)' };
  }

  return { valid: true };
}

/**
 * Estimate gas for bytecode
 */
function estimateGasImpl(bytecode: Uint8Array): number {
  // Basic estimation: 10 gas per byte + base cost
  const baseCost = 1000;
  const perByte = 10;
  return baseCost + bytecode.length * perByte;
}

/**
 * Get program PDA
 */
function getProgramPDA(authority: PublicKey, programName: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('x3vm_program'), authority.toBuffer(), Buffer.from(programName)],
    X3VM_PROGRAM_ID
  );
}

/**
 * Main X3VM hook for interacting with X3 programs
 */
export function useX3VM(_options?: UseX3VMOptions): X3VMState & X3VMActions {
  const { account, client } = useWalletUi();

  const [state, setState] = useState<X3VMState>({
    isLoading: false,
    error: null,
    programs: [],
    lastResult: null,
  });

  // Get wallet public key if connected
  const walletPubkey = useMemo(() => {
    if (!account?.address) return null;
    try {
      return new PublicKey(account.address);
    } catch {
      return null;
    }
  }, [account?.address]);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error, isLoading: false }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState((prev) => ({ ...prev, isLoading }));
  }, []);

  /**
   * Validate X3 bytecode locally
   */
  const validateBytecode = useCallback((bytecode: Uint8Array) => {
    return validateBytecodeImpl(bytecode);
  }, []);

  /**
   * Estimate gas for bytecode execution
   */
  const estimateGas = useCallback((bytecode: Uint8Array) => {
    return estimateGasImpl(bytecode);
  }, []);

  /**
   * Deploy a new X3VM program
   */
  const deployProgram = useCallback(
    async (name: string, bytecode: Uint8Array): Promise<string | null> => {
      if (!walletPubkey || !client) {
        setError('Wallet not connected');
        return null;
      }

      const validation = validateBytecodeImpl(bytecode);
      if (!validation.valid) {
        setError(validation.error ?? 'Invalid bytecode');
        return null;
      }

      setLoading(true);

      try {
        // Get program PDA
        const [programPDA] = getProgramPDA(walletPubkey, name);

        // In production, this would call the Anchor program
        // For now, return the PDA address
        console.log('Deploying X3VM program:', {
          name,
          bytecodeSize: bytecode.length,
          programPDA: programPDA.toBase58(),
        });

        setState((prev) => ({
          ...prev,
          isLoading: false,
          programs: [
            ...prev.programs,
            {
              authority: walletPubkey.toBase58(),
              name,
              bytecode,
              executionCount: 0,
              totalGasUsed: 0,
              createdAt: Date.now(),
            },
          ],
        }));

        return programPDA.toBase58();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to deploy program');
        return null;
      }
    },
    [walletPubkey, client, setError, setLoading]
  );

  /**
   * Execute an X3VM program
   */
  const executeProgram = useCallback(
    async (
      programAddress: string,
      functionIndex: number,
      args: bigint[],
      _gasLimit: bigint = BigInt(100000)
    ): Promise<X3VMExecutionResult | null> => {
      if (!walletPubkey || !client) {
        setError('Wallet not connected');
        return null;
      }

      setLoading(true);

      try {
        // Simulate execution locally for now
        // In production, this would call the Anchor program
        console.log('Executing X3VM program:', {
          programAddress,
          functionIndex,
          args: args.map((a) => a.toString()),
        });

        // Mock result
        const result: X3VMExecutionResult = {
          program: programAddress,
          executor: walletPubkey.toBase58(),
          functionIndex,
          returnValue: args.length > 0 ? Number(args[0]) : null,
          gasUsed: 100,
          success: true,
          isAtomic: false,
          executedAt: Date.now(),
        };

        setState((prev) => ({
          ...prev,
          isLoading: false,
          lastResult: result,
        }));

        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Execution failed');
        return null;
      }
    },
    [walletPubkey, client, setError, setLoading]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    validateBytecode,
    estimateGas,
    deployProgram,
    executeProgram,
    clearError,
  };
}

/**
 * Hook for building X3 bytecode interactively
 */
export function useX3BytecodeBuilder() {
  const [builder] = useState(() => new X3BytecodeBuilder());
  const [bytecode, setBytecode] = useState<Uint8Array | null>(null);
  const [instructions, setInstructions] = useState<string[]>([]);

  const addInstruction = useCallback(
    (
      type: string,
      ...args: number[]
    ): { success: boolean; offset: number; bytecode: Uint8Array } => {
      switch (type) {
        case 'nop':
          builder.nop();
          break;
        case 'halt':
          builder.halt();
          break;
        case 'ret':
          builder.ret(args[0] ?? 0);
          break;
        case 'retVoid':
          builder.retVoid();
          break;
        case 'loadImm':
          builder.loadImm(args[0] ?? 0, args[1] ?? 0);
          break;
        case 'loadZero':
          builder.loadZero(args[0] ?? 0);
          break;
        case 'mov':
          builder.mov(args[0] ?? 0, args[1] ?? 0);
          break;
        case 'addI':
          builder.addI(args[0] ?? 0, args[1] ?? 0, args[2] ?? 0);
          break;
        case 'subI':
          builder.subI(args[0] ?? 0, args[1] ?? 0, args[2] ?? 0);
          break;
        case 'mulI':
          builder.mulI(args[0] ?? 0, args[1] ?? 0, args[2] ?? 0);
          break;
        case 'divI':
          builder.divI(args[0] ?? 0, args[1] ?? 0, args[2] ?? 0);
          break;
        case 'eqI':
          builder.eqI(args[0] ?? 0, args[1] ?? 0, args[2] ?? 0);
          break;
        case 'ltI':
          builder.ltI(args[0] ?? 0, args[1] ?? 0, args[2] ?? 0);
          break;
        case 'gtI':
          builder.gtI(args[0] ?? 0, args[1] ?? 0, args[2] ?? 0);
          break;
        default:
          return { success: false, offset: builder.currentOffset(), bytecode: builder.build() };
      }

      const newBytecode = builder.build();
      setBytecode(newBytecode);
      setInstructions((prev) => [...prev, `${type}(${args.join(', ')})`]);

      return { success: true, offset: builder.currentOffset(), bytecode: newBytecode };
    },
    [builder]
  );

  const reset = useCallback(() => {
    setBytecode(null);
    setInstructions([]);
  }, []);

  const build = useCallback(() => {
    const result = builder.build();
    setBytecode(result);
    return result;
  }, [builder]);

  return {
    bytecode,
    instructions,
    currentOffset: builder.currentOffset(),
    addInstruction,
    reset,
    build,
  };
}

/**
 * Hook for using pre-built example programs
 */
export function useX3ExamplePrograms() {
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);

  const programs = useMemo(
    () => ({
      add: {
        name: 'Add',
        description: 'Adds two numbers: r0 + r1',
        bytecode: createAddProgram(),
        expectedInputs: 2,
      },
      factorial: {
        name: 'Factorial',
        description: 'Computes factorial of n',
        bytecode: createFactorialProgram(),
        expectedInputs: 1,
      },
      fibonacci: {
        name: 'Fibonacci',
        description: 'Computes nth Fibonacci number',
        bytecode: createFibonacciProgram(),
        expectedInputs: 1,
      },
    }),
    []
  );

  const getProgram = useCallback(
    (name: keyof typeof programs) => {
      setSelectedProgram(name);
      return programs[name];
    },
    [programs]
  );

  return {
    programs,
    selectedProgram,
    getProgram,
    setSelectedProgram,
  };
}
