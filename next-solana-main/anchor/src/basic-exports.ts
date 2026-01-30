// Here we export some useful types and functions for interacting with the Anchor program.
import { address } from 'gill'
import { SolanaClusterId } from '@wallet-ui/react'
import { BASIC_PROGRAM_ADDRESS, getInitializeInstruction } from './client/js'
import BasicIDL from '../target/idl/basic.json'

// Re-export the generated IDL and type
export { BasicIDL }

// This is a helper function to get the program ID for the Basic program depending on the cluster.
export function getBasicProgramId(cluster: SolanaClusterId) {
  switch (cluster) {
    case 'solana:devnet':
    case 'solana:testnet':
      // This is the program ID for the Basic program on devnet and testnet.
      return address('6z68wfurCMYkZG51s1Et9BJEd9nJGUusjHXNt4dGbNNF')
    case 'solana:mainnet':
    default:
      return BASIC_PROGRAM_ADDRESS
  }
}

// Backwards-compatible wrapper: older UI/tests call this “greet”, but the
// generated client exposes it as `getInitializeInstruction`.
export function getGreetInstruction(config?: { programAddress?: unknown; user?: unknown }) {
  return getInitializeInstruction({ programAddress: config?.programAddress as never })
}

export * from './client/js'
