import React from 'react';
import { useIDEStore } from '../../store/ideStore';

const BASH_HOOK = `#!/bin/bash
# Auto-generated pre-commit hook by Atlas SuperIDE
# Tests committed files before allowing commit

echo "🧪 Running pre-commit tests..."

# Call backend API to run tests
curl -s -X POST http://localhost:8420/api/testing/pre-commit \\
  -H "Content-Type: application/json" \\
  -d '{"files": ["'"$(git diff --cached --name-only | paste -sd, -)"'"]}' | jq .

# Check test results
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Commit blocked."
  exit 1
fi

echo "✅ Pre-commit tests passed."
exit 0
`;

export function GitIntegrationPanel() {
  const { setBottomPanel } = useIDEStore();
  const [hookStatus, setHookStatus] = React.useState<'installed' | 'not-installed' | 'error'>('not-installed');
  const [isInstalling, setIsInstalling] = React.useState(false);

  const checkHookStatus = async () => {
    try {
      const response = await fetch('/api/files/git-hook-status');
      const { installed } = await response.json();
      setHookStatus(installed ? 'installed' : 'not-installed');
    } catch {
      setHookStatus('error');
    }
  };

  const installPreCommitHook = async () => {
    setIsInstalling(true);
    try {
      const response = await fetch('/api/files/install-git-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hook: 'pre-commit', script: BASH_HOOK }),
      });
      const data = await response.json();
      if (data.success) {
        setHookStatus('installed');
      } else {
        setHookStatus('error');
      }
    } catch {
      setHookStatus('error');
    } finally {
      setIsInstalling(false);
    }
  };

  React.useEffect(() => {
    checkHookStatus();
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-ide-text mb-2">🔗 Git Integration</h3>
        <p className="text-xs text-ide-text-dim mb-4">Automatically run tests before commits</p>
      </div>

      <div className="space-y-3">
        <div className="bg-ide-surface rounded-lg p-3 border border-ide-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-ide-text">Pre-commit Hook</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              hookStatus === 'installed' 
                ? 'bg-green-500/20 text-green-400'
                : hookStatus === 'error'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {hookStatus === 'installed' ? '✅ Installed' : hookStatus === 'error' ? '⚠️ Error' : '⭕ Not Installed'}
            </span>
          </div>
          <p className="text-[10px] text-ide-text-dim mb-3">
            Run tests automatically before each commit to prevent broken code from being committed.
          </p>
          <button
            onClick={installPreCommitHook}
            disabled={hookStatus === 'installed' || isInstalling}
            className="w-full px-3 py-2 bg-ide-accent hover:bg-ide-accent/80 disabled:bg-ide-border text-white text-xs font-medium rounded-md transition-colors"
          >
            {isInstalling ? '⏳ Installing...' : hookStatus === 'installed' ? '✅ Installed' : 'Install Hook'}
          </button>
        </div>

        {hookStatus === 'installed' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-xs text-green-400 mb-2">✅ Pre-commit hook is active</p>
            <p className="text-[10px] text-green-400/80">
              Tests will run before each commit. Commits with failing tests will be blocked.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-ide-border">
        <h4 className="text-xs font-semibold text-ide-text mb-2">📋 Hook Details</h4>
        <div className="bg-ide-bg rounded p-2 border border-ide-border">
          <pre className="text-[8px] text-ide-text-dim overflow-x-auto whitespace-pre-wrap break-words max-h-32">
            {BASH_HOOK}
          </pre>
        </div>
      </div>
    </div>
  );
}
