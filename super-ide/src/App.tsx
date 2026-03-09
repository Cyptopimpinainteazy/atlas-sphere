import { useEffect } from 'react';
import { useIDEStore } from './store/ideStore';
import { Sidebar } from './components/Sidebar';
import { EditorArea } from './components/EditorArea';
import { SidePanel } from './components/SidePanel';
import { RightSidebar } from './components/RightSidebar';
import { RightSidePanel } from './components/RightSidePanel';
import { BottomPanel } from './components/BottomPanel';
import { TitleBar } from './components/TitleBar';
import { StatusBar } from './components/StatusBar';
import { ollamaListModels, healthCheck } from './lib/api';

export default function App() {
  const {
    setAvailableModels,
    setOllamaConnected,
    isSidebarOpen,
    isBottomPanelOpen,
    isRightSidebarOpen,
    openTabs,
    openTab,
    noAddModeEnabled,
    noAddObjective,
    noAddDefinitionOfDone,
  } = useIDEStore();

  useEffect(() => {
    // Initialize with a sample file if no tabs open
    if (openTabs.length === 0) {
      openTab({
        id: 'welcome-sample',
        name: 'Sample.sol',
        path: 'Sample.sol',
        content: `// ⟠ Sample Solidity Contract
// Click the Testing panel on the right to run tests, linting, and security:
// • Forge: Solidity testing framework
// • Slither: Security vulnerability scanner  
// • Lint: Code style & best practices

pragma solidity ^0.8.0;

contract Sample {
    uint public value = 42;
    
    function getValue() public view returns (uint) {
        return value;
    }
    
    function setValue(uint newValue) public {
        value = newValue;
    }
}
`,
        language: 'sol',
        isDirty: false,
      });
    }
  }, [openTabs.length, openTab]);

  useEffect(() => {
    // Auto-discover Ollama models on startup (OpenClaw-style)
    const discover = async () => {
      try {
        const health = await healthCheck();
        setOllamaConnected(health.ollama);
        if (health.ollama) {
          const models = await ollamaListModels();
          setAvailableModels(models);
        }
      } catch {
        setOllamaConnected(false);
      }
    };
    discover();
    const interval = setInterval(discover, 30000);
    return () => clearInterval(interval);
  }, [setAvailableModels, setOllamaConnected]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-ide-bg">
      {/* Title Bar */}
      <TitleBar />

      {noAddModeEnabled && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">RALPH Mode</p>
              <p className="truncate">
                {noAddObjective ||
                  'No Ralph objective set yet. Open Settings → General and define the anchor task.'}
              </p>
            </div>
            {noAddDefinitionOfDone && (
              <span className="hidden md:block text-[10px] text-amber-200 max-w-[45%] truncate">
                Done when: {noAddDefinitionOfDone}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content - flex row with sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Activity Bar (icon sidebar) */}
        <Sidebar />

        {/* Left Side Panel (explorer, AI chat, RAG, etc.) */}
        {isSidebarOpen && <SidePanel />}

        {/* Central Area: Editor + Bottom Panel */}
        <div className="flex flex-col flex-1 h-full min-w-0">
          {/* Editor Area */}
          <div className="flex-1 h-full min-h-0 w-full">
            <EditorArea />
          </div>

          {/* Bottom Panel */}
          {isBottomPanelOpen && <BottomPanel />}
        </div>

        {/* Right Side Panel (bolt chat, testing, coverage, etc.) */}
        {isRightSidebarOpen && <RightSidePanel />}

        {/* Right Activity Bar (icon sidebar) */}
        <RightSidebar />
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
