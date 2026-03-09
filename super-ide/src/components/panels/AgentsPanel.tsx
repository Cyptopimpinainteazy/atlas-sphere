import { useEffect, useMemo, useState } from 'react';
import {
  agentRunCancel,
  agentRunCreate,
  agentRunsList,
  getRalphTaskState,
  openWorkspaceFile,
  saveWorkspaceFile,
  type RalphTaskState,
} from '../../lib/api';
import {
  AGENT_PROMPT_PRESETS,
  useIDEStore,
  type AgentExecutionMode,
  type FileTab,
  type AgentProfile,
  type AgentRun,
  type AgentProvider,
  type AgentRunStatus,
} from '../../store/ideStore';

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    md: 'markdown',
    log: 'plaintext',
    txt: 'plaintext',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
  };
  return map[ext || ''] || 'plaintext';
}

function buildRalphRepairTemplate(state: RalphTaskState | null, fallbackObjective: string): string {
  const objective =
    state?.objective?.trim() ||
    fallbackObjective.trim() ||
    'Define the active Ralph objective';

  return [
    `task: ${objective}`,
    '',
    '# ralph task',
    '',
    '## objective',
    objective,
    '',
    '## success criteria',
    '- [ ] Replace this with the first concrete acceptance check',
    '- [ ] Replace this with the second concrete acceptance check',
    '',
  ].join('\n');
}

function buildRalphRepairDiff(currentContent: string, nextContent: string): string {
  const currentLines = currentContent.split('\n');
  const nextLines = nextContent.split('\n');
  const maxLines = Math.max(currentLines.length, nextLines.length);
  const preview: string[] = [];

  for (let index = 0; index < maxLines; index += 1) {
    const currentLine = currentLines[index] ?? '';
    const nextLine = nextLines[index] ?? '';
    if (currentLine === nextLine) {
      continue;
    }
    if (currentLine) {
      preview.push(`- ${currentLine}`);
    }
    if (nextLine) {
      preview.push(`+ ${nextLine}`);
    }
    if (preview.length >= 12) {
      break;
    }
  }

  return preview.join('\n') || '(no textual diff)';
}

function parseCsvList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatCsvList(values: string[]): string {
  return values.join(', ');
}

function toAgentRun(input: any): AgentRun {
  return {
    id: input.id,
    objective: input.objective || '',
    definitionOfDone: input.definitionOfDone || '',
    executionMode: (input.executionMode || 'parallel') as AgentExecutionMode,
    status: (input.status || 'queued') as AgentRunStatus,
    createdAt: input.createdAt || Date.now(),
    updatedAt: input.updatedAt || Date.now(),
    summary: input.summary || '',
    ralphMode: Boolean(input.ralphMode),
    ralphLoop: Boolean(input.ralphLoop),
    maxIterations: input.maxIterations || 0,
    iterationCount: input.iterationCount || 0,
    checklist: input.checklist
      ? {
          total: input.checklist.total || 0,
          completed: input.checklist.completed || 0,
          remaining: Array.isArray(input.checklist.remaining) ? input.checklist.remaining : [],
        }
      : undefined,
    agents: Array.isArray(input.agents)
      ? input.agents.map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          provider: (agent.provider || 'ollama') as AgentProvider,
          model: agent.model || '',
          status: (agent.status || 'queued') as AgentRunStatus,
          output: agent.output || '',
          error: agent.error || '',
        }))
      : [],
  };
}

const PROVIDERS: AgentProvider[] = ['ollama', 'openrouter', 'ollamafree', 'gptoss'];

