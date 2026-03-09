import { useMemo } from 'react';
import { useIDEStore } from '../../store/ideStore';

interface OutlineItem {
  label: string;
  line: number;
  kind: 'heading' | 'symbol';
}

function buildOutline(content: string): OutlineItem[] {
  return content
    .split('\n')
    .map((line, index) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return null;
      }

      if (trimmed.startsWith('#')) {
        return {
          label: trimmed.replace(/^#+\s*/, ''),
          line: index + 1,
          kind: 'heading' as const,
        };
      }

      const symbolMatch =
        trimmed.match(/^(export\s+)?(async\s+)?function\s+([A-Za-z0-9_]+)/) ||
        trimmed.match(/^(const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(async\s*)?\(/) ||
        trimmed.match(/^class\s+([A-Za-z0-9_]+)/) ||
        trimmed.match(/^interface\s+([A-Za-z0-9_]+)/) ||
        trimmed.match(/^type\s+([A-Za-z0-9_]+)/) ||
        trimmed.match(/^contract\s+([A-Za-z0-9_]+)/);

      if (!symbolMatch) {
        return null;
      }

      const label = symbolMatch[symbolMatch.length - 1];
      return {
        label,
        line: index + 1,
        kind: 'symbol' as const,
      };
    })
    .filter(Boolean) as OutlineItem[];
}

export function OutlinePanel() {
  const { openTabs, activeTabId, openTab } = useIDEStore();
  const activeTab = openTabs.find((tab) => tab.id === activeTabId) || null;

  const outline = useMemo(
    () => (activeTab ? buildOutline(activeTab.content) : []),
    [activeTab],
  );

  const jumpToLine = (line: number) => {
    if (!activeTab) {
      return;
    }

    openTab({
      ...activeTab,
      cursorLine: line,
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header">
        <span>🧭 Outline</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!activeTab ? (
          <p className="text-xs text-ide-text-dim">Open a file to inspect its structure.</p>
        ) : outline.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-ide-text">No outline symbols found for `{activeTab.name}`.</p>
            <p className="text-[10px] text-ide-text-dim">
              Markdown headings, functions, classes, interfaces, types, and contracts show here.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {outline.map((item) => (
              <button
                key={`${item.kind}-${item.line}-${item.label}`}
                onClick={() => jumpToLine(item.line)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-ide-surface"
              >
                <span className={item.kind === 'heading' ? 'text-ide-accent' : 'text-ide-text-dim'}>
                  {item.kind === 'heading' ? '#' : 'ƒ'}
                </span>
                <span className="min-w-0 flex-1 truncate text-ide-text">{item.label}</span>
                <span className="text-[10px] text-ide-text-dim">Ln {item.line}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
