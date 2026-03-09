import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AiChatPanel } from '../components/panels/AiChatPanel';
import { useIDEStore } from '../store/ideStore';
import * as api from '../lib/api';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    freeProviderChat: vi.fn(),
    ollamaChatStream: vi.fn(async function* () {}),
    getAiWorkspaceContext: vi.fn(),
    applyAiWorkspaceEdits: vi.fn(),
    openWorkspaceFile: vi.fn(),
  };
});

describe('AiChatPanel code-aware chat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useIDEStore.setState({
      chatMessages: [],
      isChatStreaming: false,
      aiProvider: 'openrouter',
      aiModel: 'openrouter/test-model',
      chatModel: 'llama3:8b',
      availableModels: [
        { name: 'llama3:8b', size: '4.7GB', modified: '', quantization: 'q4', capabilities: [] },
      ],
      workspaceRoot: 'apps/super-ide',
      openTabs: [
        {
          id: 'src/demo.ts',
          name: 'demo.ts',
          path: 'src/demo.ts',
          language: 'typescript',
          content: 'export const value = 1;\n',
          isDirty: false,
        },
      ],
      activeTabId: 'src/demo.ts',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders codebase toggles and sends workspace context', async () => {
    vi.mocked(api.getAiWorkspaceContext).mockResolvedValue({
      context:
        'Workspace context for this request:\n\nActive file: src/demo.ts\n\nRelevant file: src/helper.ts',
      matches: [
        {
          path: 'src/helper.ts',
          line: 4,
          snippet: 'export function helper() {}',
          score: 12,
        },
      ],
      files: [
        {
          path: 'src/helper.ts',
          content: 'export function helper() { return true; }\n',
        },
      ],
    });
    vi.mocked(api.freeProviderChat).mockResolvedValue({
      choices: [{ message: { content: 'Reviewed the codebase.' } }],
    });

    render(<AiChatPanel />);

    expect(screen.getByLabelText('Read codebase')).toBeChecked();
    expect(screen.getByLabelText('Auto-apply edits')).toBeChecked();

    fireEvent.change(screen.getByPlaceholderText('Ask Atlas AI anything...'), {
      target: { value: 'review this module' },
    });
    fireEvent.click(screen.getByText('▶'));

    await waitFor(() => {
      expect(api.freeProviderChat).toHaveBeenCalledTimes(1);
    });

    const messages = vi.mocked(api.freeProviderChat).mock.calls[0]?.[2] as Array<{
      role: string;
      content: string;
    }>;
    expect(messages.some((message) => message.content.includes('Workspace context for this request:'))).toBe(true);
    expect(messages.some((message) => message.content.includes('Active file: src/demo.ts'))).toBe(true);
    expect(messages.some((message) => message.content.includes('Relevant file: src/helper.ts'))).toBe(true);
    expect(api.getAiWorkspaceContext).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'review this module',
        workspaceRoot: 'apps/super-ide',
        activeFilePath: 'src/demo.ts',
      }),
    );
  });

  it('auto-applies structured file edits returned by the model', async () => {
    vi.mocked(api.getAiWorkspaceContext).mockResolvedValue({
      context: 'Workspace root: apps/super-ide',
      matches: [],
      files: [],
    });
    vi.mocked(api.freeProviderChat).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              'Updated the module.\n```atlas-edit\n{"path":"src/demo.ts","content":"export const value = 2;\\n"}\n```',
          },
        },
      ],
    });
    vi.mocked(api.applyAiWorkspaceEdits).mockResolvedValue({
      status: 'ok',
      applied: [{ path: 'src/demo.ts', bytes: 24 }],
    });

    render(<AiChatPanel />);

    fireEvent.change(screen.getByPlaceholderText('Ask Atlas AI anything...'), {
      target: { value: 'change the exported value to 2' },
    });
    fireEvent.click(screen.getByText('▶'));

    await waitFor(() => {
      expect(api.applyAiWorkspaceEdits).toHaveBeenCalledWith([
        { path: 'src/demo.ts', content: 'export const value = 2;\n' },
      ]);
    });

    expect(useIDEStore.getState().openTabs.find((tab) => tab.path === 'src/demo.ts')?.content).toBe(
      'export const value = 2;\n',
    );
    expect(screen.getAllByText(/Applied 1 file change\(s\): src\/demo\.ts/).length).toBeGreaterThan(0);
  });

  it('shows Apply Suggested Edits for diff-only replies and applies them on click', async () => {
    useIDEStore.setState({
      chatMessages: [
        {
          id: 'assistant-diff',
          role: 'assistant',
          content:
            'Try this diff:\n```diff\n--- a/src/demo.ts\n+++ b/src/demo.ts\n@@ -1 +1 @@\n-export const value = 1;\n+export const value = 3;\n```',
          timestamp: Date.now(),
          model: 'openrouter/test-model',
        },
      ],
    });
    vi.mocked(api.applyAiWorkspaceEdits).mockResolvedValue({
      status: 'ok',
      applied: [{ path: 'src/demo.ts', bytes: 24 }],
    });

    render(<AiChatPanel />);

    fireEvent.click(screen.getByText('Apply Suggested Edits'));

    await waitFor(() => {
      expect(api.applyAiWorkspaceEdits).toHaveBeenCalledWith([
        { path: 'src/demo.ts', content: 'export const value = 3;\n' },
      ]);
    });

    expect(useIDEStore.getState().openTabs.find((tab) => tab.path === 'src/demo.ts')?.content).toBe(
      'export const value = 3;\n',
    );
    expect(screen.getAllByText(/Applied suggested diff\(s\): src\/demo\.ts/).length).toBeGreaterThan(0);
  });
});
