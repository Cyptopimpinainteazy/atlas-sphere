import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useIDEStore, type NotebookSession } from '../../store/ideStore';
import { notebookGenerate, notebookList, notebookSave, notebookDelete } from '../../lib/api';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to read PDF file.'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read PDF file.'));
    reader.readAsDataURL(file);
  });
}

export function NotebookPanel() {
  const {
    notebookSessions,
    addNotebookSession,
    removeNotebookSession,
    chatModel,
  } = useIDEStore();

  const [activeTab, setActiveTab] = useState<'create' | 'sessions'>('create');
  const [sourceType, setSourceType] = useState<'pdf' | 'url' | 'text'>('url');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [sourceFileData, setSourceFileData] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [tone, setTone] = useState<'conversational' | 'academic' | 'technical'>('conversational');
  const [format, setFormat] = useState<'podcast' | 'summary' | 'qa'>('podcast');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [viewingSession, setViewingSession] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasSourceContent =
    sourceType === 'url'
      ? !!sourceUrl.trim()
      : sourceType === 'text'
      ? !!sourceText.trim()
      : !!sourceFileData;

  const resetSourceInputs = () => {
    setSourceUrl('');
    setSourceText('');
    setSourceFileName('');
    setSourceFileData('');
    setSourceError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setSourceError('Choose a .pdf file.');
      setSourceFileName('');
      setSourceFileData('');
      return;
    }

    setIsReadingFile(true);
    setSourceError('');

    try {
      const base64 = await fileToBase64(file);
      setSourceFileName(file.name);
      setSourceFileData(base64);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read PDF file.';
      setSourceError(message);
      setSourceFileName('');
      setSourceFileData('');
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleGenerate = async () => {
    if (!hasSourceContent) {
      return;
    }
    setIsGenerating(true);
    setSourceError('');

    try {
      const state = useIDEStore.getState();
      const provider = state.aiProvider;
      const model = provider === 'ollama' ? state.chatModel : state.aiModel;

      const result = await notebookGenerate({
        sourceType,
        sourceUrl: sourceUrl.trim(),
        sourceText: sourceText.trim(),
        sourceFileName,
        sourceFileData,
        focusArea: focusArea.trim(),
        tone,
        format,
        provider,
        model: model || chatModel,
      });

      const title =
        sourceType === 'pdf'
          ? sourceFileName || 'PDF notebook'
          : sourceUrl.trim() || `${sourceText.trim().slice(0, 50)}...`;

      const session: NotebookSession = {
        id: `nb-${Date.now()}`,
        title,
        sourceType,
        sourceUrl: sourceType === 'url' ? sourceUrl.trim() : sourceFileName,
        focusArea: focusArea.trim(),
        transcript: result.transcript || result.content || 'Generation complete.',
        audioUrl: result.audioUrl,
        createdAt: Date.now(),
      };

      addNotebookSession(session);
      try {
        await notebookSave(session);
      } catch (e) {
        console.warn('failed to save notebook session', e);
      }

      setViewingSession(session.id);
      setActiveTab('sessions');
      resetSourceInputs();
      setFocusArea('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Notebook generation failed.';
      console.error('NotebookLM generation error:', err);

      const errorSession: NotebookSession = {
        id: `nb-${Date.now()}`,
        title: sourceType === 'pdf' ? sourceFileName || 'PDF error' : 'Error',
        sourceType,
        sourceUrl: sourceType === 'url' ? sourceUrl.trim() : sourceFileName,
        focusArea,
        transcript: `Error: ${message}. Ensure the backend is running and PDF support is installed for server-side extraction.`,
        createdAt: Date.now(),
      };

      addNotebookSession(errorSession);
      try {
        await notebookSave(errorSession);
      } catch {}
      setViewingSession(errorSession.id);
      setActiveTab('sessions');
    } finally {
      setIsGenerating(false);
    }
  };

  const currentSession = notebookSessions.find((s) => s.id === viewingSession);

  useEffect(() => {
    notebookList()
      .then((list) => useIDEStore.setState({ notebookSessions: list }))
      .catch(console.error);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span>🎙️ NotebookLM</span>
        <span className="text-[10px] text-ide-text-dim">
          {notebookSessions.length} sessions
        </span>
      </div>

      <div className="flex border-b border-ide-border">
        <button
          onClick={() => setActiveTab('create')}
          className={`tab-btn flex-1 ${activeTab === 'create' ? 'active' : ''}`}
        >
          ✨ Create
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`tab-btn flex-1 ${activeTab === 'sessions' ? 'active' : ''}`}
        >
          📁 Sessions ({notebookSessions.length})
        </button>
      </div>

      {activeTab === 'create' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Source Type
            </label>
            <div className="flex gap-1">
              {(['url', 'text', 'pdf'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setSourceType(type);
                    setSourceError('');
                  }}
                  className={`tab-btn flex-1 ${sourceType === type ? 'active' : ''}`}
                >
                  {type === 'url' ? '🔗 URL' : type === 'pdf' ? '📄 PDF' : '📝 Text'}
                </button>
              ))}
            </div>
          </div>

          {sourceType === 'url' ? (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
                URL
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://docs.soliditylang.org/en/latest/"
                className="input-field"
              />
            </div>
          ) : sourceType === 'text' ? (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
                Text Content
              </label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste your content here..."
                rows={6}
                className="input-field resize-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
                PDF Upload
              </label>
              <div className="border-2 border-dashed border-ide-border rounded-lg p-4 text-center space-y-2">
                <p className="text-ide-text-dim text-xs">
                  Choose a local PDF and the backend will extract its text for notebook generation.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="action-btn mt-1 text-[10px]"
                  disabled={isReadingFile}
                >
                  {isReadingFile ? '⏳ Reading PDF...' : sourceFileName ? 'Replace File' : 'Choose File'}
                </button>
                {sourceFileName && (
                  <div className="text-left bg-ide-bg rounded border border-ide-border px-2 py-2">
                    <p className="text-xs text-ide-text truncate">{sourceFileName}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-ide-text-dim">Ready for extraction</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSourceFileName('');
                          setSourceFileData('');
                          setSourceError('');
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="text-[10px] text-ide-text-dim hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {sourceError && <p className="text-[10px] text-red-400">{sourceError}</p>}

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Focus Area (optional)
            </label>
            <input
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              placeholder="e.g., security patterns, gas optimization"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as typeof tone)}
              className="input-field text-xs"
            >
              <option value="conversational">🗣️ Conversational</option>
              <option value="academic">🎓 Academic</option>
              <option value="technical">⚙️ Technical</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Output Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              className="input-field text-xs"
            >
              <option value="podcast">🎙️ Podcast-style conversation</option>
              <option value="summary">📝 Deep summary</option>
              <option value="qa">❓ Q&A format</option>
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || isReadingFile || !hasSourceContent}
            className="action-btn w-full py-2"
          >
            {isGenerating ? '⏳ Generating notebook...' : '🎙️ Generate Notebook'}
          </button>
        </div>
      ) : viewingSession && currentSession ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewingSession(null)}
              className="text-xs text-ide-accent hover:underline"
            >
              ← Back
            </button>
            <span className="text-xs text-ide-text-dim truncate flex-1">
              {currentSession.title}
            </span>
          </div>

          <div className="text-[10px] text-ide-text-dim space-y-1">
            <p>Source: {currentSession.sourceType}</p>
            {currentSession.sourceUrl && <p>Input: {currentSession.sourceUrl}</p>}
            {currentSession.focusArea && <p>Focus: {currentSession.focusArea}</p>}
            <p>Created: {new Date(currentSession.createdAt).toLocaleString()}</p>
          </div>

          {currentSession.audioUrl && (
            <audio controls src={currentSession.audioUrl} className="w-full" />
          )}

          <div className="bg-ide-bg rounded border border-ide-border p-3 text-xs whitespace-pre-wrap">
            {currentSession.transcript}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notebookSessions.length === 0 ? (
            <div className="text-center text-ide-text-dim text-xs mt-8 space-y-2">
              <p className="text-2xl">🎙️</p>
              <p>No notebook sessions yet</p>
              <p>Create one from a URL, PDF, or text.</p>
            </div>
          ) : (
            notebookSessions.map((session) => (
              <div
                key={session.id}
                className="bg-ide-bg rounded border border-ide-border p-2 cursor-pointer hover:border-ide-accent transition-colors"
                onClick={() => setViewingSession(session.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs truncate flex-1">{session.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotebookSession(session.id);
                      notebookDelete(session.id).catch(console.warn);
                    }}
                    className="text-ide-text-dim hover:text-red-400 text-[10px] ml-2"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-[10px] text-ide-text-dim mt-1 flex gap-2">
                  <span>{session.sourceType}</span>
                  <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
