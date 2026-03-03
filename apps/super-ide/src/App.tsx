import { useEffect } from 'react';
import { useIDEStore } from './store/ideStore';
import { Sidebar } from './components/Sidebar';
import { EditorArea } from './components/EditorArea';
import { SidePanel } from './components/SidePanel';
import { TestingPanel } from './components/panels/TestingPanel';
import { BottomPanel } from './components/BottomPanel';
import { TitleBar } from './components/TitleBar';
import { StatusBar } from './components/StatusBar';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { ollamaListModels, healthCheck } from './lib/api';

export default function App() {
  const { setAvailableModels, setOllamaConnected, isSidebarOpen, isBottomPanelOpen, openTabs, openTab } =
    useIDEStore();

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

      {/* Main Content - flex row with sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar (icon sidebar) */}
        <Sidebar />

        {/* Side Panel (explorer, AI chat, RAG, etc.) */}
        {isSidebarOpen && <SidePanel />}

        {/* Central Area: Resizable Editor + Testing Panel */}
        <div className="flex flex-col flex-1 h-full min-w-0">
          {/* Resizable Editor + Testing panels */}
          <div className="flex-1 h-full min-h-0 w-full">
            <PanelGroup direction="horizontal" className="h-full">
              <Panel
                defaultSize={75}
                minSize={30}
              >
                <EditorArea />
              </Panel>

              <PanelResizeHandle className="w-1 bg-ide-border hover:bg-ide-accent/50 transition-colors cursor-col-resize" />

              <Panel
                defaultSize={25}
                minSize={15}
                maxSize={50}
              >
                <TestingPanel />
              </Panel>
            </PanelGroup>
          </div>

          {/* Bottom Panel */}
          {isBottomPanelOpen && <BottomPanel />}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
