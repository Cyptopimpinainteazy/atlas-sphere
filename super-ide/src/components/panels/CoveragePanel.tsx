import { useIDEStore } from '../../store/ideStore';
import { useState, useEffect } from 'react';

interface CoverageMetric {
  file: string;
  lines: number;
  linesCovered: number;
  branches: number;
  branchesCovered: number;
  functions: number;
  functionsCovered: number;
}

export function CoveragePanel() {
  const { activeTabId, openTabs } = useIDEStore();
  const [coverageData, setCoverageData] = useState<CoverageMetric[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const activeFile = openTabs.find((t) => t.id === activeTabId);

  const generateCoverage = async () => {
    if (!activeFile) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/testing/coverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: activeFile.path,
          code: activeFile.content,
        }),
      });
      const data = await response.json();
      setCoverageData(data.metrics || []);
    } catch (err) {
      console.error('Coverage generation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const totalMetrics = coverageData.reduce(
    (acc, m) => ({
      lines: acc.lines + m.lines,
      linesCovered: acc.linesCovered + m.linesCovered,
      branches: acc.branches + m.branches,
      branchesCovered: acc.branchesCovered + m.branchesCovered,
      functions: acc.functions + m.functions,
      functionsCovered: acc.functionsCovered + m.functionsCovered,
    }),
    { lines: 0, linesCovered: 0, branches: 0, branchesCovered: 0, functions: 0, functionsCovered: 0 }
  );

  const lineCoverage = totalMetrics.lines > 0 ? (totalMetrics.linesCovered / totalMetrics.lines) * 100 : 0;
  const branchCoverage = totalMetrics.branches > 0 ? (totalMetrics.branchesCovered / totalMetrics.branches) * 100 : 0;
  const funcCoverage = totalMetrics.functions > 0 ? (totalMetrics.functionsCovered / totalMetrics.functions) * 100 : 0;

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 80) return 'text-green-400';
    if (coverage >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCoverageBgColor = (coverage: number) => {
    if (coverage >= 80) return 'bg-green-500/20';
    if (coverage >= 60) return 'bg-yellow-500/20';
    return 'bg-red-500/20';
  };
  return (
    <div className="flex flex-col h-full gap-3 p-3">
      <div>
        <h3 className="text-sm font-semibold text-ide-text mb-1">📊 Code Coverage</h3>
        <p className="text-xs text-ide-text-dim">Coverage metrics for {activeFile?.path || 'all files'}</p>
      </div>

      <button
        onClick={generateCoverage}
        disabled={!activeFile || isLoading}
        className="w-full px-3 py-2 bg-ide-accent hover:bg-ide-accent/80 disabled:bg-ide-border text-white text-xs font-medium rounded-md transition-colors"
      >
        {isLoading ? '⏳ Analyzing...' : '📊 Generate Coverage Report'}
      </button>

      {coverageData.length > 0 && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="bg-ide-surface rounded-lg border border-ide-border p-3 space-y-2">
            <h4 className="text-xs font-semibold text-ide-text">Summary</h4>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ide-text-dim">Line Coverage</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-ide-bg rounded overflow-hidden">
                    <div 
                      className={`h-full ${getCoverageBgColor(lineCoverage)}`}
                      style={{ width: `${lineCoverage}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold ${getCoverageColor(lineCoverage)}`}>
                    {lineCoverage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ide-text-dim">Branch Coverage</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-ide-bg rounded overflow-hidden">
                    <div 
                      className={`h-full ${getCoverageBgColor(branchCoverage)}`}
                      style={{ width: `${branchCoverage}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold ${getCoverageColor(branchCoverage)}`}>
                    {branchCoverage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ide-text-dim">Function Coverage</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-ide-bg rounded overflow-hidden">
                    <div 
                      className={`h-full ${getCoverageBgColor(funcCoverage)}`}
                      style={{ width: `${funcCoverage}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold ${getCoverageColor(funcCoverage)}`}>
                    {funcCoverage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* File breakdown */}
          <div className="bg-ide-surface rounded-lg border border-ide-border p-3">
            <h4 className="text-xs font-semibold text-ide-text mb-2">Files</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {coverageData.map((metric, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-ide-text-dim truncate flex-1">{metric.file.split('/').pop()}</span>
                  <span className={getCoverageColor((metric.linesCovered / metric.lines) * 100)}>
                    {metric.linesCovered}/{metric.lines}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {coverageData.length === 0 && !isLoading && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <p className="text-2xl mb-2">📊</p>
            <p className="text-xs text-ide-text-dim">No coverage data</p>
            <p className="text-[10px] text-ide-text-dim mt-1">Run coverage analysis to see metrics</p>
          </div>
        </div>
      )}
    </div>
  );
}
