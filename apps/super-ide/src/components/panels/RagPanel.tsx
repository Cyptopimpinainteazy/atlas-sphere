import { useState, useEffect } from 'react';
import { useIDEStore, type RagSource } from '../../store/ideStore';
import { ragCrawlUrl, ragQuery, ragGetSources } from '../../lib/api';

export function RagPanel() {
  const {
    ragSources,
    ragResults,
    isRagLoading,
    addRagSource,
    setRagSources,
    setRagResults,
    setRagLoading,
  } = useIDEStore();

  const [activeTab, setActiveTab] = useState<'search' | 'crawl' | 'sources'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlDepth, setCrawlDepth] = useState(1);
  const [strategy, setStrategy] = useState<'semantic' | 'keyword' | 'hybrid'>('hybrid');

  const handleCrawl = async () => {
    if (!crawlUrl.trim()) return;
    setRagLoading(true);
    try {
      const result = await ragCrawlUrl(crawlUrl.trim(), crawlDepth);
      const source: RagSource = {
        id: `rag-${Date.now()}`,
        url: crawlUrl.trim(),
        title: result.title || crawlUrl.trim(),
        chunkCount: result.chunks || 0,
        crawledAt: Date.now(),
        status: 'ready',
      };
      addRagSource(source);
      setCrawlUrl('');
    } catch (err: any) {
      console.error('RAG crawl error:', err);
      const errorSource: RagSource = {
        id: `rag-${Date.now()}`,
        url: crawlUrl.trim(),
        title: `Error: ${err.message}`,
        chunkCount: 0,
        crawledAt: Date.now(),
        status: 'error',
      };
      addRagSource(errorSource);
    } finally {
      setRagLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setRagLoading(true);
    try {
      const results = await ragQuery(searchQuery.trim(), strategy);
      setRagResults(
        results.map((r: any) => ({
          content: r.content,
          source: r.source || r.url,
          score: r.score || r.similarity,
          metadata: r.metadata,
        })),
      );
    } catch (err: any) {
      console.error('RAG query error:', err);
      setRagResults([{
        content: `Error: ${err.message}. Make sure the RAG backend is running.`,
        source: 'error',
        score: 0,
      }]);
    } finally {
      setRagLoading(false);
    }
  };

  const handleRefreshSources = async () => {
    try {
      const sources = await ragGetSources();
      setRagSources(sources);
    } catch (err) {
      console.error('Failed to fetch RAG sources:', err);
    }
  };

  // load sources on mount
  useEffect(() => {
    handleRefreshSources();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span>🕸️ RAG Engine</span>
        <span className="text-[10px] text-ide-text-dim">
          Crawl4AI + Vector Search
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ide-border">
        <button
          onClick={() => setActiveTab('search')}
          className={`tab-btn flex-1 ${activeTab === 'search' ? 'active' : ''}`}
        >
          🔍 Search
        </button>
        <button
          onClick={() => setActiveTab('crawl')}
          className={`tab-btn flex-1 ${activeTab === 'crawl' ? 'active' : ''}`}
        >
          🕷️ Crawl
        </button>
        <button
          onClick={() => setActiveTab('sources')}
          className={`tab-btn flex-1 ${activeTab === 'sources' ? 'active' : ''}`}
        >
          📚 Sources ({ragSources.length})
        </button>
      </div>

      {activeTab === 'search' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Strategy selector */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Search Strategy
            </label>
            <div className="flex gap-1">
              {(['semantic', 'keyword', 'hybrid'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  className={`tab-btn flex-1 text-[10px] ${strategy === s ? 'active' : ''}`}
                >
                  {s === 'semantic' ? '🧠' : s === 'keyword' ? '🔤' : '🔀'} {s}
                </button>
              ))}
            </div>
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search crawled documentation..."
              className="input-field flex-1"
            />
            <button
              onClick={handleSearch}
              className="action-btn"
              disabled={isRagLoading || !searchQuery.trim()}
            >
              {isRagLoading ? '⏳' : '🔍'}
            </button>
          </div>

          {/* Results */}
          <div className="space-y-2">
            {ragResults.length > 0 && (
              <div className="text-[10px] text-ide-text-dim">
                {ragResults.length} results found
              </div>
            )}
            {ragResults.map((result, i) => (
              <div
                key={i}
                className="bg-ide-bg rounded border border-ide-border p-2 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-ide-accent truncate">
                    {result.source}
                  </span>
                  {result.score !== undefined && (
                    <span className="badge-info text-[10px]">
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-ide-text line-clamp-4">
                  {result.content}
                </p>
                <button
                  className="text-[10px] text-ide-accent hover:underline"
                  onClick={() => {
                    // Copy to clipboard or send to chat
                    navigator.clipboard.writeText(result.content);
                  }}
                >
                  📋 Copy
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'crawl' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              URL to Crawl
            </label>
            <input
              type="url"
              value={crawlUrl}
              onChange={(e) => setCrawlUrl(e.target.value)}
              placeholder="https://docs.soliditylang.org/"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Crawl Depth
            </label>
            <select
              value={crawlDepth}
              onChange={(e) => setCrawlDepth(Number(e.target.value))}
              className="input-field text-xs"
            >
              <option value={1}>1 - Single page</option>
              <option value={2}>2 - Follow links (1 level)</option>
              <option value={3}>3 - Deep crawl (2 levels)</option>
            </select>
          </div>

          <button
            onClick={handleCrawl}
            disabled={isRagLoading || !crawlUrl.trim()}
            className="action-btn w-full py-2"
          >
            {isRagLoading ? '⏳ Crawling...' : '🕷️ Start Crawl'}
          </button>

          <div className="text-[10px] text-ide-text-dim bg-ide-bg rounded p-2 border border-ide-border">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Crawl4AI fetches and parses content</li>
              <li>Text is chunked and embedded into vectors</li>
              <li>Search uses cosine similarity (semantic), BM25 (keyword), or both (hybrid)</li>
              <li>Results can be piped to AI Chat for context-aware responses</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-ide-text-dim">Crawled Sources</span>
            <button
              onClick={handleRefreshSources}
              className="text-[10px] text-ide-accent hover:underline"
            >
              🔄 Refresh
            </button>
          </div>

          {ragSources.length === 0 ? (
            <div className="text-center text-ide-text-dim text-xs mt-8 space-y-2">
              <p className="text-2xl">🕸️</p>
              <p>No sources crawled yet</p>
              <p>Use the Crawl tab to add documentation.</p>
            </div>
          ) : (
            ragSources.map((source) => (
              <div
                key={source.id}
                className="bg-ide-bg rounded border border-ide-border p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs truncate flex-1">{source.title}</span>
                  <span
                    className={`text-[10px] px-1.5 rounded ${
                      source.status === 'ready'
                        ? 'bg-green-500/20 text-green-400'
                        : source.status === 'crawling'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {source.status}
                  </span>
                </div>
                <div className="text-[10px] text-ide-text-dim mt-1 flex gap-2">
                  <span>{source.chunkCount} chunks</span>
                  <span>{new Date(source.crawledAt).toLocaleDateString()}</span>
                </div>
                <div className="text-[10px] text-ide-text-dim mt-0.5 truncate">
                  {source.url}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
