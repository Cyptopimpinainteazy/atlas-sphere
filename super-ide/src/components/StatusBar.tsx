import { useEffect, useState } from 'react';
import { getRalphTaskState, type RalphTaskState } from '../lib/api';
import { useIDEStore } from '../store/ideStore';

export function StatusBar() {
  const {
    ollamaConnected,
    chatModel,
    availableModels,
    activeTabId,
    openTabs,
    editorCursorLine,
    editorCursorColumn,
    noAddModeEnabled,
    noAddObjective,
    setNoAddModeEnabled,
    workspaceRoot,
  } = useIDEStore();
  const [ralphTaskState, setRalphTaskState] = useState<RalphTaskState | null>(null);

  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const langName = activeTab?.language || 'Plain Text';
  const langDisplay =
    langName === 'sol'
      ? 'Solidity'
      : langName === 'typescriptreact'
      ? 'TypeScript React'
      : langName === 'typescript'
      ? 'TypeScript'
      : langName === 'javascript'
      ? 'JavaScript'
      : langName.charAt(0).toUpperCase() + langName.slice(1);

  useEffect(() => {
    let cancelled = false;

    const loadRalphState = async () => {
      try {
        const state = await getRalphTaskState(workspaceRoot);
        if (!cancelled) {
          setRalphTaskState(state);
        }
      } catch {
        if (!cancelled) {
          setRalphTaskState(null);
        }
      }
    };

    void loadRalphState();
    const interval = window.setInterval(loadRalphState, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [workspaceRoot, noAddModeEnabled, activeTabId]);

  const ralphBadgeText = !ralphTaskState
    ? ''
    : !ralphTaskState.exists
    ? 'RALPH state: missing'
    : !ralphTaskState.valid
    ? 'RALPH state: invalid'
    : `RALPH state: ${ralphTaskState.checklistRemaining} left`;

  return (
    <div className="h-6 bg-ide-accent/90 text-white text-[11px] flex items-center px-3 select-none">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${ollamaConnected ? 'bg-green-300' : 'bg-red-300'}`} />
          {ollamaConnected ? 'Ollama' : 'Ollama ✕'}
        </span>

        {ollamaConnected && (
          <span className="opacity-80">{chatModel}</span>
        )}

        <span className="opacity-80">
          {availableModels.length} model{availableModels.length !== 1 ? 's' : ''}
        </span>

        <button
          type="button"
          onClick={() => setNoAddModeEnabled(!noAddModeEnabled)}
          className={`max-w-56 truncate rounded px-1.5 py-0.5 ${
            noAddModeEnabled
              ? 'bg-amber-400/20 text-amber-100'
              : 'bg-white/10 text-white/70 hover:bg-white/15'
          }`}
          title={
            noAddModeEnabled
              ? 'Disable Ralph mode'
              : 'Enable Ralph mode (fresh-context focus lock)'
          }
        >
          {noAddModeEnabled ? `RALPH${noAddObjective ? `: ${noAddObjective}` : ''}` : 'RALPH OFF'}
        </button>

        {ralphBadgeText && (
          <span
            className={`max-w-52 truncate rounded px-1.5 py-0.5 ${
              !ralphTaskState?.exists
                ? 'bg-red-400/15 text-red-100'
                : ralphTaskState.valid
                ? 'bg-emerald-400/15 text-emerald-100'
                : 'bg-amber-400/20 text-amber-100'
            }`}
            title={
              ralphTaskState?.issues?.length
                ? `${ralphTaskState.path}\n${ralphTaskState.issues.map((issue) => `- ${issue}`).join('\n')}`
                : ralphTaskState?.path || ''
            }
          >
            {ralphBadgeText}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        {activeTab && (
          <>
            <span className="opacity-80">Ln {editorCursorLine}, Col {editorCursorColumn}</span>
            <span className="opacity-80">Spaces: 2</span>
            <span className="opacity-80">UTF-8</span>
            <span>{langDisplay}</span>
          </>
        )}
        <span className="opacity-60">Atlas SuperIDE v0.1.0</span>
      </div>
    </div>
  );
}
