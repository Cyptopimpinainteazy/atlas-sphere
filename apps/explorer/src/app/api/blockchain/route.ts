import { NextRequest, NextResponse } from 'next/server';
// import { ApiPromise, WsProvider } from '@polkadot/api';

// Mock API for now - replace with real Polkadot API when space allows
// let api: ApiPromise | null = null;

// async function getApi() {
//   if (!api) {
//     const provider = new WsProvider('ws://127.0.0.1:9944');
//     api = await ApiPromise.create({ provider });
//   }
//   return api;
// }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Mock data for development - replace with real API calls later
    switch (type) {
      case 'stats': {
        return NextResponse.json({
          chain: 'Atlas Sphere',
          nodeName: 'atlas-sphere-node',
          nodeVersion: 'v0.1.0',
          blockNumber: 1234567,
          blockHash: '0x1234567890abcdef'
        });
      }

      case 'blocks': {
        const mockBlocks = [];
        for (let i = 0; i < 10; i++) {
          mockBlocks.push({
            number: 1234567 - i,
            hash: `0x${Math.random().toString(16).substr(2, 16)}`,
            timestamp: Date.now() - (i * 6000),
            transactions: Math.floor(Math.random() * 20) + 1
          });
        }
        return NextResponse.json(mockBlocks);
      }

      case 'transactions': {
        const mockTransactions = [];
        for (let i = 0; i < 20; i++) {
          mockTransactions.push({
            hash: `0x${Math.random().toString(16).substr(2, 16)}`,
            from: `0x${Math.random().toString(16).substr(2, 16)}`,
            to: `0x${Math.random().toString(16).substr(2, 16)}`,
            value: `${(Math.random() * 10).toFixed(3)} ATLAS`,
            timestamp: Date.now() - (i * 30000),
            status: Math.random() > 0.1 ? 'success' : 'failed',
            vm: Math.random() > 0.5 ? 'EVM' : 'SVM'
          });
        }
        return NextResponse.json(mockTransactions);
      }

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}