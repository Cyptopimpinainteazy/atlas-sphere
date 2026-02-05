/**
 * X3VM TypeScript Client for Solana
 *
 * Provides interface to deploy and execute X3 bytecode programs on Solana
 * using the x3vm-executor Anchor program.
 */

import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type * as anchor from '@coral-xyz/anchor';
import { z } from 'zod';

// X3BC Magic bytes
export const X3BC_MAGIC = new Uint8Array([0x58, 0x33, 0x42, 0x43]); // "X3BC"

// X3VM Program ID (update after deployment)
export const X3VM_PROGRAM_ID = new PublicKey('X3vmExec11111111111111111111111111111111111');

// Schemas
export const X3VMProgramSchema = z.object({
  authority: z.string(),
  name: z.string(),
  bytecode: z.instanceof(Uint8Array),
  executionCount: z.number(),
  totalGasUsed: z.number(),
  createdAt: z.number(),
});

export const X3VMExecutionResultSchema = z.object({
  program: z.string(),
  executor: z.string(),
  functionIndex: z.number(),
  returnValue: z.number().nullable(),
  gasUsed: z.number(),
  success: z.boolean(),
  isAtomic: z.boolean(),
  executedAt: z.number(),
});

export type X3VMProgram = z.infer<typeof X3VMProgramSchema>;
export type X3VMExecutionResult = z.infer<typeof X3VMExecutionResultSchema>;

// Opcode definitions matching Rust x3-backend/src/opcode.rs
export const Opcodes = {
  // Control Flow
  Nop: 0x00,
  Jump: 0x01,
  JumpIf: 0x02,
  JumpUnless: 0x03,
  Call: 0x04,
  Ret: 0x05,
  RetVoid: 0x06,
  Halt: 0x07,

  // Load/Store
  LoadConst: 0x10,
  Mov: 0x11,
  LoadImm: 0x18,
  LoadZero: 0x19,
  LoadTrue: 0x1a,
  LoadFalse: 0x1b,

  // Integer Arithmetic
  AddI: 0x20,
  SubI: 0x21,
  MulI: 0x22,
  DivI: 0x23,
  ModI: 0x24,
  NegI: 0x25,

  // Comparisons
  EqI: 0x40,
  NeI: 0x41,
  LtI: 0x42,
  LeI: 0x43,
  GtI: 0x44,
  GeI: 0x45,

  // Bitwise
  And: 0x50,
  Or: 0x51,
  Xor: 0x52,
  Shl: 0x54,
  Shr: 0x55,
} as const;

/**
 * X3 Bytecode Builder - helper to create X3BC modules
 */
export class X3BytecodeBuilder {
  private code: number[] = [];
  private version: number = 1;
  private flags: number = 0;

  constructor() {}

  /**
   * Build the final bytecode with header
   */
  build(): Uint8Array {
    const header = [
      ...X3BC_MAGIC,
      ...this.u32ToBytes(this.version),
      ...this.u32ToBytes(this.flags),
    ];
    return new Uint8Array([...header, ...this.code]);
  }

  // Control flow
  nop(): this {
    this.code.push(Opcodes.Nop);
    return this;
  }

  halt(): this {
    this.code.push(Opcodes.Halt);
    return this;
  }

  ret(reg: number): this {
    this.code.push(Opcodes.Ret, reg);
    return this;
  }

  retVoid(): this {
    this.code.push(Opcodes.RetVoid);
    return this;
  }

  jump(target: number): this {
    this.code.push(Opcodes.Jump, ...this.u32ToBytes(target));
    return this;
  }

  jumpIf(condReg: number, target: number): this {
    this.code.push(Opcodes.JumpIf, condReg, ...this.u32ToBytes(target));
    return this;
  }

  jumpUnless(condReg: number, target: number): this {
    this.code.push(Opcodes.JumpUnless, condReg, ...this.u32ToBytes(target));
    return this;
  }

  // Load/Store
  loadImm(dst: number, value: number): this {
    this.code.push(Opcodes.LoadImm, dst, value & 0xff);
    return this;
  }

  loadConst(dst: number, value: number): this {
    this.code.push(Opcodes.LoadConst, dst, ...this.i32ToBytes(value));
    return this;
  }

  loadZero(dst: number): this {
    this.code.push(Opcodes.LoadZero, dst);
    return this;
  }

  loadTrue(dst: number): this {
    this.code.push(Opcodes.LoadTrue, dst);
    return this;
  }

  loadFalse(dst: number): this {
    this.code.push(Opcodes.LoadFalse, dst);
    return this;
  }

  mov(dst: number, src: number): this {
    this.code.push(Opcodes.Mov, dst, src);
    return this;
  }

