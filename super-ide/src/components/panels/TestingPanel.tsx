import { useState } from 'react';
import { useIDEStore } from '../../store/ideStore';
import { runForgeTests, runSlitherSecurity, runSolhintLinting } from '../../lib/api';

export function TestingPanel() {
  const [activeTab, setActiveTab] = useState<'testing' | 'linting' | 'security'>('testing');
  const [isRunning, setIsRunning] = useState(false);
  const [runOutput, setRunOutput] = useState<string>('');
  
  const { activeTabId, openTabs } = useIDEStore();
  const currentTab = openTabs.find((t) => t.id === activeTabId);

  const handleRunTests = async () => {
    if (!currentTab?.path) return;
    setIsRunning(true);
    setRunOutput('⏳ Running tests...\n');
    
    try {
      const result = await runForgeTests();
      setRunOutput(result.output || 'Tests completed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunOutput(`❌ Error: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunLinting = async () => {
    if (!currentTab?.path) return;
    setIsRunning(true);
    setRunOutput('⏳ Running linter...\n');
    
    try {
      const result = await runSolhintLinting(currentTab.path);
      setRunOutput(result.output || 'Lint check completed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunOutput(`❌ Error: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunSecurity = async () => {
    if (!currentTab?.path) return;
    setIsRunning(true);
    setRunOutput('⏳ Running security scan...\n');
    
    try {
      const result = await runSlitherSecurity(currentTab.path);
      setRunOutput(result.output || 'Security scan completed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunOutput(`❌ Error: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-ide-surface border-l border-ide-border overflow-hidden">
      {/* Tab Bar */}
      <div className="flex border-b border-ide-border bg-ide-bg">
        {[
          { id: 'testing', label: '🧪 Testing', icon: '⟡' },
          { id: 'linting', label: '📋 Linting', icon: '✓' },
          { id: 'security', label: '🔒 Security', icon: '⚠️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 px-3 py-2 text-xs font-medium border-r border-ide-border transition-colors ${
              activeTab === tab.id
                ? 'bg-ide-accent text-ide-bg'
                : 'text-ide-text-dim hover:bg-ide-surface/80'
            }`}
            title={tab.label}
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.icon}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Tab Content */}
        {activeTab === 'testing' && (
          <div className="flex flex-col h-full p-3 overflow-auto">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-ide-text mb-2">⟡ Forge Tests</p>
                <p className="text-xs text-ide-text-dim mb-2">Run Solidity unit tests with Forge</p>
                <button
                  onClick={handleRunTests}
                  disabled={isRunning || !currentTab}
                  className="w-full px-3 py-2 bg-ide-accent text-ide-bg rounded text-xs font-medium hover:bg-ide-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRunning ? '⏳ Running...' : '▶ Run Tests'}
                </button>
              </div>

              {runOutput && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-ide-text mb-1">Output:</p>
                  <div className="bg-ide-bg rounded p-2 h-48 overflow-auto border border-ide-border">
                    <pre className="text-[11px] text-ide-text-dim whitespace-pre-wrap break-words font-mono">
                      {runOutput}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'linting' && (
          <div className="flex flex-col h-full p-3 overflow-auto">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-ide-text mb-2">✓ Code Linting</p>
                <p className="text-xs text-ide-text-dim mb-2">Check code style & best practices with solhint</p>
                <button
                  onClick={handleRunLinting}
                  disabled={isRunning || !currentTab}
                  className="w-full px-3 py-2 bg-ide-accent text-ide-bg rounded text-xs font-medium hover:bg-ide-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRunning ? '⏳ Linting...' : '▶ Run Lint'}
                </button>
              </div>

              {runOutput && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-ide-text mb-1">Output:</p>
                  <div className="bg-ide-bg rounded p-2 h-48 overflow-auto border border-ide-border">
                    <pre className="text-[11px] text-ide-text-dim whitespace-pre-wrap break-words font-mono">
                      {runOutput}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="flex flex-col h-full p-3 overflow-auto">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-ide-text mb-2">⚠️ Security Scan</p>
                <p className="text-xs text-ide-text-dim mb-2">Find vulnerabilities with Slither</p>
                <button
                  onClick={handleRunSecurity}
                  disabled={isRunning || !currentTab}
                  className="w-full px-3 py-2 bg-ide-accent text-ide-bg rounded text-xs font-medium hover:bg-ide-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRunning ? '⏳ Scanning...' : '▶ Run Security'}
                </button>
              </div>

              {runOutput && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-ide-text mb-1">Output:</p>
                  <div className="bg-ide-bg rounded p-2 h-48 overflow-auto border border-ide-border">
                    <pre className="text-[11px] text-ide-text-dim whitespace-pre-wrap break-words font-mono">
                      {runOutput}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className="border-t border-ide-border px-3 py-2 text-[10px] text-ide-text-dim bg-ide-bg">
        {currentTab?.path ? `📄 ${currentTab.path}` : '⚠️ No file selected'}
      </div>
    </div>
  );
}
