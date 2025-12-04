'use client';

import {
  AtlasSphereClient,
  DEFAULT_WS_ENDPOINT,
} from '@atlas-sphere/ts-sdk';

let client: AtlasSphereClient | null = null;

function getEndpoint(): { endpoint: string; useWebSocket: boolean } {
  const envEndpoint = process.env.NEXT_PUBLIC_SUBSTRATE_RPC_ENDPOINT;
  const endpoint = envEndpoint && envEndpoint.length > 0 ? envEndpoint : DEFAULT_WS_ENDPOINT;
  const useWebSocket = endpoint.startsWith('ws');

  return { endpoint, useWebSocket };
}

export async function getAtlasClient(): Promise<AtlasSphereClient> {
  if (client && client.isConnected) {
    return client;
  }

  const { endpoint, useWebSocket } = getEndpoint();

  client = new AtlasSphereClient({
    endpoint,
    useWebSocket,
  });

  await client.connect();
  return client;
}
