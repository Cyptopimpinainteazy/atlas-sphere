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
  } = useIDEStore();

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
