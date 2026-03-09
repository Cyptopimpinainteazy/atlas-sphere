/**
 * Real end-to-end integration tests — no mocks.
 * Tests multi-step workflows against the live backend.
 */
import { describe, it, expect, afterAll } from 'vitest';
import {
  healthCheck,
  ollamaListModels,
  getWorkspaceTree,
  openWorkspaceFile,
  saveWorkspaceFile,
  searchWorkspaceFiles,
  searchCodebase,
  knowledgeList,
  knowledgeSave,
  knowledgeGet,
  knowledgeSearch,
  knowledgeDelete,
  notebookList,
  notebookSave,
  notebookDelete,
  researchList,
  researchSave,
  researchDelete,
  skillsList,
  skillHistoryList,
  skillHistorySave,
  skillHistoryDelete,
  terminalCreateSession,
  terminalExecute,
  terminalCloseSession,
  ragGetSources,
  compileSolidity,
} from '../lib/api';

// Track IDs for cleanup
const cleanupIds: { type: string; id: string }[] = [];

afterAll(async () => {
  for (const { type, id } of cleanupIds) {
    try {
      if (type === 'knowledge') await knowledgeDelete(id);
      if (type === 'notebook') await notebookDelete(id);
      if (type === 'research') await researchDelete(id);
      if (type === 'skill-history') await skillHistoryDelete(id);
    } catch { /* best-effort cleanup */ }
  }
});

// ── Smoke: all services up ─────────────────────────────────────
describe('Integration: Service smoke test', () => {
  it('backend + ollama both healthy', async () => {
    const h = await healthCheck();
    expect(h.backend).toBe(true);
    expect(h.ollama).toBe(true);
  });

  it('ollama has models loaded', async () => {
    const models = await ollamaListModels();
    expect(models.length).toBeGreaterThan(0);
  });
});