export function AgentsPanel() {
  const {
    agentProfiles,
    addAgentProfile,
    updateAgentProfile,
    removeAgentProfile,
    agentRuns,
    setAgentRuns,
    upsertAgentRun,
    availableModels,
    workspaceRoot,
    noAddModeEnabled,
    noAddObjective,
    noAddDefinitionOfDone,
    noAddRoleProfile,
    openTab,
  } = useIDEStore();

  const [objective, setObjective] = useState('');
  const [definitionOfDone, setDefinitionOfDone] = useState('');
  const [executionMode, setExecutionMode] = useState<AgentExecutionMode>('parallel');
  const [ralphLoopMaxIterations, setRalphLoopMaxIterations] = useState(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [ralphTaskState, setRalphTaskState] = useState<RalphTaskState | null>(null);

  const runningCount = useMemo(
    () => agentRuns.filter((run) => run.status === 'queued' || run.status === 'running').length,
    [agentRuns],
  );

  useEffect(() => {
    let cancelled = false;

    const loadRuns = async () => {
      try {
        const runs = await agentRunsList();
        if (!cancelled) {
          setAgentRuns(runs.map(toAgentRun));
        }
      } catch (err) {
        if (!cancelled) {
          setStatus(err instanceof Error ? err.message : 'Failed to load agent runs.');
        }
      }
    };

    void loadRuns();
    const interval = window.setInterval(loadRuns, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [setAgentRuns]);

  useEffect(() => {
    let cancelled = false;

    const loadRalphState = async () => {
      if (!noAddModeEnabled) {
        if (!cancelled) {
          setRalphTaskState(null);
        }
        return;
      }

      try {
        const nextState = await getRalphTaskState(workspaceRoot);
        if (!cancelled) {
          setRalphTaskState(nextState);
        }
      } catch {
        if (!cancelled) {
          setRalphTaskState(null);
        }
      }
    };

    void loadRalphState();
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, noAddModeEnabled, status]);

  const handleUpdateProfile = (id: string, updates: Partial<AgentProfile>) => {
    updateAgentProfile(id, updates);
  };

  const getMatchingPresetId = (profile: AgentProfile) =>
    AGENT_PROMPT_PRESETS.find(
      (preset) => preset.role === profile.role && preset.prompt === profile.systemPrompt,
    )?.id || '';

  const handleApplyPreset = (id: string, presetId: string) => {
    const preset = AGENT_PROMPT_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    handleUpdateProfile(id, {
      role: preset.role,
      systemPrompt: preset.prompt,
    });
  };

  const handleOpenClawPolicyJsonBlur = (profile: AgentProfile, rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      handleUpdateProfile(profile.id, {
        openclawTools: {
          ...profile.openclawTools,
          byProvider: {},
        },
      });
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('OpenClaw by-provider policy must be a JSON object.');
      }
      handleUpdateProfile(profile.id, {
        openclawTools: {
          ...profile.openclawTools,
          byProvider: parsed as AgentProfile['openclawTools']['byProvider'],
        },
      });
      setStatus('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'OpenClaw by-provider policy must be valid JSON.');
    }
  };

  const openRalphEditor = async (relativePath: string, announceOnSuccess = true) => {
    const filePath =
      workspaceRoot && workspaceRoot !== '.'
        ? `${workspaceRoot.replace(/\/+$/, '')}/${relativePath}`
        : relativePath;
    try {
      const data = await openWorkspaceFile(filePath);
      const tab: FileTab = {
        id: data.path,
        name: data.path.split('/').pop() || data.path,
        path: data.path,
        language: getLanguageFromPath(data.path),
        content: data.content,
        isDirty: false,
      };
      openTab(tab);
      if (announceOnSuccess) {
        setStatus(`Opened ${relativePath}.`);
      }
      return true;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : `Failed to open ${relativePath}.`);
      return false;
    }
  };

  const handleRepairRalphTask = async () => {
    const filePath =
      workspaceRoot && workspaceRoot !== '.'
        ? `${workspaceRoot.replace(/\/+$/, '')}/.ralph/ralph_task.md`
        : '.ralph/ralph_task.md';

    try {
      const content = buildRalphRepairTemplate(ralphTaskState, noAddObjective || objective);

      if (ralphTaskState?.exists) {
        const existing = await openWorkspaceFile(filePath);
        if (existing.content.trim() !== content.trim()) {
          const confirmed = window.confirm(
            [
              `Replace ${filePath} with a repaired Ralph checklist template?`,
              '',
              'Preview:',
              buildRalphRepairDiff(existing.content, content),
            ].join('\n'),
          );
          if (!confirmed) {
            setStatus('Ralph task repair cancelled.');
            return;
          }
        }
      }

      await saveWorkspaceFile(filePath, content);
      const nextState = await getRalphTaskState(workspaceRoot);
      setRalphTaskState(nextState);
      await openRalphEditor('.ralph/ralph_task.md', false);
      setStatus(`Repaired ${filePath} with a valid Ralph checklist template.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to repair Ralph task template.');
    }
  };

  const handleStartRun = async ({
    asRalphLoop = false,
    resumeRalph = false,
  }: {
    asRalphLoop?: boolean;
    resumeRalph?: boolean;
  } = {}) => {
    const enabledAgents = agentProfiles.filter((profile) => profile.enabled);
    const effectiveObjective = (objective.trim() || (noAddModeEnabled ? noAddObjective.trim() : '')).trim();
    const effectiveDefinition = (
      definitionOfDone.trim() || (noAddModeEnabled ? noAddDefinitionOfDone.trim() : '')
    ).trim();
    const ralphObjective = (noAddObjective.trim() || effectiveObjective).trim();
    const ralphDefinition = (noAddDefinitionOfDone.trim() || effectiveDefinition).trim();

    if (!resumeRalph && !effectiveObjective) {
      setStatus('Objective is required.');
      return;
    }
    if (asRalphLoop) {
      try {
        const taskState = await getRalphTaskState(workspaceRoot);
        setRalphTaskState(taskState);
        if (resumeRalph && !taskState.exists) {
          setStatus(`Cannot resume Ralph loop: ${taskState.path} is missing.`);
          return;
        }
        if (taskState.exists && !taskState.valid) {
          await openRalphEditor('.ralph/ralph_task.md', false);
          setStatus(
            `Fix ${taskState.path} before running Ralph loop: ${taskState.issues.join(' | ') || 'invalid checklist'}.`,
          );
          return;
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Failed to validate Ralph task state.');
        return;
      }
    }
    if (enabledAgents.length === 0) {
      setStatus('Enable at least one agent.');
      return;
    }

    setIsSubmitting(true);
    setStatus('');
    try {
      const run = await agentRunCreate({
        objective: resumeRalph ? '' : effectiveObjective,
        definitionOfDone: effectiveDefinition,
        executionMode,
        workspaceRoot,
        ralphMode: noAddModeEnabled || asRalphLoop,
        ralphLoop: asRalphLoop,
        resumeRalph,
        maxIterations: asRalphLoop ? Math.max(1, Math.min(ralphLoopMaxIterations, 25)) : undefined,
        ralphState: noAddModeEnabled || asRalphLoop
          ? {
              objective: ralphObjective,
              definitionOfDone: ralphDefinition,
              roleProfile: noAddRoleProfile.trim(),
            }
          : undefined,
        agents: enabledAgents,
      });
      upsertAgentRun(toAgentRun(run));
      setStatus(
        resumeRalph
          ? 'Ralph loop resumed.'
          : asRalphLoop
          ? 'Ralph loop started.'
          : 'Agent run started.',
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to start agent run.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRun = async (runId: string) => {
    try {
      await agentRunCancel(runId);
      setStatus(`Cancelling ${runId}...`);
      const runs = await agentRunsList();
      setAgentRuns(runs.map(toAgentRun));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to cancel run.');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header flex items-center justify-between">
        <span>🤝 Agents</span>
        <span className="text-[10px] text-ide-text-dim">
          {agentProfiles.filter((profile) => profile.enabled).length} enabled • {runningCount} active
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="space-y-2">
          {noAddModeEnabled && (
            <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-100">
              Ralph mode is active. This run will write durable state to `.ralph/` under
              {' '}
              {workspaceRoot || '.'}
              {' '}
              and reuse the anchor task if you leave these fields blank.
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void openRalphEditor('.ralph/ralph_task.md')}
                  className="action-btn text-[10px]"
                >
                  Open Task
                </button>
                <button
                  type="button"
                  onClick={() => void openRalphEditor('.ralph/guardrails.md')}
                  className="action-btn text-[10px]"
                >
                  Open Guardrails
                </button>
                <button
                  type="button"
                  onClick={() => void openRalphEditor('.ralph/progress.md')}
                  className="action-btn text-[10px]"
                >
                  Open Progress
                </button>
              </div>
              {ralphTaskState && (
                <div className="mt-2 rounded border border-amber-500/20 bg-black/10 px-2 py-1 text-[10px]">
                  {!ralphTaskState.exists ? (
                    <span>{ralphTaskState.path} is missing. A new file will be created when you start a fresh Ralph loop.</span>
                  ) : ralphTaskState.valid ? (
                    <span>
                      Ralph task is valid: {ralphTaskState.checklistCompleted}/{ralphTaskState.checklistTotal} complete,
                      {' '}
                      {ralphTaskState.checklistRemaining}
                      {' '}
                      remaining.
                    </span>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span>Ralph task is invalid.</span>
                        <button
                          type="button"
                          onClick={() => void openRalphEditor('.ralph/ralph_task.md')}
                          className="action-btn text-[10px]"
                        >
                          Fix Checklist
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRepairRalphTask()}
                          className="action-btn text-[10px]"
                        >
                          Repair Template
                        </button>
                      </div>
                      <div className="space-y-1 text-amber-200">
                        {ralphTaskState.issues.map((issue) => (
                          <div key={issue}>- {issue}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-ide-text-dim">
              Objective
            </label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
              className="input-field resize-none text-xs"
              placeholder="Describe the shared task all agents should work on."
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-ide-text-dim">
              Definition Of Done
            </label>
            <textarea
              value={definitionOfDone}
              onChange={(e) => setDefinitionOfDone(e.target.value)}
              rows={3}
              className="input-field resize-none text-xs"
              placeholder="State the acceptance checks that must be complete."
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-ide-text-dim">
              Execution Mode
            </label>
            <select
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value as AgentExecutionMode)}
              className="input-field text-xs"
            >
              <option value="parallel">Parallel</option>
              <option value="sequential">Sequential</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-ide-text-dim">Agent Profiles</span>
            <button onClick={addAgentProfile} className="action-btn text-xs">
              Add Agent
            </button>
          </div>

          {agentProfiles.map((profile) => (
            <div key={profile.id} className="space-y-2 rounded border border-ide-border bg-ide-bg p-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profile.enabled}
                  onChange={(e) => handleUpdateProfile(profile.id, { enabled: e.target.checked })}
                />
                <input
                  value={profile.name}
                  onChange={(e) => handleUpdateProfile(profile.id, { name: e.target.value })}
                  className="input-field flex-1 text-xs"
                  placeholder="Agent name"
                />
                <button
                  onClick={() => removeAgentProfile(profile.id)}
                  className="text-xs text-ide-text-dim hover:text-red-400"
                  title="Remove agent"
                >
                  ✕
                </button>
              </div>

              <input
                value={profile.role}
                onChange={(e) => handleUpdateProfile(profile.id, { role: e.target.value })}
                className="input-field text-xs"
                placeholder="Role"
              />

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-ide-text-dim">
                  Prompt Template
                </label>
                <select
                  value={getMatchingPresetId(profile)}
                  onChange={(e) => handleApplyPreset(profile.id, e.target.value)}
                  className="input-field text-xs"
                >
                  <option value="">Custom Prompt</option>
                  {AGENT_PROMPT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={profile.provider}
                  onChange={(e) =>
                    handleUpdateProfile(profile.id, { provider: e.target.value as AgentProvider })
                  }
                  className="input-field text-xs"
                >
                  {PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>

                {profile.provider === 'ollama' && availableModels.length > 0 ? (
                  <select
                    value={profile.model}
                    onChange={(e) => handleUpdateProfile(profile.id, { model: e.target.value })}
                    className="input-field text-xs"
                  >
                    <option value="">Select Ollama model</option>
                    {availableModels.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={profile.model}
                    onChange={(e) => handleUpdateProfile(profile.id, { model: e.target.value })}
                    className="input-field text-xs"
                    placeholder="Model"
                  />
                )}
              </div>

              <textarea
                value={profile.systemPrompt}
                onChange={(e) => handleUpdateProfile(profile.id, { systemPrompt: e.target.value })}
                rows={3}
                className="input-field resize-none text-xs"
                placeholder="Special instructions for this agent"
              />

              <div className="space-y-2 rounded border border-ide-border/60 bg-ide-surface/60 p-2">
                <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">
                  OpenClaw Tool Policy
                </div>

                <select
                  value={profile.openclawTools.profile}
                  onChange={(e) =>
                    handleUpdateProfile(profile.id, {
                      openclawTools: {
                        ...profile.openclawTools,
                        profile: e.target.value as AgentProfile['openclawTools']['profile'],
                      },
                    })
                  }
                  className="input-field text-xs"
                >
                  <option value="minimal">minimal</option>
                  <option value="coding">coding</option>
                  <option value="messaging">messaging</option>
                  <option value="full">full</option>
                </select>

                <input
                  value={formatCsvList(profile.openclawTools.allow)}
                  onChange={(e) =>
                    handleUpdateProfile(profile.id, {
                      openclawTools: {
                        ...profile.openclawTools,
                        allow: parseCsvList(e.target.value),
                      },
                    })
                  }
                  className="input-field text-xs"
                  placeholder="Allow list (comma-separated)"
                />

                <input
                  value={formatCsvList(profile.openclawTools.deny)}
                  onChange={(e) =>
                    handleUpdateProfile(profile.id, {
                      openclawTools: {
                        ...profile.openclawTools,
                        deny: parseCsvList(e.target.value),
                      },
                    })
                  }
                  className="input-field text-xs"
                  placeholder="Deny list (comma-separated)"
                />

                <textarea
                  defaultValue={JSON.stringify(profile.openclawTools.byProvider, null, 2)}
                  onBlur={(e) => handleOpenClawPolicyJsonBlur(profile, e.target.value)}
                  rows={5}
                  className="input-field resize-none font-mono text-[11px]"
                  placeholder={'{"openai/gpt-5.2": {"allow": ["group:fs"]}}'}
                />
              </div>
            </div>
          ))}
        </div>

        {noAddModeEnabled ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase tracking-wider text-ide-text-dim">
                Ralph Iterations
              </label>
              <input
                type="number"
                min={1}
                max={25}
                value={ralphLoopMaxIterations}
                onChange={(e) =>
                  setRalphLoopMaxIterations(Math.max(1, Math.min(Number(e.target.value) || 1, 25)))
                }
                className="input-field w-20 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => void handleStartRun()}
                disabled={isSubmitting}
                className="action-btn py-2"
              >
                {isSubmitting ? 'Starting...' : 'Run Agents'}
              </button>
              <button
                onClick={() => void handleStartRun({ asRalphLoop: true })}
                disabled={isSubmitting}
                className="action-btn py-2"
              >
                {isSubmitting ? 'Starting...' : 'Run Ralph Loop'}
              </button>
            </div>
            <button
              onClick={() => void handleStartRun({ asRalphLoop: true, resumeRalph: true })}
              disabled={isSubmitting}
              className="action-btn w-full py-2"
            >
              {isSubmitting ? 'Starting...' : 'Resume Ralph Loop'}
            </button>
          </div>
        ) : (
          <button onClick={() => void handleStartRun()} disabled={isSubmitting} className="action-btn w-full py-2">
            {isSubmitting ? 'Starting...' : 'Run Agents'}
          </button>
        )}

        {status && (
          <div className="rounded border border-ide-border bg-ide-bg p-2 text-xs text-ide-text-dim">
            {status}
          </div>
        )}

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-ide-text-dim">Runs</div>
          {agentRuns.length === 0 ? (
            <p className="text-xs text-ide-text-dim">No runs yet.</p>
          ) : (
            agentRuns.map((run) => (
              <div key={run.id} className="space-y-2 rounded border border-ide-border bg-ide-bg p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-ide-text">{run.objective}</div>
                    <div className="text-[10px] text-ide-text-dim">
                      {run.ralphLoop ? 'ralph-loop' : run.executionMode}
                      {' '}
                      •
                      {' '}
                      {run.status}
                      {run.ralphLoop && run.iterationCount
                        ? ` • iteration ${run.iterationCount}/${run.maxIterations || '?'}`
                        : ''}
                      {' '}
                      •
                      {' '}
                      {new Date(run.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  {(run.status === 'queued' || run.status === 'running') && (
                    <button
                      onClick={() => void handleCancelRun(run.id)}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {run.definitionOfDone && (
                  <div className="text-[10px] text-ide-text-dim">
                    Done when: {run.definitionOfDone}
                  </div>
                )}

                {run.checklist && run.checklist.total > 0 && (
                  <div className="rounded bg-amber-500/5 px-2 py-1 text-[10px] text-amber-100">
                    Checklist: {run.checklist.completed}/{run.checklist.total} complete
                    {run.checklist.remaining.length > 0 && (
                      <div className="mt-1 text-amber-200">
                        Remaining: {run.checklist.remaining.join(' • ')}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  {run.agents.map((agent) => (
                    <div key={agent.id} className="rounded bg-ide-surface px-2 py-1">
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-ide-text">
                          {agent.name} • {agent.provider}/{agent.model || 'no-model'}
                        </span>
                        <span className="text-ide-text-dim">{agent.status}</span>
                      </div>
                      {(agent.output || agent.error) && (
                        <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-[10px] text-ide-text-dim">
                          {agent.error || agent.output}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>

                {run.summary && (
                  <details className="rounded border border-ide-border bg-ide-surface p-2">
                    <summary className="cursor-pointer text-[10px] text-ide-text-dim">Summary</summary>
                    <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-[10px] text-ide-text">
                      {run.summary}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