  // Arithmetic
  addI(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.AddI, dst, a, b);
    return this;
  }

  subI(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.SubI, dst, a, b);
    return this;
  }

  mulI(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.MulI, dst, a, b);
    return this;
  }

  divI(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.DivI, dst, a, b);
    return this;
  }

  modI(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.ModI, dst, a, b);
    return this;
  }

  negI(dst: number, src: number): this {
    this.code.push(Opcodes.NegI, dst, src);
    return this;
  }

  // Comparisons
  eqI(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.EqI, dst, a, b);
    return this;
  }

  ltI(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.LtI, dst, a, b);
    return this;
  }

  gtI(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.GtI, dst, a, b);
    return this;
  }

  // Bitwise
  and(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.And, dst, a, b);
    return this;
  }

  or(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.Or, dst, a, b);
    return this;
  }

  xor(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.Xor, dst, a, b);
    return this;
  }

  shl(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.Shl, dst, a, b);
    return this;
  }

  shr(dst: number, a: number, b: number): this {
    this.code.push(Opcodes.Shr, dst, a, b);
    return this;
  }

  // Helpers
  private u32ToBytes(n: number): number[] {
    return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
  }

  private i32ToBytes(n: number): number[] {
    return this.u32ToBytes(n >>> 0);
  }

  /**
   * Get current code offset (for calculating jump targets)
   */
  currentOffset(): number {
    return 12 + this.code.length; // Header is 12 bytes
  }
}

/**
 * X3VM Client Configuration
 */
export interface X3VMClientConfig {
  connection: Connection;
  programId?: PublicKey;
}

/**
 * X3VM Client for interacting with X3VM programs on Solana
 */
export class X3VMClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(config: X3VMClientConfig) {
    this.connection = config.connection;
    this.programId = config.programId ?? X3VM_PROGRAM_ID;
  }

  /**
   * Get program PDA
   */
  getProgramPDA(authority: PublicKey, name: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('x3vm_program'), authority.toBuffer(), Buffer.from(name)],
      this.programId
    );
  }

  /**
   * Get execution result PDA
   */
  getExecutionResultPDA(
    programPDA: PublicKey,
    executor: PublicKey,
    executionCount: bigint
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('x3vm_result'),
        programPDA.toBuffer(),
        executor.toBuffer(),
        Buffer.from(executionCount.toString()),
      ],
      this.programId
    );
  }

  /**
   * Validate X3 bytecode
   */
  validateBytecode(bytecode: Uint8Array): { valid: boolean; error?: string } {
    if (bytecode.length < 12) {
      return { valid: false, error: 'Bytecode too short (minimum 12 bytes for header)' };
    }

    // Check magic
    for (let i = 0; i < 4; i++) {
      if (bytecode[i] !== X3BC_MAGIC[i]) {
        return { valid: false, error: 'Invalid X3BC magic bytes' };
      }
    }

    // Check size
    if (bytecode.length > 16 * 1024) {
      return { valid: false, error: 'Bytecode exceeds maximum size (16KB)' };
    }

    return { valid: true };
  }

  /**
   * Estimate gas for bytecode execution (rough estimate)
   */
  estimateGas(bytecode: Uint8Array): number {
    // Simple estimation based on code size
    const codeSize = bytecode.length - 12; // Subtract header
    return Math.ceil(codeSize * 10); // ~10 gas per byte average
  }
}

/**
 * Create a simple X3 program that adds two numbers
 */
export function createAddProgram(): Uint8Array {
  return new X3BytecodeBuilder()
    .addI(0, 0, 1) // r0 = r0 + r1 (args are in r0 and r1)
    .ret(0) // return r0
    .build();
}

/**
 * Create a simple X3 program that computes factorial
 */
export function createFactorialProgram(): Uint8Array {
  const builder = new X3BytecodeBuilder();

  // r0 = input n
  // r1 = result (accumulator)
  // r2 = constant 1

  builder
    .loadImm(1, 1) // r1 = 1 (result)
    .loadImm(2, 1) // r2 = 1 (constant for decrement and comparison)
    // Loop start (offset will be at byte 12 + 6 = 18 after header)
    .ltI(3, 0, 2) // r3 = (n < 1)
    .jumpIf(3, builder.currentOffset() + 14) // if n < 1, jump to end
    .mulI(1, 1, 0) // r1 = r1 * n
    .subI(0, 0, 2) // n = n - 1
    .jump(18) // jump back to loop start (after header)
    .mov(0, 1) // r0 = r1 (result)
    .ret(0); // return r0

  return builder.build();
}

/**
 * Create a simple X3 program that computes fibonacci
 */
export function createFibonacciProgram(): Uint8Array {
  const builder = new X3BytecodeBuilder();

  // r0 = input n
  // r1 = fib(n-1)
  // r2 = fib(n-2)
  // r3 = temp

  builder
    .loadImm(1, 0) // r1 = 0 (fib[0])
    .loadImm(2, 1) // r2 = 1 (fib[1])
    .loadImm(4, 1) // r4 = 1 (constant)
    // Loop
    .ltI(3, 0, 4) // r3 = (n < 1)
    .jumpIf(3, builder.currentOffset() + 20) // if n < 1, done
    .mov(3, 1) // temp = fib[n-1]
    .addI(1, 1, 2) // fib[n-1] = fib[n-1] + fib[n-2]
    .mov(2, 3) // fib[n-2] = temp
    .subI(0, 0, 4) // n--
    .jump(builder.currentOffset() - 24) // loop back
    .mov(0, 1) // r0 = result
    .ret(0);

  return builder.build();
}

// Export types and utilities
export type { Connection, PublicKey };
export { SystemProgram, LAMPORTS_PER_SOL };