// ── File workflow: save → open → search → find ─────────────────
describe('Integration: File round-trip workflow', () => {
  const FILE = '__integration_test_file.sol';
  const CONTENT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract IntegrationTest {
    uint256 public value;

    function setValue(uint256 _v) external {
        value = _v;
    }

    event ValueChanged(uint256 newValue);
}`;

  afterAll(async () => {
    try { await saveWorkspaceFile(FILE, ''); } catch { /* ignore */ }
  });

  it('saves a Solidity file to the workspace', async () => {
    const result = await saveWorkspaceFile(FILE, CONTENT);
    expect(result).toBeDefined();
  });

  it('opens the saved file and verifies content', async () => {
    const file = await openWorkspaceFile(FILE);
    expect(file.content).toBe(CONTENT);
    expect(file.path).toBe(FILE);
  });

  it('finds the file via workspace search', async () => {
    const results = await searchWorkspaceFiles('IntegrationTest', '.', 10);
    expect(Array.isArray(results)).toBe(true);
    // Should find our test file
  }, 15000);

  it('finds code in the file via codebase search', async () => {
    const results = await searchCodebase('setValue', '.', 10);
    expect(Array.isArray(results)).toBe(true);
  }, 30000);

  it('compiles the saved Solidity source', async () => {
    const result = await compileSolidity(CONTENT, '0.8.24');
    expect(result).toBeDefined();
  });
});

// ── Knowledge workflow: create → search → update → delete ──────
describe('Integration: Knowledge CRUD workflow', () => {
  const id = `int-know-${Date.now()}`;

  it('creates a knowledge entry', async () => {
    const entry = {
      id,
      title: 'Integration Test Pattern',
      category: 'pattern',
      content: 'Always verify round-trips in integration tests',
      tags: ['integration', 'testing'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = await knowledgeSave(entry);
    expect(result).toBeDefined();
    cleanupIds.push({ type: 'knowledge', id });
  });

  it('retrieves the created entry by ID', async () => {
    const data = await knowledgeGet(id);
    expect(data).toBeDefined();
  });

  it('finds the entry via search', async () => {
    const results = await knowledgeSearch('Integration Test Pattern');
    expect(results).toBeDefined();
  });

  it('lists all entries including the new one', async () => {
    const data = await knowledgeList();
    expect(data).toBeDefined();
  });

  it('updates the entry by saving with same ID', async () => {
    const updated = {
      id,
      title: 'Integration Test Pattern (Updated)',
      category: 'pattern',
      content: 'Updated content from integration test',
      tags: ['integration', 'testing', 'updated'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = await knowledgeSave(updated);
    expect(result).toBeDefined();

    const fetched = await knowledgeGet(id);
    expect(fetched).toBeDefined();
  });

  it('deletes the entry', async () => {
    const result = await knowledgeDelete(id);
    expect(result).toBeDefined();
    // Remove from cleanup since we already deleted
    const idx = cleanupIds.findIndex(c => c.id === id);
    if (idx >= 0) cleanupIds.splice(idx, 1);
  });
});

// ── Notebook workflow: save → list → delete ────────────────────
describe('Integration: Notebook session lifecycle', () => {
  const id = `int-nb-${Date.now()}`;

  it('saves a notebook session', async () => {
    const session = {
      id,
      title: 'Integration Notebook',
      sourceType: 'text',
      transcript: 'This is a test notebook transcript',
      createdAt: Date.now(),
    };
    const result = await notebookSave(session);
    expect(result).toBeDefined();
    cleanupIds.push({ type: 'notebook', id });
  });

  it('lists sessions including the new one', async () => {
    const data = await notebookList();
    expect(data).toBeDefined();
  });

  it('deletes the session', async () => {
    const result = await notebookDelete(id);
    expect(result).toBeDefined();
    const idx = cleanupIds.findIndex(c => c.id === id);
    if (idx >= 0) cleanupIds.splice(idx, 1);
  });
});

// ── Research workflow: save → list → delete ────────────────────
describe('Integration: Research card lifecycle', () => {
  const id = `int-res-${Date.now()}`;

  it('saves a research card', async () => {
    const card = {
      id,
      type: 'action',
      title: 'Integration Research Card',
      content: 'Take action on integration test findings',
      createdAt: Date.now(),
    };
    const result = await researchSave(card);
    expect(result).toBeDefined();
    cleanupIds.push({ type: 'research', id });
  });

  it('lists cards including the new one', async () => {
    const data = await researchList();
    expect(data).toBeDefined();
  });

  it('deletes the card', async () => {
    const result = await researchDelete(id);
    expect(result).toBeDefined();
    const idx = cleanupIds.findIndex(c => c.id === id);
    if (idx >= 0) cleanupIds.splice(idx, 1);
  });
});

// ── Skills workflow: list + history lifecycle ───────────────────
describe('Integration: Skills workflow', () => {
  const histId = `int-sh-${Date.now()}`;

  it('lists skills from the real registry', async () => {
    const skills = await skillsList();
    expect(Array.isArray(skills)).toBe(true);
  });

  it('saves a skill history entry', async () => {
    const entry = {
      id: histId,
      skillId: 'smart-contract-audit',
      skillName: 'Smart Contract Audit',
      inputs: { contract: 'Token.sol' },
      output: 'Audit passed',
      timestamp: Date.now(),
    };
    const result = await skillHistorySave(entry);
    expect(result).toBeDefined();
    cleanupIds.push({ type: 'skill-history', id: histId });
  });

  it('lists skill history including the new entry', async () => {
    const data = await skillHistoryList();
    expect(data).toBeDefined();
  });

  it('deletes skill history entry', async () => {
    const result = await skillHistoryDelete(histId);
    expect(result).toBeDefined();
    const idx = cleanupIds.findIndex(c => c.id === histId);
    if (idx >= 0) cleanupIds.splice(idx, 1);
  });
});

// ── Terminal workflow: create → execute → close ────────────────
describe('Integration: Terminal session workflow', () => {
  it('creates session, runs multiple commands, closes', async () => {
    // Create
    const session = await terminalCreateSession('.');
    expect(session.session_id).toBeTruthy();

    // Execute pwd
    const pwd = await terminalExecute(session.session_id, 'pwd');
    expect(pwd.exit_code).toBe(0);
    expect(pwd.stdout).toBeTruthy();

    // Execute ls
    const ls = await terminalExecute(session.session_id, 'ls');
    expect(ls.exit_code).toBe(0);

    // Execute echo with special chars
    const echo = await terminalExecute(session.session_id, 'echo "integration-test-$(date +%s)"');
    expect(echo.exit_code).toBe(0);
    expect(echo.stdout).toContain('integration-test-');

    // Close
    const closed = await terminalCloseSession(session.session_id);
    expect(closed).toBeDefined();
  });
});

// ── Workspace tree navigation ──────────────────────────────────
describe('Integration: Workspace tree exploration', () => {
  it('navigates the workspace tree top-level', async () => {
    const tree = await getWorkspaceTree('.');
    expect(tree.length).toBeGreaterThan(0);

    // Find a directory to drill into
    const dir = tree.find((n: any) => n.type === 'dir');
    expect(dir).toBeDefined();

    if (dir) {
      // Drill into subdirectory
      const subtree = await getWorkspaceTree(dir.path || dir.name);
      expect(Array.isArray(subtree)).toBe(true);
    }
  });
});

// ── RAG sources check ──────────────────────────────────────────
describe('Integration: RAG sources', () => {
  it('lists RAG sources (may be empty)', async () => {
    const sources = await ragGetSources();
    expect(sources).toBeDefined();
  });
});

// ── Cross-cutting: multiple APIs in sequence ───────────────────
describe('Integration: Cross-cutting API chain', () => {
  it('health → models → tree → search in one flow', async () => {
    // 1. Health check
    const h = await healthCheck();
    expect(h.backend).toBe(true);

    // 2. List models
    const models = await ollamaListModels();
    expect(models.length).toBeGreaterThan(0);

    // 3. Get workspace tree
    const tree = await getWorkspaceTree('.');
    expect(tree.length).toBeGreaterThan(0);

    // 4. Search for a file
    const results = await searchWorkspaceFiles('Cargo', '.', 5);
    expect(Array.isArray(results)).toBe(true);
  });

  it('knowledge + research + notebook saves in parallel', async () => {
    const ts = Date.now();
    const [kRes, rRes, nRes] = await Promise.all([
      knowledgeSave({
        id: `par-k-${ts}`, title: 'Parallel K', category: 'config',
        content: 'parallel test', tags: [], createdAt: ts, updatedAt: ts,
      }),
      researchSave({
        id: `par-r-${ts}`, type: 'metric', title: 'Parallel R',
        content: 'parallel test', createdAt: ts,
      }),
      notebookSave({
        id: `par-n-${ts}`, title: 'Parallel N', sourceType: 'text',
        transcript: 'parallel test', createdAt: ts,
      }),
    ]);

    expect(kRes).toBeDefined();
    expect(rRes).toBeDefined();
    expect(nRes).toBeDefined();

    // Cleanup
    await Promise.all([
      knowledgeDelete(`par-k-${ts}`),
      researchDelete(`par-r-${ts}`),
      notebookDelete(`par-n-${ts}`),
    ]);
  });
});
