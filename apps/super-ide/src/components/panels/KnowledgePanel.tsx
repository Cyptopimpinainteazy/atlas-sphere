import { useState, useEffect } from 'react';
import { useIDEStore, type KnowledgeEntry } from '../../store/ideStore';
import { knowledgeSave, knowledgeList, knowledgeDelete } from '../../lib/api';

const CATEGORIES = ['pitfall', 'pattern', 'config', 'reference'] as const;
const CATEGORY_ICONS: Record<string, string> = {
  pitfall: '⚠️',
  pattern: '🧩',
  config: '⚙️',
  reference: '📖',
};

export function KnowledgePanel() {
  const {
    knowledgeEntries,
    setKnowledgeEntries,
    addKnowledgeEntry,
    updateKnowledgeEntry,
    removeKnowledgeEntry,
  } = useIDEStore();

  // load entries on mount
  useEffect(() => {
    knowledgeList()
      .then((entries) => setKnowledgeEntries(entries))
      .catch(console.error);
  }, []);

  const [activeTab, setActiveTab] = useState<'browse' | 'add'>('browse');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingEntry, setViewingEntry] = useState<string | null>(null);

  // Form state for add/edit
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<typeof CATEGORIES[number]>('pattern');
  const [formTags, setFormTags] = useState('');

  const filteredEntries = knowledgeEntries.filter((e) => {
    if (filterCat !== 'all' && e.category !== filterCat) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;

    const entry: KnowledgeEntry = {
      id: editId || `kb-${Date.now()}`,
      title: formTitle.trim(),
      content: formContent.trim(),
      category: formCategory,
      tags: formTags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: editId
        ? knowledgeEntries.find((e) => e.id === editId)?.createdAt || Date.now()
        : Date.now(),
      updatedAt: Date.now(),
    };

    if (editId) {
      updateKnowledgeEntry(editId, entry);
    } else {
      addKnowledgeEntry(entry);
    }

    // Try to persist to backend
    try {
      await knowledgeSave(entry);
    } catch {
      // Local-only is fine
    }

    resetForm();
    setActiveTab('browse');
  };

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditId(entry.id);
    setFormTitle(entry.title);
    setFormContent(entry.content);
    setFormCategory(entry.category as typeof CATEGORIES[number]);
    setFormTags(entry.tags.join(', '));
    setActiveTab('add');
  };

  const resetForm = () => {
    setEditId(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('pattern');
    setFormTags('');
  };

  const currentEntry = knowledgeEntries.find((e) => e.id === viewingEntry);

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span>🧠 Knowledge Base</span>
        <button
          onClick={() => {
            resetForm();
            setActiveTab('add');
          }}
          className="text-[10px] text-ide-accent hover:underline"
        >
          + New
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ide-border">
        <button
          onClick={() => setActiveTab('browse')}
          className={`tab-btn flex-1 ${activeTab === 'browse' ? 'active' : ''}`}
        >
          📚 Browse ({knowledgeEntries.length})
        </button>
        <button
          onClick={() => setActiveTab('add')}
          className={`tab-btn flex-1 ${activeTab === 'add' ? 'active' : ''}`}
        >
          {editId ? '✏️ Edit' : '➕ Add'}
        </button>
      </div>

      {activeTab === 'browse' ? (
        viewingEntry && currentEntry ? (
          /* Detail view */
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewingEntry(null)}
                className="text-xs text-ide-accent hover:underline"
              >
                ← Back
              </button>
              <span className="flex-1" />
              <button
                onClick={() => handleEdit(currentEntry)}
                className="text-[10px] text-ide-accent hover:underline"
              >
                ✏️ Edit
              </button>
              <button
                onClick={async () => {
                  removeKnowledgeEntry(currentEntry.id);
                  setViewingEntry(null);
                  try {
                    await knowledgeDelete(currentEntry.id);
                  } catch {}
                }}
                className="text-[10px] text-red-400 hover:underline"
              >
                🗑️ Delete
              </button>
            </div>

            <div>
              <h3 className="text-sm font-medium flex items-center gap-1">
                {CATEGORY_ICONS[currentEntry.category]} {currentEntry.title}
              </h3>
              <div className="flex gap-1 mt-1">
                {currentEntry.tags.map((tag) => (
                  <span key={tag} className="badge-info text-[10px]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-ide-bg rounded border border-ide-border p-3 text-xs whitespace-pre-wrap">
              {currentEntry.content}
            </div>

            <div className="text-[10px] text-ide-text-dim">
              Created: {new Date(currentEntry.createdAt).toLocaleString()}
              {currentEntry.updatedAt !== currentEntry.createdAt &&
                ` | Updated: ${new Date(currentEntry.updatedAt).toLocaleString()}`}
            </div>
          </div>
        ) : (
          /* List view */
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Search */}
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search knowledge..."
              className="input-field"
            />

            {/* Category filter */}
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFilterCat('all')}
                className={`text-[10px] px-2 py-0.5 rounded ${
                  filterCat === 'all'
                    ? 'bg-ide-accent text-white'
                    : 'bg-ide-bg text-ide-text-dim hover:text-ide-text'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    filterCat === cat
                      ? 'bg-ide-accent text-white'
                      : 'bg-ide-bg text-ide-text-dim hover:text-ide-text'
                  }`}
                >
                  {CATEGORY_ICONS[cat]} {cat}
                </button>
              ))}
            </div>

            {/* Entries */}
            {filteredEntries.length === 0 ? (
              <div className="text-center text-ide-text-dim text-xs mt-8 space-y-2">
                <p className="text-2xl">🧠</p>
                <p>No knowledge entries{searchTerm ? ' matching search' : ' yet'}</p>
                <p>Add pitfalls, patterns, configs, and references.</p>
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-ide-bg rounded border border-ide-border p-2 cursor-pointer hover:border-ide-accent transition-colors"
                  onClick={() => setViewingEntry(entry.id)}
                >
                  <div className="flex items-center gap-1">
                    <span>{CATEGORY_ICONS[entry.category]}</span>
                    <span className="text-xs truncate flex-1">{entry.title}</span>
                  </div>
                  <p className="text-[10px] text-ide-text-dim mt-1 line-clamp-2">
                    {entry.content}
                  </p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {entry.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[9px] bg-ide-surface px-1 rounded text-ide-text-dim">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )
      ) : (
        /* Add/Edit form */
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Title
            </label>
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g., Reentrancy Guard Pattern"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Category
            </label>
            <div className="flex gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFormCategory(cat)}
                  className={`tab-btn flex-1 text-[10px] ${formCategory === cat ? 'active' : ''}`}
                >
                  {CATEGORY_ICONS[cat]} {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Content (Markdown)
            </label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Document the knowledge here..."
              rows={10}
              className="input-field resize-none font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
              Tags (comma-separated)
            </label>
            <input
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="solidity, security, erc20"
              className="input-field"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!formTitle.trim() || !formContent.trim()}
              className="action-btn flex-1 py-2"
            >
              {editId ? '✏️ Update Entry' : '💾 Save Entry'}
            </button>
            {editId && (
              <button
                onClick={() => {
                  resetForm();
                  setActiveTab('browse');
                }}
                className="text-xs text-ide-text-dim hover:text-ide-text px-3"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
