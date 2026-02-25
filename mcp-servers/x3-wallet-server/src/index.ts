#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as bip39 from 'bip39';
import { ethers, HDNodeWallet } from 'ethers';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Keyring } from '@polkadot/keyring';
import { mnemonicToMiniSecret } from '@polkadot/util-crypto';
import * as QRCode from 'qrcode';
import * as keytar from 'keytar';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAIN_REGISTRY_PATH = path.join(__dirname, '../data/chains.json');
const RPC_DATABASE_PATH = path.join(__dirname, '../data/rpc_database.json');

let chainRegistry: any[] = [];
let rpcDatabase: any = {};

async function loadData() {
  try {
    if (fs.existsSync(CHAIN_REGISTRY_PATH)) {
      chainRegistry = JSON.parse(fs.readFileSync(CHAIN_REGISTRY_PATH, 'utf-8'));
    }
    if (fs.existsSync(RPC_DATABASE_PATH)) {
      rpcDatabase = JSON.parse(fs.readFileSync(RPC_DATABASE_PATH, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Helper function to create text content response
function textResponse(text: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: text,
      },
    ],
  };
}

// Helper function to create JSON response
function jsonResponse(data: any) {
  return textResponse(JSON.stringify(data, null, 2));
}

// Create server instance
const server = new Server(
  {
    name: 'x3-wallet-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const TOOLS = [
  {
    name: 'generate_mnemonic',
    description: 'Generate a new BIP39 mnemonic phrase',
    inputSchema: {
      type: 'object',
      properties: {
        wordCount: {
          type: 'string',
          enum: ['12', '24'],
          default: '12',
          description: 'Number of words in mnemonic (12 or 24)',
        },
      },
    },
  },
  {
    name: 'derive_addresses',
    description: 'Derive wallet addresses from a mnemonic for EVM, Solana, and Substrate chains',
    inputSchema: {
      type: 'object',
      properties: {
        mnemonic: {
          type: 'string',
          description: 'BIP39 mnemonic phrase',
        },
        chains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific chains to derive for (default: all)',
        },
      },
      required: ['mnemonic'],
    },
  },
  {
    name: 'store_key',
    description: 'Store a key securely in the system keychain',
    inputSchema: {
      type: 'object',
      properties: {
        keyName: {
          type: 'string',
          description: 'Name for the stored key',
        },
        keyValue: {
          type: 'string',
          description: 'Value to store (e.g., mnemonic or private key)',
        },
      },
      required: ['keyName', 'keyValue'],
    },
  },
  {
    name: 'retrieve_key',
    description: 'Retrieve a stored key from the system keychain',
    inputSchema: {
      type: 'object',
      properties: {
        keyName: {
          type: 'string',
          description: 'Name of the stored key',
        },
      },
      required: ['keyName'],
    },
  },
  {
    name: 'generate_qr',
    description: 'Generate a QR code for any data (e.g., wallet address)',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'Data to encode in QR code (e.g., address)',
        },
      },
      required: ['data'],
    },
  },
  {
    name: 'fetch_balance',
    description: 'Fetch the native token balance for an address on a specific chain',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Wallet address',
        },
        chainId: {
          type: 'string',
          description: 'Chain ID from registry',
        },
      },
      required: ['address', 'chainId'],
    },
  },
  {
    name: 'list_chains',
    description: 'List all available chains in the registry',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'validate_address',
    description: 'Validate a wallet address and detect its type',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Wallet address to validate',
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'initiate_swap',
    description: 'Initiate a cross-VM swap between chains (placeholder)',
    inputSchema: {
      type: 'object',
      properties: {
        fromChain: {
          type: 'string',
          description: 'Source chain ID',
        },
        toChain: {
          type: 'string',
          description: 'Destination chain ID',
        },
        amount: {
          type: 'number',
          description: 'Amount to swap',
        },
        fromAsset: {
          type: 'string',
          description: 'Source asset symbol or address',
        },
        toAsset: {
          type: 'string',
          description: 'Destination asset symbol or address',
        },
      },
      required: ['fromChain', 'toChain', 'amount', 'fromAsset', 'toAsset'],
    },
  },
  {
    name: 'execute_x3_script',
    description: 'Execute an x3-lang script (placeholder)',
    inputSchema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'x3-lang script code',
        },
      },
      required: ['script'],
    },
  },
];

