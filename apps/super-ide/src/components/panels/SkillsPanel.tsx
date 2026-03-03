import { useEffect, useMemo, useState } from 'react';
import { useIDEStore } from '../../store/ideStore';
import {
  skillExecute,
  skillHistoryDelete,
  skillHistoryList,
  skillHistorySave,
  skillsList,
} from '../../lib/api';
import type { SkillRegistryEntry } from '../../lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  knowledge: 'Knowledge',
  docs: 'Docs',
  slides: 'Slides',
  video: 'Video',
  mcp: 'MCP',
  brand: 'Brand',
  meta: 'Meta',
  security: 'Security',
  optimization: 'Optimization',
  codegen: 'Codegen',
  testing: 'Testing',
};

const defaultSkills: SkillRegistryEntry[] = [
  {
    id: 'find-skills',
    name: 'Find Skills',
    description: 'Discover installed skills and the next capability to load on demand.',
    category: 'knowledge',
    inputs: [],
    status: 'installed',
    source: 'local',
    executionMode: 'package',
    path: '.agents/skills/find-skills',
    triggers: ['find a skill', 'install a skill', 'extend super-ide'],
    notes: 'Installed local skill package used for capability discovery.',
  },
  {
    id: 'brand-voice-generator',
    name: 'Brand & Voice Generator',
    description: 'Create reusable tone-of-voice and brand-system files that power decks, docs, and content.',
    category: 'brand',
    inputs: [],
    status: 'installed',
    source: 'local',
    executionMode: 'package',
    path: '.agents/skills/brand-voice-generator',
    triggers: ['create a brand system', 'generate my tone of voice', 'set up my brand'],
    notes: 'Installed local skill package. Loaded on demand when brand context is needed.',
  },
  {
    id: 'mcp-client',
    name: 'MCP Client',
    description: 'Connect to MCP servers and call external tools without inflating the active context window.',
    category: 'mcp',
    inputs: [
      { name: 'server', type: 'string', required: true, description: 'MCP server URL or configured name' },
      { name: 'tool', type: 'string', required: true, description: 'Tool name to call' },
      { name: 'params', type: 'json', required: false, description: 'JSON arguments for the tool' },
    ],
    status: 'installed',
    source: 'local+backend',
    executionMode: 'hybrid',
    path: '.agents/skills/mcp-client',
    triggers: ['connect to Zapier', 'list MCP tools', 'use MCP server'],
    notes: 'Installed skill package plus backend placeholder until MCP configs are wired.',
  },
  {
    id: 'pptx-generator',
    name: 'PPTX Generator',
    description: 'Generate branded presentations and LinkedIn carousels using structured slide layouts.',
    category: 'slides',
    inputs: [],
    status: 'installed',
    source: 'local',
    executionMode: 'package',
    path: '.agents/skills/pptx-generator',
    triggers: ['create a presentation', 'make slides', 'build a carousel'],
    notes: 'Installed local skill package for presentations and carousel generation.',
  },
  {
    id: 'sop-creator',
    name: 'SOP Creator',
    description: 'Generate scannable runbooks and SOPs that are easy to follow under real operating pressure.',
    category: 'docs',
    inputs: [
      { name: 'task', type: 'string', required: true, description: 'Task or workflow to document' },
      { name: 'audience', type: 'string', required: false, description: 'Target audience' },
    ],
    status: 'installed',
    source: 'local+backend',
    executionMode: 'hybrid',
    path: '.agents/skills/sop-creator',
    triggers: ['create a runbook', 'document this process', 'write an SOP'],
    notes: 'Installed skill package plus backend execution for quick SOP drafts.',
  },
  {
    id: 'remotion-video-creator',
    name: 'Remotion Video Creator',
    description: 'Create React-based videos that render as programmatic compositions and exports.',
    category: 'video',
    inputs: [],
    status: 'installed',
    source: 'local',
    executionMode: 'package',
    path: '.agents/skills/remotion-video-creator',
    triggers: ['create a Remotion video', 'render an animation', 'build a short with React'],
    notes: 'Installed local skill package for Remotion workflows.',
  },
  {
    id: 'skill-creator',
    name: 'Skill Creator',
    description: 'Design new skills with concise instructions, scoped references, and progressive disclosure.',
    category: 'meta',
    inputs: [
      { name: 'description', type: 'string', required: true, description: 'What the skill should do' },
      { name: 'language', type: 'string', required: false, description: 'Implementation language' },
    ],
    status: 'available',
    source: 'backend',
    executionMode: 'backend',
    path: null,
    triggers: ['create a new skill', 'update this skill', 'extend super-ide'],
    notes: 'Built-in backend skill for generating new skill definitions.',
  },
  {
    id: 'knowledge-capture-studio',
    name: 'Knowledge Capture Studio',
    description: 'Planned skill for turning notes, decisions, and research into reusable second-brain entries.',
    category: 'knowledge',
    inputs: [],
    status: 'planned',
    source: 'planned',
    executionMode: 'planned',
    path: null,
    triggers: ['capture this research', 'save this decision'],
    notes: 'Planned stub. Not installed yet.',
  },
  {
    id: 'brand-asset-sync',
    name: 'Brand Asset Sync',
    description: 'Planned skill for syncing logos, palettes, and typography into the shared brand system.',
    category: 'brand',
    inputs: [],
    status: 'planned',
    source: 'planned',
    executionMode: 'planned',
    path: null,
    triggers: ['sync brand assets', 'update brand files'],
    notes: 'Planned stub. Not installed yet.',
  },
  {
    id: 'video-publish-pipeline',
    name: 'Video Publish Pipeline',
    description: 'Planned skill for export, packaging, and publishing after a video render completes.',
    category: 'video',
    inputs: [],
    status: 'planned',
    source: 'planned',
    executionMode: 'planned',
    path: null,
    triggers: ['publish this video', 'export a final cut'],
    notes: 'Planned stub. Not installed yet.',
  },
];

function formatCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] || category.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStatusLabel(skill: SkillRegistryEntry) {
  if (skill.status === 'planned') return 'Planned';
  if (skill.status === 'installed') return 'Installed';
  return 'Built In';
}

function statusBadgeClasses(status?: SkillRegistryEntry['status']) {
  if (status === 'planned') return 'bg-amber-500/10 text-amber-300';
  if (status === 'installed') return 'bg-emerald-500/10 text-emerald-300';
  return 'bg-sky-500/10 text-sky-300';
}

function executionLabel(mode?: SkillRegistryEntry['executionMode']) {
  if (mode === 'hybrid') return 'Hybrid';
  if (mode === 'package') return 'On Demand';
  if (mode === 'planned') return 'Future';
  return 'Browser';
}

export function SkillsPanel() {
  const [skills, setSkills] = useState<SkillRegistryEntry[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillRegistryEntry | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [filterCat, setFilterCat] = useState('all');
  const [activeTab, setActiveTab] = useState<'browse' | 'history'>('browse');

  const { skillHistory, addSkillHistory, removeSkillHistory } = useIDEStore();

  useEffect(() => {
    loadSkills();
    skillHistoryList()
      .then((history) => useIDEStore.setState({ skillHistory: history }))
      .catch(console.error);
  }, []);

  const loadSkills = async () => {
    try {
      const remote = await skillsList();
      setSkills(remote.length > 0 ? remote : defaultSkills);
    } catch {
      setSkills(defaultSkills);
    }
  };

  const handleSelectSkill = (skill: SkillRegistryEntry) => {
    setSelectedSkill(skill);
    setInputs({});
    setOutput('');
  };

  const handleExecute = async () => {
    if (!selectedSkill) return;
    const canExecute = selectedSkill.executionMode === 'backend' || selectedSkill.executionMode === 'hybrid';
    if (!canExecute) return;

    setIsRunning(true);
    setOutput('');

    try {
      const state = useIDEStore.getState();
      const result = await skillExecute(
        selectedSkill.id,
        inputs,
        state.aiProvider,
        state.aiModel,
      );
      const payload = result?.result ?? result;
      const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
      setOutput(text);

      const fallbackEntry = {
        id: `hist-${Date.now()}`,
        skill: selectedSkill.id,
        name: selectedSkill.name,
        inputs,
        result: text,
        provider: state.aiProvider,
        model: state.aiModel,
        timestamp: Date.now(),
      };
      const entry = result?.history || fallbackEntry;
      addSkillHistory(entry);
      if (!result?.history) {
        await skillHistorySave(entry);
      }
    } catch (err: any) {
      setOutput(`Error: ${err.message}\n\nMake sure the backend is running (npm run backend:dev).`);
    } finally {
      setIsRunning(false);
    }
  };

  const categories = useMemo(
    () => ['all', ...new Set(skills.map((skill) => skill.category))],
    [skills],
  );

  const filteredSkills = useMemo(
    () => (filterCat === 'all' ? skills : skills.filter((skill) => skill.category === filterCat)),
    [filterCat, skills],
  );

  const groupedSkills = useMemo(
    () => [
      {
        key: 'installed',
        title: 'Installed',
        items: filteredSkills.filter((skill) => skill.status === 'installed'),
      },
      {
        key: 'available',
        title: 'Built In',
        items: filteredSkills.filter((skill) => skill.status !== 'installed' && skill.status !== 'planned'),
      },
      {
        key: 'planned',
        title: 'Planned',
        items: filteredSkills.filter((skill) => skill.status === 'planned'),
      },
    ].filter((group) => group.items.length > 0),
    [filteredSkills],
  );

  const installedCount = skills.filter((skill) => skill.status === 'installed').length;
  const plannedCount = skills.filter((skill) => skill.status === 'planned').length;
  const selectedInputs = selectedSkill?.inputs || [];
  const canExecuteSelected =
    selectedSkill?.executionMode === 'backend' || selectedSkill?.executionMode === 'hybrid';

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span>⚡ Skills</span>
        <span className="text-[10px] text-ide-text-dim">
          {installedCount} installed • {plannedCount} planned
        </span>
      </div>

      <div className="flex border-b border-ide-border">
        <button
          onClick={() => setActiveTab('browse')}
          className={`tab-btn flex-1 ${activeTab === 'browse' ? 'active' : ''}`}
        >
          🙌 Browse
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`tab-btn flex-1 ${activeTab === 'history' ? 'active' : ''}`}
        >
          📜 History ({skillHistory.length})
        </button>
      </div>

      {activeTab === 'browse' && (
        selectedSkill ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedSkill(null);
                  setInputs({});
                  setOutput('');
                }}
                className="text-xs text-ide-accent hover:underline"
              >
                ← Back
              </button>
              <span className="text-xs font-medium">{selectedSkill.name}</span>
            </div>

            <p className="text-[10px] text-ide-text-dim">{selectedSkill.description}</p>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-ide-bg rounded border border-ide-border p-2">
                <div className="text-ide-text-dim uppercase tracking-wider">Category</div>
                <div className="mt-1">{formatCategoryLabel(selectedSkill.category)}</div>
              </div>
              <div className="bg-ide-bg rounded border border-ide-border p-2">
                <div className="text-ide-text-dim uppercase tracking-wider">Status</div>
                <div className="mt-1">{formatStatusLabel(selectedSkill)}</div>
              </div>
              <div className="bg-ide-bg rounded border border-ide-border p-2">
                <div className="text-ide-text-dim uppercase tracking-wider">Source</div>
                <div className="mt-1">{selectedSkill.source || 'backend'}</div>
              </div>
              <div className="bg-ide-bg rounded border border-ide-border p-2">
                <div className="text-ide-text-dim uppercase tracking-wider">Execution</div>
                <div className="mt-1">{executionLabel(selectedSkill.executionMode)}</div>
              </div>
            </div>

            {selectedSkill.path && (
              <div className="bg-ide-bg rounded border border-ide-border p-2 text-[10px]">
                <div className="text-ide-text-dim uppercase tracking-wider">Package Path</div>
                <div className="mt-1 font-mono break-all">{selectedSkill.path}</div>
              </div>
            )}

            {selectedSkill.triggers && selectedSkill.triggers.length > 0 && (
              <div className="bg-ide-bg rounded border border-ide-border p-2 text-[10px]">
                <div className="text-ide-text-dim uppercase tracking-wider">Triggers</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedSkill.triggers.map((trigger) => (
                    <span key={trigger} className="bg-ide-surface px-1.5 py-0.5 rounded text-ide-text-dim">
                      {trigger}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedSkill.notes && (
              <div className="bg-ide-bg rounded border border-ide-border p-2 text-[10px] text-ide-text-dim">
                {selectedSkill.notes}
              </div>
            )}

            {canExecuteSelected ? (
              <>
                {selectedInputs.map((input) => (
                  <div key={input.name}>
                    <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
                      {input.name} {input.required && <span className="text-red-400">*</span>}
                    </label>
                    <p className="text-[10px] text-ide-text-dim mb-1">{input.description}</p>
                    {input.type === 'text' || input.type === 'json' ? (
                      <textarea
                        value={inputs[input.name] || ''}
                        onChange={(e) => setInputs({ ...inputs, [input.name]: e.target.value })}
                        rows={4}
                        className="input-field resize-none font-mono text-xs"
                        placeholder={input.type === 'json' ? '{ }' : ''}
                      />
                    ) : (
                      <input
                        value={inputs[input.name] || ''}
                        onChange={(e) => setInputs({ ...inputs, [input.name]: e.target.value })}
                        className="input-field"
                      />
                    )}
                  </div>
                ))}

                <button
                  onClick={handleExecute}
                  disabled={
                    isRunning ||
                    selectedInputs.some((input) => input.required && !inputs[input.name]?.trim())
                  }
                  className="action-btn w-full py-2"
                >
                  {isRunning ? '⏳ Executing...' : '⚡ Execute Skill'}
                </button>
              </>
            ) : (
              <div className="bg-ide-bg rounded border border-ide-border p-3 text-xs text-ide-text-dim">
                {selectedSkill.executionMode === 'planned'
                  ? 'This is a planned skill stub. The UI surfaces it now so the product direction is explicit, but the package is not installed yet.'
                  : 'This skill is installed as a local package and loaded on demand by Codex. It is discoverable here, but it is not executed directly from the browser yet.'}
              </div>
            )}

            {output && (
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-ide-text-dim mb-1">
                  Output
                </label>
                <div className="bg-ide-bg rounded border border-ide-border p-3 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {output}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="flex gap-1 flex-wrap">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setFilterCat(category)}
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    filterCat === category
                      ? 'bg-ide-accent text-white'
                      : 'bg-ide-bg text-ide-text-dim hover:text-ide-text'
                  }`}
                >
                  {category === 'all' ? 'All' : formatCategoryLabel(category)}
                </button>
              ))}
            </div>

            {groupedSkills.map((group) => (
              <div key={group.key} className="space-y-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-ide-text-dim">
                  <span>{group.title}</span>
                  <span>{group.items.length}</span>
                </div>

                {group.items.map((skill) => (
                  <div
                    key={skill.id}
                    className="bg-ide-bg rounded border border-ide-border p-2 cursor-pointer hover:border-ide-accent transition-colors"
                    onClick={() => handleSelectSkill(skill)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">⚡</span>
                          <span className="text-xs font-medium">{skill.name}</span>
                        </div>
                        <p className="text-[10px] text-ide-text-dim mt-1 line-clamp-2">
                          {skill.description}
                        </p>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${statusBadgeClasses(skill.status)}`}>
                        {formatStatusLabel(skill)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-[9px] bg-ide-surface px-1.5 rounded text-ide-text-dim">
                        {formatCategoryLabel(skill.category)}
                      </span>
                      <span className="text-[9px] text-ide-text-dim">
                        {executionLabel(skill.executionMode)}
                      </span>
                      <span className="text-[9px] text-ide-text-dim">
                        {skill.inputs.length} inputs
                      </span>
                      {skill.path && (
                        <span className="text-[9px] text-ide-text-dim font-mono truncate max-w-[180px]">
                          {skill.path}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {groupedSkills.length === 0 && (
              <div className="text-center text-ide-text-dim text-xs mt-8 space-y-2">
                <p className="text-2xl">⚡</p>
                <p>No skills match this category</p>
              </div>
            )}
          </div>
        )
      )}

      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {skillHistory.length === 0 ? (
            <div className="text-center text-ide-text-dim text-xs mt-8 space-y-2">
              <p className="text-2xl">📜</p>
              <p>No history yet</p>
            </div>
          ) : (
            skillHistory.map((entry: any) => (
              <div key={entry.id} className="border rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">
                    {entry.name} • {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  <button
                    onClick={() => {
                      removeSkillHistory(entry.id);
                      skillHistoryDelete(entry.id).catch(console.warn);
                    }}
                    className="text-ide-text-dim hover:text-red-400 text-[10px]"
                  >
                    ✕
                  </button>
                </div>
                <pre className="text-[10px] whitespace-pre-wrap mt-1">{entry.result}</pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
