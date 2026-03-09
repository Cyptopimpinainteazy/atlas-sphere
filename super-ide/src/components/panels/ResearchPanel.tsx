import { useState, useEffect } from 'react';
import { useIDEStore, type ResearchCard } from '../../store/ideStore';
import { researchDashboardStream, researchList, researchSave, researchDelete } from '../../lib/api';

export function ResearchPanel() {
  const {
    researchCards,
    addResearchCard,
    removeResearchCard,
    setResearchCards,
    chatModel,
  } = useIDEStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'generate'>('generate');
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setIsGenerating(true);

    try {
      const cardId = `rc-${Date.now()}`;
      const card: ResearchCard = {
        id: cardId,
        title: input.trim().slice(0, 80),
        content: '',
        type: 'insight',
        createdAt: Date.now(),
      };
      addResearchCard(card);
      setActiveTab('dashboard');

      let fullContent = '';
      for await (const chunk of researchDashboardStream(
        input.trim(),
        useIDEStore.getState().aiProvider,
        useIDEStore.getState().aiModel || chatModel,
      )) {
        if (typeof chunk === 'string') {
          fullContent += chunk;
        } else if ((chunk as any).content) {
          fullContent += (chunk as any).content;
        }
        useIDEStore.setState((s) => ({
          researchCards: s.researchCards.map((c) =>
            c.id === cardId ? { ...c, content: fullContent } : c,
          ),
        }));
      }
      // after complete, save to backend
      try {
        const saved = await researchSave({
          ...card,
          content: fullContent,
        });
        console.log('saved research card', saved);
      } catch (e) {
        console.warn('failed to save research card', e);
      }

      // Try to extract type from content
      const lower = fullContent.toLowerCase();
      const type: ResearchCard['type'] = lower.includes('warning') || lower.includes('risk')
        ? 'warning'
        : lower.includes('metric') || lower.includes('statistic') || lower.includes('%')
        ? 'metric'
        : lower.includes('action') || lower.includes('todo') || lower.includes('step')
        ? 'action'
        : 'insight';

      useIDEStore.setState((s) => ({
        researchCards: s.researchCards.map((c) =>
          c.id === cardId ? { ...c, type } : c,
        ),
      }));

      setInput('');
    } catch (err: any) {
      console.error('Research generation error:', err);
      addResearchCard({
        id: `rc-${Date.now()}`,
        title: 'Error',
        content: `Failed to generate: ${err.message}`,
        type: 'warning',
        createdAt: Date.now(),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const typeIcons: Record<string, string> = {
    insight: '💡',
    metric: '📊',
    action: '🎯',
    warning: '⚠️',
  };

  const typeColors: Record<string, string> = {
    insight: 'border-blue-500/30 bg-blue-500/5',
    metric: 'border-green-500/30 bg-green-500/5',
    action: 'border-purple-500/30 bg-purple-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
  };

  // load saved cards on mount
  useEffect(() => {
    researchList().then((list) => setResearchCards(list)).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span>📊 Research Dashboard</span>
        <span className="text-[10px] text-ide-text-dim">
          {researchCards.length} cards
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ide-border">
        <button
          onClick={() => setActiveTab('generate')}
          className={`tab-btn flex-1 ${activeTab === 'generate' ? 'active' : ''}`}
        >
          ✨ Generate
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`tab-btn flex-1 ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          📊 Dashboard ({researchCards.length})
        </button>
      </div>

      {activeTab === 'generate' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Research Prompt
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Describe what you want to research...\n\nExamples:\n• "Analyze gas optimization patterns for ERC-721 contracts"\n• "Compare L2 solutions: Arbitrum vs Optimism vs zkSync"\n• "Security audit checklist for DeFi protocols"`}
              rows={8}
              className="input-field resize-none"
            />
          </div>

          <div className="text-[10px] text-ide-text-dim bg-ide-bg rounded p-2 border border-ide-border">
            <p className="font-medium mb-1">Research Dashboard generates:</p>
            <div className="flex gap-2 flex-wrap">
              <span>💡 Insights</span>
              <span>📊 Metrics</span>
              <span>🎯 Actions</span>
              <span>⚠️ Warnings</span>
            </div>
            <p className="mt-1">Powered by Second Brain A2UI generative components</p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !input.trim()}
            className="action-btn w-full py-2"
          >
            {isGenerating ? '⏳ Generating research cards...' : '📊 Generate Dashboard'}
          </button>

          {/* Quick templates */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Quick Templates
            </label>
            <div className="space-y-1">
              {[
                'Smart contract security audit report',
                'DeFi protocol comparison analysis',
                'Gas optimization opportunities',
                'Blockchain architecture trade-offs',
                'Token economics design review',
              ].map((t) => (
                <button
                  key={t}
                  onClick={() => setInput(t)}
                  className="block w-full text-left text-[10px] text-ide-accent hover:underline px-2 py-1 rounded hover:bg-ide-bg"
                >
                  → {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {researchCards.length === 0 ? (
            <div className="text-center text-ide-text-dim text-xs mt-8 space-y-2">
              <p className="text-2xl">📊</p>
              <p>No research cards yet</p>
              <p>Generate insights from the Generate tab.</p>
            </div>
          ) : (
            researchCards.map((card) => (
              <div
                key={card.id}
                className={`rounded border p-3 ${typeColors[card.type] || typeColors.insight}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span>{typeIcons[card.type] || '💡'}</span>
                    <span className="text-xs font-medium truncate">{card.title}</span>
                  </div>
                  <button
                    onClick={() => {
                      removeResearchCard(card.id);
                      researchDelete(card.id).catch(console.warn);
                    }}
                    className="text-ide-text-dim hover:text-red-400 text-[10px] shrink-0"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-xs text-ide-text mt-2 whitespace-pre-wrap line-clamp-6">
                  {card.content || '⏳ Generating...'}
                </div>
                <div className="text-[10px] text-ide-text-dim mt-2 flex items-center gap-2">
                  <span className="uppercase">{card.type}</span>
                  <span>{new Date(card.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
