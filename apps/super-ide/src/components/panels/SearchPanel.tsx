import { useState, type FormEvent } from 'react';
import {
  openWorkspaceFile,
  ragQuery,
  searchCodebase,
  searchWorkspaceFiles,
  type CodeSearchResult,
  type WorkspaceFileSearchResult,
} from '../../lib/api';
import { useIDEStore, type FileTab } from '../../store/ideStore';

type SearchMode = 'files' | 'codebase' | 'rag';

interface RagSearchResult {
  content: string;
  source: string;
  score?: number;
  method?: string;
}

function getLanguageFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    sol: 'sol',
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    json: 'json',
    md: 'markdown',
    py: 'python',
    rs: 'rust',
    toml: 'toml',
    yaml: 'yaml',
    yml: 'yaml',
    css: 'css',
    html: 'html',
    sh: 'shell',
  };
  return map[ext || ''] || 'plaintext';
}

export function SearchPanel() {
  const { openTab, setRagResults, workspaceRoot } = useIDEStore();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchMode>('files');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [fileResults, setFileResults] = useState<WorkspaceFileSearchResult[]>([]);
  const [codeResults, setCodeResults] = useState<CodeSearchResult[]>([]);
  const [ragResults, setLocalRagResults] = useState<RagSearchResult[]>([]);

  const clearResults = () => {
    setFileResults([]);
    setCodeResults([]);
    setLocalRagResults([]);
  };

  const openFile = async (path: string, name: string, line?: number) => {
    try {
      const file = await openWorkspaceFile(path);
      const tab: FileTab = {
        id: path,
        name,
        path,
        language: getLanguageFromName(name),
        content: file.content,
        isDirty: false,
        cursorLine: line,
      };
      openTab(tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file');
    }
  };

  const handleSearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const trimmed = query.trim();

    setHasSearched(true);
    setError('');

    if (!trimmed) {
      clearResults();
      setRagResults([]);
      setError('Enter a query to search.');
      return;
    }

    setIsLoading(true);
    clearResults();

    try {
      if (searchType === 'files') {
        const results = await searchWorkspaceFiles(trimmed, workspaceRoot);
        setFileResults(results);
      } else if (searchType === 'codebase') {
        const results = await searchCodebase(trimmed, workspaceRoot);
        setCodeResults(results);
      } else {
        const response = await ragQuery(trimmed, 'hybrid');
        const results = Array.isArray(response) ? response : response.results || [];
        setLocalRagResults(results);
        setRagResults(results);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (mode: SearchMode) => {
    setSearchType(mode);
    setError('');
    setHasSearched(false);
    clearResults();
    setRagResults([]);
  };

  const resultCount =
    searchType === 'files'
      ? fileResults.length
      : searchType === 'codebase'
      ? codeResults.length
      : ragResults.length;

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span>Search</span>
      </div>
      <div className="p-3 border-b border-ide-border space-y-3">
        <div className="flex gap-1">
          {(['files', 'codebase', 'rag'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`tab-btn ${searchType === mode ? 'active' : ''}`}
            >
              {mode === 'files' ? 'Files' : mode === 'codebase' ? 'Code' : 'RAG'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                searchType === 'files'
                  ? 'Match file paths'
                  : searchType === 'codebase'
                  ? 'Find code lines'
                  : 'Query crawled docs'
              }
              className="input-field flex-1"
            />
            <button type="submit" className="action-btn px-3 text-xs" disabled={isLoading}>
              {isLoading ? '...' : 'Go'}
            </button>
          </div>
        </form>

        <p className="text-xs text-ide-text-dim">
          {searchType === 'files' && 'Searches workspace file names and paths.'}
          {searchType === 'codebase' && 'Searches file contents and returns the best matching lines.'}
          {searchType === 'rag' && 'Searches crawled documentation with hybrid vector and keyword ranking.'}
        </p>
        <p className="text-[10px] text-ide-text-dim">
          Scope: <span className="text-ide-text">{workspaceRoot}</span>
        </p>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto bg-ide-bg">
        {isLoading && (
          <div className="p-3 text-xs text-ide-text-dim">Searching {searchType}...</div>
        )}

        {!isLoading && hasSearched && resultCount === 0 && !error && (
          <div className="p-3 text-xs text-ide-text-dim">No matches found.</div>
        )}

        {!isLoading && !hasSearched && (
          <div className="p-3 text-xs text-ide-text-dim">
            Run a search to inspect files, scan code, or query the RAG index.
          </div>
        )}

        {!isLoading && searchType === 'files' && fileResults.length > 0 && (
          <div className="p-2 space-y-1">
            {fileResults.map((result) => (
              <button
                key={result.path}
                onClick={() => openFile(result.path, result.name)}
                className="w-full text-left px-2 py-2 rounded border border-ide-border bg-ide-surface hover:border-ide-accent transition-colors"
              >
                <p className="text-xs text-ide-text font-medium">{result.name}</p>
                <p className="text-[10px] text-ide-text-dim mt-1">{result.path}</p>
              </button>
            ))}
          </div>
        )}

        {!isLoading && searchType === 'codebase' && codeResults.length > 0 && (
          <div className="p-2 space-y-2">
            {codeResults.map((result) => (
              <button
                key={`${result.path}:${result.line}`}
                onClick={() => openFile(result.path, result.name, result.line)}
                className="w-full text-left px-2 py-2 rounded border border-ide-border bg-ide-surface hover:border-ide-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-ide-text font-medium truncate">{result.path}</p>
                  <span className="text-[10px] text-ide-text-dim">Line {result.line}</span>
                </div>
                <p className="text-[11px] text-ide-text-dim mt-1 font-mono whitespace-pre-wrap break-words">
                  {result.snippet}
                </p>
              </button>
            ))}
          </div>
        )}

        {!isLoading && searchType === 'rag' && ragResults.length > 0 && (
          <div className="p-2 space-y-2">
            {ragResults.map((result, index) => (
              <div
                key={`${result.source}-${index}`}
                className="px-2 py-2 rounded border border-ide-border bg-ide-surface"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-ide-accent truncate">{result.source}</p>
                  {result.score !== undefined && (
                    <span className="text-[10px] text-ide-text-dim">
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ide-text mt-1 whitespace-pre-wrap break-words">
                  {result.content}
                </p>
                {result.method && (
                  <p className="text-[10px] text-ide-text-dim mt-1 uppercase">{result.method}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
