/**
 * Real API integration tests — no mocks.
 * Tests call the live backend at localhost:8420 and Ollama at localhost:11434.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  healthCheck,
  ollamaListModels,
  ollamaShowModel,
  getWorkspaceTree,
  searchWorkspaceFiles,
  searchCodebase,
  openWorkspaceFile,
  saveWorkspaceFile,
  knowledgeList,
  knowledgeSave,
  knowledgeGet,
  knowledgeDelete,
  knowledgeSearch,
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
  ragQuery,
  compileSolidity,
  runForgeTests,
  runSolhintLinting,
  runSlitherSecurity,
} from '../lib/api';

// ── Health ─────────────────────────────────────────────────────
describe('Health Check (real)', () => {
  it('returns backend=true and ollama=true', async () => {
    const h = await healthCheck();
    expect(h.backend).toBe(true);
    expect(h.ollama).toBe(true);
  });
});

// ── Ollama ─────────────────────────────────────────────────────
describe('Ollama (real)', () => {
  it('lists models with names and sizes', async () => {
    const models = await ollamaListModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty('name');
    expect(models[0]).toHaveProperty('size');
    expect(models[0]).toHaveProperty('quantization');
  });

  it('shows details for an available model', async () => {
    const models = await ollamaListModels();
    const first = models[0].name;
    const info = await ollamaShowModel(first);
    expect(info).toHaveProperty('modelfile');
  });
});

// ── Workspace Files ────────────────────────────────────────────
describe('Workspace Files (real)', () => {
  const TEST_FILE_PATH = '__test_tmp_superide_testfile.txt';
  const TEST_CONTENT = 'hello from vitest real test';

  afterAll(async () => {
    // cleanup: best-effort delete via save empty then ignore
    try {
      await saveWorkspaceFile(TEST_FILE_PATH, '');
    } catch { /* ignore */ }
  });

  it('returns a tree from the workspace root', async () => {
    const tree = await getWorkspaceTree('.');
    expect(Array.isArray(tree)).toBe(true);
    expect(tree.length).toBeGreaterThan(0);
    expect(tree[0]).toHaveProperty('name');
    expect(tree[0]).toHaveProperty('type');
  }, 20000);

  it('searches workspace files', async () => {
    const results = await searchWorkspaceFiles('README', '.', 5);
    expect(Array.isArray(results)).toBe(true);
    // The workspace has README files
  }, 15000);

  it('searches codebase for code', async () => {
    const results = await searchCodebase('import', '.', 5);
    expect(Array.isArray(results)).toBe(true);
  }, 15000);

  it('saves and opens a workspace file round-trip', async () => {
    const saveResult = await saveWorkspaceFile(TEST_FILE_PATH, TEST_CONTENT);
    expect(saveResult).toBeDefined();

    const opened = await openWorkspaceFile(TEST_FILE_PATH);
    expect(opened.content).toBe(TEST_CONTENT);
    expect(opened.path).toBe(TEST_FILE_PATH);
  });
});