// Register tools list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'generate_mnemonic': {
      const wordCount = args?.wordCount || '12';
      const strength = wordCount === '24' ? 256 : 128;
      const mnemonic = bip39.generateMnemonic(strength);
      return jsonResponse({ mnemonic, wordCount: wordCount === '24' ? 24 : 12 });
    }

    case 'derive_addresses': {
      const { mnemonic, chains } = args;
      try {
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        
        // EVM - using HDNodeWallet for ethers v6
        const evmWallet = HDNodeWallet.fromPhrase(mnemonic);
        const evmAddress = evmWallet.address;
        const evmPrivateKey = evmWallet.privateKey;
        
        // Solana
        const solanaSeed = seed.slice(0, 32);
        const solanaKeypair = Keypair.fromSeed(solanaSeed);
        const solanaAddress = solanaKeypair.publicKey.toBase58();
        
        // Substrate (Polkadot example)
        const keyring = new Keyring({ type: 'sr25519' });
        const substratePair = keyring.addFromMnemonic(mnemonic);
        const substrateAddress = substratePair.address;
        
        const addresses = {
          evm: { address: evmAddress, privateKey: evmPrivateKey },
          solana: { address: solanaAddress },
          substrate: { address: substrateAddress },
        };
        
        return jsonResponse(addresses);
      } catch (error: any) {
        return jsonResponse({ error: error.message });
      }
    }

    case 'store_key': {
      const { keyName, keyValue } = args as { keyName: string; keyValue: string };
      try {
        await keytar.setPassword('x3-wallet', keyName, keyValue);
        return jsonResponse({ success: true, message: `Key '${keyName}' stored securely` });
      } catch (error: any) {
        return jsonResponse({ success: false, error: error.message });
      }
    }

    case 'retrieve_key': {
      const { keyName } = args as { keyName: string };
      try {
        const keyValue = await keytar.getPassword('x3-wallet', keyName);
        if (keyValue) {
          return jsonResponse({ keyName, keyValue });
        } else {
          return jsonResponse({ error: `Key '${keyName}' not found` });
        }
      } catch (error: any) {
        return jsonResponse({ error: error.message });
      }
    }

    case 'generate_qr': {
      const { data } = args;
      try {
        const qr = await QRCode.toDataURL(data);
        return jsonResponse({ qrCode: qr, data });
      } catch (error: any) {
        return jsonResponse({ error: error.message });
      }
    }

    case 'fetch_balance': {
      const { address, chainId } = args as { address: string; chainId: string };
      try {
        const chain = chainRegistry.find((c: any) => c.chainId === chainId);
        if (!chain) {
          return jsonResponse({ error: 'Chain not found in registry' });
        }

        const rpc = rpcDatabase[chain.family]?.[chain.network]?.[0]?.rpcs[0];
        if (!rpc) {
          return jsonResponse({ error: 'RPC not found for chain' });
        }

        const provider = new ethers.JsonRpcProvider(rpc);
        const balance = await provider.getBalance(address);
        return jsonResponse({
          address,
          chainId,
          chainName: chain.name,
          balance: ethers.formatEther(balance),
          balanceWei: balance.toString()
        });
      } catch (error: any) {
        return jsonResponse({ error: error.message });
      }
    }

    case 'list_chains': {
      try {
        const chains = chainRegistry.map((c: any) => ({
          chainId: c.chainId,
          name: c.name,
          family: c.family,
          network: c.network,
        }));
        return jsonResponse({ chains, count: chains.length });
      } catch (error: any) {
        return jsonResponse({ error: error.message });
      }
    }

    case 'validate_address': {
      const { address } = args;
      const result: any = { address, valid: false, type: null };
      
      // Check EVM address
      if (ethers.isAddress(address)) {
        result.valid = true;
        result.type = 'EVM';
        result.checksummed = ethers.getAddress(address);
      }
      
      // Check Solana address
      try {
        const pubkey = new PublicKey(address);
        if (PublicKey.isOnCurve(pubkey)) {
          result.valid = true;
          result.type = 'Solana';
        }
      } catch {}
      
      // Substrate addresses are harder to validate without knowing the prefix
      // But we can check if it's a valid SS58 format
      if (!result.valid && address.length >= 47 && address.length <= 48) {
        result.valid = true;
        result.type = 'Substrate (unverified)';
      }
      
      return jsonResponse(result);
    }

    case 'initiate_swap': {
      return jsonResponse({ 
        status: 'placeholder',
        message: 'Swap initiation not yet implemented',
        params: args
      });
    }

    case 'execute_x3_script': {
      const { script } = args;
      return jsonResponse({ 
        status: 'placeholder',
        message: 'x3-lang execution not yet implemented',
        scriptPreview: script.substring(0, 100) + (script.length > 100 ? '...' : '')
      });
    }

    default:
      return jsonResponse({ error: `Unknown tool: ${name}` });
  }
});

// Main function to start the server
async function main() {
  await loadData();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('x3-wallet MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});