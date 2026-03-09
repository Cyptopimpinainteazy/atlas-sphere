import { useIDEStore } from '../../store/ideStore';

export function TestOutputPanel() {
  const { testOutput, testHistory } = useIDEStore();

  const passRate = testHistory.length
    ? (
        (testHistory.reduce((sum, t) => sum + t.passed, 0) /
          (testHistory.reduce((sum, t) => sum + t.passed + t.failed, 0) || 1)) *
        100
      ).toFixed(1)
    : 'N/A';

  return (
    <div className="flex flex-col h-full">
      {/* Header with stats */}
      <div className="flex items-center justify-between px-3 py-2 bg-ide-surface border-b border-ide-border">
        <div className="flex items-center gap-4 text-xs text-ide-text-dim">
          <span>📊 Test Output {testHistory.length > 0 && `(${testHistory.length} runs)`}</span>
          {testHistory.length > 0 && (
            <>
              <span>Pass Rate: <span className="text-green-400">{passRate}%</span></span>
              <span>Latest: <span className={testHistory[0].failed > 0 ? 'text-red-400' : 'text-green-400'}>
                {testHistory[0].passed}✓ {testHistory[0].failed > 0 && `${testHistory[0].failed}✗`}
              </span></span>
            </>
          )}
        </div>
        <button 
          onClick={() => useIDEStore.getState().setTestOutput('')}
          className="text-xs px-2 py-1 bg-ide-border hover:bg-ide-panel rounded transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Test output */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px]">
        {testOutput ? (
          <pre className="whitespace-pre-wrap text-ide-text bg-ide-bg p-2 rounded border border-ide-border">
            {testOutput}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-ide-text-dim">
            <div className="text-center">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-xs">Run tests from the Testing Panel to see output here</p>
            </div>
          </div>
        )}
      </div>

      {/* History timeline (if any) */}
      {testHistory.length > 0 && (
        <div className="border-t border-ide-border p-3 bg-ide-bg text-[9px] max-h-20 overflow-y-auto">
          <p className="text-ide-text-dim font-semibold mb-2">Recent Runs:</p>
          <div className="space-y-1">
            {testHistory.slice(0, 5).map((run, i) => (
              <div key={i} className="flex items-center gap-2 text-ide-text-dim">
                <span className="text-[8px] text-ide-text-dim">
                  {new Date(run.timestamp).toLocaleTimeString()}
                </span>
                <span className={run.failed === 0 ? 'text-green-400' : 'text-red-400'}>
                  {run.passed}✓ {run.failed > 0 && `${run.failed}✗`}
                </span>
                <span className="text-[8px] text-ide-text-dim">({run.duration}ms)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