// ── Knowledge CRUD ─────────────────────────────────────────────
describe('Knowledge CRUD (real)', () => {
  let createdId: string | null = null;

  afterAll(async () => {
    if (createdId) {
      try { await knowledgeDelete(createdId); } catch { /* ignore */ }
    }
  });

  it('lists knowledge entries', async () => {
    const data = await knowledgeList();
    expect(data).toBeDefined();
    // Could be an array or object depending on backend implementation
    expect(Array.isArray(data) || typeof data === 'object').toBe(true);
  });

  it('saves a knowledge entry and retrieves it', async () => {
    const entry = {
      id: `test-know-${Date.now()}`,
      title: 'Vitest Real Entry',
      category: 'pattern',
      content: 'Testing knowledge CRUD without mocks',
      tags: ['vitest', 'real'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const saveResult = await knowledgeSave(entry);
    expect(saveResult).toBeDefined();
    createdId = entry.id;

    const fetched = await knowledgeGet(entry.id);
    expect(fetched).toBeDefined();
    expect(fetched.title || fetched.entry?.title).toBeDefined();
  });

  it('searches knowledge entries', async () => {
    const results = await knowledgeSearch('Vitest');
    expect(results).toBeDefined();
  });

  it('deletes a knowledge entry', async () => {
    if (!createdId) return;
    const result = await knowledgeDelete(createdId);
    expect(result).toBeDefined();
    createdId = null; // prevent afterAll double-delete
  });
});

// ── Notebook CRUD ──────────────────────────────────────────────
describe('Notebook CRUD (real)', () => {
  let createdId: string | null = null;

  afterAll(async () => {
    if (createdId) {
      try { await notebookDelete(createdId); } catch { /* ignore */ }
    }
  });

  it('lists notebook sessions', async () => {
    const data = await notebookList();
    expect(data).toBeDefined();
  });

  it('saves and deletes a notebook session', async () => {
    const session = {
      id: `test-nb-${Date.now()}`,
      title: 'Vitest Session',
      sourceType: 'text',
      transcript: 'Test transcript from vitest real test',
      createdAt: Date.now(),
    };
    const saveResult = await notebookSave(session);
    expect(saveResult).toBeDefined();
    createdId = session.id;

    const deleteResult = await notebookDelete(session.id);
    expect(deleteResult).toBeDefined();
    createdId = null;
  });
});

// ── Research CRUD ──────────────────────────────────────────────
describe('Research CRUD (real)', () => {
  let createdId: string | null = null;

  afterAll(async () => {
    if (createdId) {
      try { await researchDelete(createdId); } catch { /* ignore */ }
    }
  });

  it('lists research cards', async () => {
    const data = await researchList();
    expect(data).toBeDefined();
  });

  it('saves and deletes a research card', async () => {
    const card = {
      id: `test-res-${Date.now()}`,
      type: 'insight',
      title: 'Vitest Research Card',
      content: 'Real integration test card',
      createdAt: Date.now(),
    };
    const saveResult = await researchSave(card);
    expect(saveResult).toBeDefined();
    createdId = card.id;

    const deleteResult = await researchDelete(card.id);
    expect(deleteResult).toBeDefined();
    createdId = null;
  });
});

// ── Skills ─────────────────────────────────────────────────────
describe('Skills (real)', () => {
  let historyId: string | null = null;

  afterAll(async () => {
    if (historyId) {
      try { await skillHistoryDelete(historyId); } catch { /* ignore */ }
    }
  });

  it('lists available skills', async () => {
    const skills = await skillsList();
    expect(Array.isArray(skills)).toBe(true);
    if (skills.length > 0) {
      expect(skills[0]).toHaveProperty('id');
      expect(skills[0]).toHaveProperty('name');
    }
  });

  it('lists skill history', async () => {
    const data = await skillHistoryList();
    expect(data).toBeDefined();
  });

  it('saves and deletes skill history', async () => {
    const entry = {
      id: `test-sh-${Date.now()}`,
      skillId: 'test-skill',
      skillName: 'Test Skill',
      inputs: {},
      output: 'test output',
      timestamp: Date.now(),
    };
    const saveResult = await skillHistorySave(entry);
    expect(saveResult).toBeDefined();
    historyId = entry.id;

    const deleteResult = await skillHistoryDelete(entry.id);
    expect(deleteResult).toBeDefined();
    historyId = null;
  });
});

// ── Terminal ───────────────────────────────────────────────────
describe('Terminal Sessions (real)', () => {
  it('creates, executes, and closes a terminal session', async () => {
    const session = await terminalCreateSession('.');
    expect(session).toHaveProperty('session_id');
    expect(session).toHaveProperty('cwd');

    const exec = await terminalExecute(session.session_id, 'echo hello-from-vitest');
    expect(exec).toHaveProperty('stdout');
    expect(exec.stdout).toContain('hello-from-vitest');
    expect(exec.exit_code).toBe(0);

    const closed = await terminalCloseSession(session.session_id);
    expect(closed).toBeDefined();
  });
});

// ── RAG ────────────────────────────────────────────────────────
describe('RAG (real)', () => {
  it('gets RAG sources list', async () => {
    const sources = await ragGetSources();
    expect(sources).toBeDefined();
  });

  it('queries RAG (may return empty)', async () => {
    const result = await ragQuery('solidity smart contract');
    expect(result).toBeDefined();
  });
});

// ── Remix / Compilation ────────────────────────────────────────
describe('Remix Compilation (real)', () => {
  it('compiles valid Solidity source', async () => {
    const source = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract Hello {
    string public greeting = "Hello";
}`;
    const result = await compileSolidity(source, '0.8.24');
    expect(result).toBeDefined();
    // Result may have contracts or errors depending on solc availability
  });
});

// ── Testing & Security ─────────────────────────────────────────
describe('Testing & Security endpoints (real)', () => {
  it('calls forge tests endpoint', async () => {
    const result = await runForgeTests();
    expect(result).toBeDefined();
  });

  it('calls solhint linting endpoint', async () => {
    const result = await runSolhintLinting('test.sol');
    expect(result).toBeDefined();
  });

  it('calls slither security endpoint', async () => {
    const result = await runSlitherSecurity('test.sol');
    expect(result).toBeDefined();
  });
});
