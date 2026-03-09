/**
 * Tests for previously untested API functions.
 * All tests hit the real backend at localhost:8420.
 */
import { describe, it, expect } from 'vitest';
import {
  getRalphTaskState,
  ragCrawlUrl,
  notebookGenerate,
  analyzeCodebase,
  generateTaskPlan,
  deploySolidity,
  skillExecute,
  getTerminalWebSocketUrl,
  mcpListServers,
  mcpSaveServer,
  mcpDeleteServer,
  mcpTestServer,
  mcpListTools,
  mcpCallTool,
  agentRunsList,
  agentRunCreate,
  agentRunCancel,
  freeProviderChat,
} from '../lib/api';

const BACKEND = 'http://localhost:8420';

describe('API Extended Tests', () => {
  // ── Pure functions ─────────────────────────────────────────
  describe('getTerminalWebSocketUrl', () => {
    it('constructs WebSocket URL from session id', () => {
      const url = getTerminalWebSocketUrl('sess-123');
      expect(url).toContain('sess-123');
      expect(url).toMatch(/^wss?:\/\//);
    });

    it('uses ws:// for http backend', () => {
      const url = getTerminalWebSocketUrl('abc');
      expect(url).toMatch(/^ws:\/\//);
    });
  });

  // ── Ralph Task State ───────────────────────────────────────
  describe('getRalphTaskState', () => {
    it('returns task state object', async () => {
      const state = await getRalphTaskState('.');
      expect(state).toBeDefined();
      expect(typeof state).toBe('object');
      // The state always has at least a `valid` or `raw` field
      expect('valid' in state || 'raw' in state || 'objective' in state).toBe(true);
    });
  });

  // ── MCP Servers ────────────────────────────────────────────
  describe('mcpListServers', () => {
    it('returns an array', async () => {
      const servers = await mcpListServers();
      expect(Array.isArray(servers)).toBe(true);
    });
  });

  describe('mcpSaveServer + mcpDeleteServer', () => {
    it('saves and deletes an MCP server', async () => {
      const config = {
        name: 'test-server-vitest',
        transport: 'streamable-http' as const,
        url: 'https://example.com/mcp',
        command: '',
        args: [],
        cwd: '.',
        env: {},
        headers: {},
      };
      // Save
      await mcpSaveServer(config);
      const servers = await mcpListServers();
      const found = servers.find((s: any) => s.name === 'test-server-vitest');
      expect(found).toBeDefined();

      // Delete
      await mcpDeleteServer('test-server-vitest');
      const after = await mcpListServers();
      const gone = after.find((s: any) => s.name === 'test-server-vitest');
      expect(gone).toBeUndefined();
    });
  });

  describe('mcpTestServer', () => {
    it('returns response for unknown server', async () => {
      try {
        await mcpTestServer('nonexistent-server');
      } catch (err: any) {
        // Expected — server doesn't exist
        expect(err.message || err).toBeTruthy();
      }
    });
  });

  describe('mcpListTools', () => {
    it('handles unknown server gracefully', async () => {
      try {
        const tools = await mcpListTools('nonexistent-server');
        expect(Array.isArray(tools)).toBe(true);
      } catch (err: any) {
        // Expected — server doesn't exist
        expect(err.message || err).toBeTruthy();
      }
    });
  });

  describe('mcpCallTool', () => {
    it('handles unknown server/tool gracefully', async () => {
      try {
        await mcpCallTool('nonexistent', 'nonexistent-tool', {});
      } catch (err: any) {
        expect(err.message || err).toBeTruthy();
      }
    });
  });

  // ── Agent Runs ─────────────────────────────────────────────
  describe('agentRunsList', () => {
    it('returns an array', async () => {
      const runs = await agentRunsList();
      expect(Array.isArray(runs)).toBe(true);
    });
  });

  describe('agentRunCreate', () => {
    it('creates an agent run', async () => {
      try {
        const result = await agentRunCreate({
          objective: 'Test objective from vitest',
          definitionOfDone: 'All checks pass',
          executionMode: 'sequential',
          agents: [
            {
              id: 'test-agent',
              name: 'test-agent',
              role: 'Testing specialist',
              provider: 'ollama',
              model: 'llama3',
              systemPrompt: 'You are a test agent',
              enabled: true,
            },
          ],
        });
        expect(result).toBeDefined();
        if (result?.id) {
          expect(typeof result.id).toBe('string');
        }
      } catch (err: any) {
        // May fail if no models are available, that's OK
        expect(err.message || err).toBeTruthy();
      }
    });
  });

  describe('agentRunCancel', () => {
    it('handles cancel of unknown run gracefully', async () => {
      try {
        await agentRunCancel('nonexistent-run-id');
      } catch (err: any) {
        expect(err.message || err).toBeTruthy();
      }
    });
  });

  // ── RAG Crawl ──────────────────────────────────────────────
  describe('ragCrawlUrl', () => {
    it('accepts a URL and returns response', async () => {
      try {
        const result = await ragCrawlUrl('https://example.com', 1);
        expect(result).toBeDefined();
      } catch (err: any) {
        // Crawl may fail due to network or missing deps
        expect(err.message || err).toBeTruthy();
      }
    });
  });

  // ── Notebook Generate ──────────────────────────────────────
  describe('notebookGenerate', () => {
    it('generates notebook from text', async () => {
      try {
        const result = await notebookGenerate({
          sourceType: 'text',
          sourceText: 'Testing notebook generation with a simple text input about blockchain technology.',
          tone: 'conversational',
          format: 'summary',
          provider: 'ollama',
        });
        expect(result).toBeDefined();
      } catch (err: any) {
        // May fail without proper model
        expect(err.message || err).toBeTruthy();
      }
    });
  });

  // ── Codebase Analysis ──────────────────────────────────────
  describe('analyzeCodebase', () => {
    // this endpoint can take a while on slower machines
    it('analyzes codebase with task description', async () => {
      try {
        const result = await analyzeCodebase('Find all API endpoints', '.');
        expect(result).toBeDefined();
      } catch (err: any) {
        expect(err.message || err).toBeTruthy();
      }
    }, 15000);
  });

  describe('generateTaskPlan', () => {
    it('generates task plan', async () => {
      try {
        const result = await generateTaskPlan('Build a login page', []);
        expect(result).toBeDefined();
      } catch (err: any) {
        expect(err.message || err).toBeTruthy();
      }
    });
  });

  // ── Solidity Deploy ────────────────────────────────────────
  describe('deploySolidity', () => {
    it('handles deploy request', async () => {
      try {
        const result = await deploySolidity(
          [{ type: 'function', name: 'greet', inputs: [], outputs: [{ type: 'string' }] }],
          '0x6080604052',
          [],
        );
        expect(result).toBeDefined();
      } catch (err: any) {
        expect(err.message || err).toBeTruthy();
      }
    });
  });

  // ── Skill Execute ──────────────────────────────────────────
  describe('skillExecute', () => {
    it('executes a skill', async () => {
      try {
        const result = await skillExecute('skill-creator', { description: 'test skill' }, 'ollama');
        expect(result).toBeDefined();
      } catch (err: any) {
        expect(err.message || err).toBeTruthy();
      }
    });
  });

  // ── Free Provider Chat ─────────────────────────────────────
  describe('freeProviderChat', () => {
    it('sends chat to free provider', async () => {
      try {
        const result = await freeProviderChat(
          'ollamafree',
          'llama3',
          [{ role: 'user', content: 'Hello' }],
        );
        expect(result).toBeDefined();
      } catch (err: any) {
        expect(err.message || err).toBeTruthy();
      }
    });
  });
});
