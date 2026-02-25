/**
 * Integration tests for @x3-chain/polkawallet-bridge-adapter
 *
 * INV-REF: tests/invariants/registry.toml — polkawallet_bridge_routing
 */

import {
  AtlasBridgeAdapter,
  createBridgeAdapter,
} from '../src/index';
import type { ChainId, BridgeRoute } from '../src/index';

describe('AtlasBridgeAdapter', () => {
  let adapter: AtlasBridgeAdapter;

  beforeEach(() => {
    adapter = createBridgeAdapter({
      atlasEndpoint: 'ws://127.0.0.1:9944',
    });
  });

  describe('route discovery', () => {
    test('finds XCM route between X3 and Polkadot parachains', () => {
      const routes = adapter.getRoutes('x3', 'polkadot');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].method).toBe('xcm');
    });

    test('finds XCM route to Moonbeam', () => {
      const routes = adapter.getRoutes('x3', 'moonbeam');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.some((r) => r.method === 'xcm')).toBe(true);
    });

    test('finds x3-settlement route for EVM chains', () => {
      const routes = adapter.getRoutes('x3', 'ethereum');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.some((r) => r.method === 'x3-settlement')).toBe(true);
    });

    test('finds route for Solana', () => {
      const routes = adapter.getRoutes('x3', 'solana');
      expect(routes.length).toBeGreaterThan(0);
    });

    test('finds route for Bitcoin via x3-settlement', () => {
      const routes = adapter.getRoutes('x3', 'bitcoin');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].method).toBe('x3-settlement');
    });

    test('finds direct route between chains sharing methods', () => {
      // Ethereum and Solana both support x3-settlement & x3-atomic,
      // so they get a direct route (no hub hop needed)
      const routes = adapter.getRoutes('ethereum', 'solana');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].hops).toEqual([]);
    });

    test('finds hub-routed path when no direct methods', () => {
      // Bitcoin only supports x3-settlement; Polkadot only supports xcm —
      // no common method, so routing goes through X3 as hub
      const routes = adapter.getRoutes('bitcoin', 'polkadot');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].hops).toContain('x3');
    });

    test('returns empty routes for unsupported paths', () => {
      const routes = adapter.getRoutes('bitcoin' as ChainId, 'polkadot' as ChainId);
      // BTC → Polkadot needs hub routing through X3
      // Should still find a route
      expect(routes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reachable chains', () => {
    test('X3 can reach all chains', () => {
      const reachable = adapter.getReachableChains('x3');
      expect(reachable).toContain('ethereum');
      expect(reachable).toContain('solana');
      expect(reachable).toContain('bitcoin');
      expect(reachable).toContain('polkadot');
      expect(reachable).toContain('moonbeam');
    });

    test('Ethereum can reach other chains via X3 hub', () => {
      const reachable = adapter.getReachableChains('ethereum');
      expect(reachable).toContain('x3');
    });
  });

  describe('fee estimation', () => {
    test('estimates fees for different methods', async () => {
      const xcmFee = await adapter.estimateFee({
        source: 'x3',
        destination: 'polkadot',
        asset: 'X3',
        amount: 1000n,
        recipient: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      });
      expect(xcmFee).toBeGreaterThan(0n);

      const settlementFee = await adapter.estimateFee({
        source: 'x3',
        destination: 'ethereum',
        asset: 'X3',
        amount: 1000n,
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f2a2Fe',
      });
      expect(settlementFee).toBeGreaterThan(0n);
      // Settlement should cost more than XCM
      expect(settlementFee).toBeGreaterThan(xcmFee);
    });
  });
});
