/**
 * Focused regression checks for store actions that changed over time.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useIDEStore } from '../store/ideStore';

function makeAgentProfile(id: string, name: string) {
  return {
    id,
    name,
    role: 'Testing specialist',
    provider: 'ollama' as const,
    model: 'llama3',
    systemPrompt: '',
    openclawTools: {
      profile: 'coding' as const,
      allow: [],
      deny: [],
      byProvider: {},
    },
    enabled: true,
  };
}

function makeRun(id: string, status: 'queued' | 'running' | 'completed' = 'running') {
  const now = Date.now();
  return {
    id,
    objective: 'Test objective',
    definitionOfDone: 'Tests pass',
    executionMode: 'sequential' as const,
    status,
    createdAt: now,
    updatedAt: now,
    agents: [],
  };
}

function resetStore() {
  useIDEStore.setState({
    aiDraftInput: '',
    aiDraftMode: 'chat',
    agentProfiles: [],
    agentRuns: [],
    terminalTranscript: '',
    lastBuildOrTestCommand: '',
    noAddModeEnabled: false,
    noAddObjective: '',
    noAddDefinitionOfDone: '',
    noAddRoleProfile: '',
  });
}

describe('Store Extended Actions', () => {
  beforeEach(() => resetStore());

  describe('seedAiChatInput', () => {
    it('sets draft input and mode', () => {
      useIDEStore.getState().seedAiChatInput('Build a token', 'task-plan');
      const state = useIDEStore.getState();
      expect(state.aiDraftInput).toBe('Build a token');
      expect(state.aiDraftMode).toBe('task-plan');
    });

    it('defaults mode to chat', () => {
      useIDEStore.getState().seedAiChatInput('Hello');
      expect(useIDEStore.getState().aiDraftMode).toBe('chat');
    });
  });

  describe('clearAiDraftInput', () => {
    it('clears draft input and resets mode', () => {
      useIDEStore.getState().seedAiChatInput('Take over the world', 'context-eng');
      useIDEStore.getState().clearAiDraftInput();
      const state = useIDEStore.getState();
      expect(state.aiDraftInput).toBe('');
      expect(state.aiDraftMode).toBe('chat');
    });
  });

  describe('setAgentProfiles', () => {
    it('replaces all profiles', () => {
      const profiles = [makeAgentProfile('a1', 'Alpha'), makeAgentProfile('a2', 'Beta')];
      useIDEStore.getState().setAgentProfiles(profiles);
      expect(useIDEStore.getState().agentProfiles).toHaveLength(2);
      expect(useIDEStore.getState().agentProfiles[0].name).toBe('Alpha');
    });
  });

  describe('addAgentProfile', () => {
    it('appends a default profile', () => {
      useIDEStore.getState().addAgentProfile();
      const profiles = useIDEStore.getState().agentProfiles;
      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toMatch(/Agent 1/);
      expect(profiles[0].openclawTools.profile).toBeTruthy();
    });
  });

  describe('updateAgentProfile', () => {
    it('updates an existing profile by id', () => {
      useIDEStore.getState().setAgentProfiles([makeAgentProfile('u1', 'Old')]);
      useIDEStore.getState().updateAgentProfile('u1', { name: 'Updated', model: 'qwen2.5' });
      const updated = useIDEStore.getState().agentProfiles.find((profile) => profile.id === 'u1');
      expect(updated?.name).toBe('Updated');
      expect(updated?.model).toBe('qwen2.5');
    });
  });

  describe('removeAgentProfile', () => {
    it('removes a profile when more than one exists', () => {
      useIDEStore.getState().setAgentProfiles([
        makeAgentProfile('r1', 'Remove Me'),
        makeAgentProfile('r2', 'Keep Me'),
      ]);
      useIDEStore.getState().removeAgentProfile('r1');
      expect(useIDEStore.getState().agentProfiles).toHaveLength(1);
      expect(useIDEStore.getState().agentProfiles[0].id).toBe('r2');
    });
  });

  describe('setAgentRuns', () => {
    it('replaces all runs', () => {
      useIDEStore.getState().setAgentRuns([makeRun('run1')]);
      expect(useIDEStore.getState().agentRuns).toHaveLength(1);
    });
  });

  describe('upsertAgentRun', () => {
    it('inserts a new run', () => {
      useIDEStore.getState().upsertAgentRun(makeRun('run1'));
      expect(useIDEStore.getState().agentRuns).toHaveLength(1);
    });

    it('updates an existing run by id', () => {
      const run = makeRun('run2');
      useIDEStore.getState().upsertAgentRun(run);
      useIDEStore.getState().upsertAgentRun({ ...run, status: 'completed' });
      expect(useIDEStore.getState().agentRuns).toHaveLength(1);
      expect(useIDEStore.getState().agentRuns[0].status).toBe('completed');
    });
  });

  describe('appendTerminalTranscript', () => {
    it('appends text to transcript', () => {
      useIDEStore.getState().appendTerminalTranscript('$ npm test\n');
      useIDEStore.getState().appendTerminalTranscript('PASS\n');
      expect(useIDEStore.getState().terminalTranscript).toBe('$ npm test\nPASS\n');
    });
  });

  describe('clearTerminalTranscript', () => {
    it('clears transcript', () => {
      useIDEStore.getState().appendTerminalTranscript('stuff');
      useIDEStore.getState().clearTerminalTranscript();
      expect(useIDEStore.getState().terminalTranscript).toBe('');
    });
  });

  describe('recordTerminalCommand', () => {
    it('records build or test commands', () => {
      useIDEStore.getState().recordTerminalCommand('npm test');
      expect(useIDEStore.getState().lastBuildOrTestCommand).toBe('npm test');
    });

    it('ignores commands that are not build or test related', () => {
      useIDEStore.getState().recordTerminalCommand('pwd');
      expect(useIDEStore.getState().lastBuildOrTestCommand).toBe('');
    });
  });

  describe('setNoAddModeEnabled', () => {
    it('enables NoAdd mode', () => {
      useIDEStore.getState().setNoAddModeEnabled(true);
      expect(useIDEStore.getState().noAddModeEnabled).toBe(true);
    });
  });

  describe('setNoAddObjective', () => {
    it('sets objective text', () => {
      useIDEStore.getState().setNoAddObjective('Ship feature X');
      expect(useIDEStore.getState().noAddObjective).toBe('Ship feature X');
    });
  });

  describe('setNoAddDefinitionOfDone', () => {
    it('sets definition of done', () => {
      useIDEStore.getState().setNoAddDefinitionOfDone('All tests green');
      expect(useIDEStore.getState().noAddDefinitionOfDone).toBe('All tests green');
    });
  });

  describe('setNoAddRoleProfile', () => {
    it('sets role profile', () => {
      useIDEStore.getState().setNoAddRoleProfile('Senior Engineer');
      expect(useIDEStore.getState().noAddRoleProfile).toBe('Senior Engineer');
    });
  });

  describe('clearNoAddFocus', () => {
    it('clears all NoAdd state', () => {
      useIDEStore.getState().setNoAddModeEnabled(true);
      useIDEStore.getState().setNoAddObjective('Task');
      useIDEStore.getState().setNoAddDefinitionOfDone('Done');
      useIDEStore.getState().setNoAddRoleProfile('Eng');
      useIDEStore.getState().clearNoAddFocus();
      const state = useIDEStore.getState();
      expect(state.noAddModeEnabled).toBe(false);
      expect(state.noAddObjective).toBe('');
      expect(state.noAddDefinitionOfDone).toBe('');
      expect(state.noAddRoleProfile).toBe('Eng');
    });
  });
});
