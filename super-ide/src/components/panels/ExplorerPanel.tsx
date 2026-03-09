import { useState, useEffect } from 'react';
import {
  getWorkspaceTree,
  openWorkspaceFile,
  saveWorkspaceFile,
  skillsList,
  type SkillRegistryEntry,
  type WorkspaceTreeNode,
} from '../../lib/api';
import { useIDEStore, type FileTab } from '../../store/ideStore';

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

function normalizeRoot(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === './') {
    return '.';
  }

  const withoutLeading = trimmed.replace(/^\.\//, '');
  const normalized = withoutLeading.replace(/\/+$/, '');
  return normalized || '.';
}

function resolveWorkspacePath(base: string, input: string): string {
  const normalizedBase = normalizeRoot(base);
  const trimmed = input.trim();
  if (!trimmed || trimmed === '.') {
    return normalizedBase;
  }

  const segments =
    normalizedBase === '.' || trimmed.startsWith('/')
      ? []
      : normalizedBase.split('/').filter(Boolean);

  trimmed
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .forEach((segment) => {
      if (segment === '.') {
        return;
      }
      if (segment === '..') {
        segments.pop();
        return;
      }
      segments.push(segment);
    });

  return segments.length ? segments.join('/') : '.';
}

function joinWorkspacePath(base: string, relative: string): string {
  return resolveWorkspacePath(base, relative);
}

function TreeItem({
  node,
  depth = 0,
  onOpenFile,
  pinnedFiles,
  onTogglePinnedFile,
}: {
  node: WorkspaceTreeNode;
  depth?: number;
  onOpenFile: (path: string) => Promise<void>;
  pinnedFiles: string[];
  onTogglePinnedFile: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isPinned = node.type === 'file' && pinnedFiles.includes(node.path);

  const handleClick = async () => {
    if (node.type === 'dir') {
      setIsOpen(!isOpen);
      return;
    }

    await onOpenFile(node.path);
  };

  return (
    <div>
      <div className="flex items-center group">
        <button
          onClick={() => {
            void handleClick();
          }}
          className="flex items-center gap-1.5 flex-1 px-2 py-0.5 text-xs hover:bg-ide-panel rounded text-left"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-[10px]">
            {node.type === 'dir' ? (isOpen ? '📂' : '📁') : '📄'}
          </span>
          <span className={node.type === 'dir' ? 'text-ide-text font-medium' : 'text-ide-text-dim'}>
            {node.name}
          </span>
        </button>
        {node.type === 'file' && (
          <button
            onClick={() => onTogglePinnedFile(node.path)}
            className={`px-2 text-[10px] ${
              isPinned
                ? 'text-yellow-300 opacity-100'
                : 'text-ide-text-dim opacity-0 group-hover:opacity-100 hover:text-ide-text'
            }`}
            title={isPinned ? 'Unpin file' : 'Pin file'}
          >
            {isPinned ? '★' : '☆'}
          </button>
        )}
      </div>
      {node.type === 'dir' &&
        isOpen &&
        node.children?.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            onOpenFile={onOpenFile}
            pinnedFiles={pinnedFiles}
            onTogglePinnedFile={onTogglePinnedFile}
          />
        ))}
    </div>
  );
}

export function ExplorerPanel() {
  const {
    workspaceRoot,
    favoriteWorkspaceRoots,
    setWorkspaceRoot,
    addWorkspaceFavorite,
    removeWorkspaceFavorite,
    pinnedFiles,
    addPinnedFile,
    removePinnedFile,
    openTab,
  } = useIDEStore();
  const [tree, setTree] = useState<WorkspaceTreeNode[]>([]);
  const [rootInput, setRootInput] = useState(workspaceRoot);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [installedSkills, setInstalledSkills] = useState<SkillRegistryEntry[]>([]);

  const openFileAtPath = async (path: string) => {
    try {
      const data = await openWorkspaceFile(path);
      const tab: FileTab = {
        id: path,
        name: path.split('/').pop() || path,
        path,
        language: getLanguageFromName(path),
        content: data.content,
        isDirty: false,
      };
      openTab(tab);
    } catch (err) {
      console.error('Failed to open file', err);
      setError(`Failed to open ${path}.`);
    }
  };

  const refreshTree = async (root: string) => {
    setIsLoading(true);
    try {
      const nextTree = await getWorkspaceTree(root);
      setTree(nextTree);
      setError('');
    } catch (err) {
      console.error('Failed to load tree', err);
      setTree([]);
      setError('Failed to load workspace tree.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setRootInput(workspaceRoot);
    void refreshTree(workspaceRoot);
  }, [workspaceRoot]);

  useEffect(() => {
    let isMounted = true;

    const loadInstalledSkills = async () => {
      try {
        const registry = await skillsList();
        if (!isMounted) {
          return;
        }
        setInstalledSkills(
          registry
            .filter((skill) => skill.status === 'installed' && skill.path)
            .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name)),
        );
      } catch {
        if (isMounted) {
          setInstalledSkills([]);
        }
      }
    };

    void loadInstalledSkills();
    return () => {
      isMounted = false;
    };
  }, []);

  const applyRoot = () => {
    setWorkspaceRoot(normalizeRoot(rootInput));
  };

  const toggleFavoriteRoot = () => {
    const normalized = normalizeRoot(workspaceRoot);
    if (favoriteWorkspaceRoots.includes(normalized)) {
      removeWorkspaceFavorite(normalized);
    } else {
      addWorkspaceFavorite(normalized);
    }
  };

  const togglePinnedFile = (path: string) => {
    if (pinnedFiles.includes(path)) {
      removePinnedFile(path);
      return;
    }
    addPinnedFile(path);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header flex items-center justify-between">
        <span>📁 Explorer</span>
        <div className="flex items-center gap-2">
          <button
            className="text-ide-text-dim hover:text-ide-text text-xs"
            onClick={toggleFavoriteRoot}
            title="Toggle favorite root"
          >
            {favoriteWorkspaceRoots.includes(normalizeRoot(workspaceRoot)) ? '★' : '☆'}
          </button>
          <button
            className="text-ide-text-dim hover:text-ide-text text-xs"
            onClick={async () => {
              const name = prompt('New file path (relative to the current root):');
              if (!name) {
                return;
              }

              try {
                await saveWorkspaceFile(joinWorkspacePath(workspaceRoot, name), '');
                await refreshTree(workspaceRoot);
              } catch (err) {
                console.error('create file failed', err);
                setError('Failed to create file.');
              }
            }}
          >
            + New
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-ide-border space-y-2">
        <div className="flex gap-2">
          <input
            value={rootInput}
            onChange={(e) => setRootInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyRoot()}
            placeholder="Workspace root"
            className="input-field flex-1"
          />
          <button onClick={applyRoot} className="action-btn text-xs px-3">
            Go
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {favoriteWorkspaceRoots.map((root) => (
            <div key={root} className="flex items-center rounded bg-ide-surface border border-ide-border">
              <button
                onClick={() => setWorkspaceRoot(root)}
                className={`px-2 py-1 text-[10px] ${
                  workspaceRoot === root ? 'text-ide-accent' : 'text-ide-text-dim hover:text-ide-text'
                }`}
              >
                {root}
              </button>
              {root !== '.' && (
                <button
                  onClick={() => removeWorkspaceFavorite(root)}
                  className="px-1 text-[10px] text-ide-text-dim hover:text-red-400"
                  title={`Remove ${root}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {installedSkills.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-ide-text-dim">Installed skill files</p>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {installedSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center gap-1 rounded bg-ide-surface border border-ide-border"
                >
                  <button
                    onClick={() => {
                      void openFileAtPath(`${skill.path}/SKILL.md`);
                    }}
                    className="flex-1 px-2 py-1 text-[10px] text-left text-ide-text hover:text-ide-accent truncate"
                    title={`${skill.path}/SKILL.md`}
                  >
                    {skill.displayName || skill.name}
                  </button>
                  {skill.uiMetadataPath && (
                    <button
                      onClick={() => {
                        void openFileAtPath(skill.uiMetadataPath!);
                      }}
                      className="px-2 py-1 text-[10px] text-ide-text-dim hover:text-ide-text"
                      title={skill.uiMetadataPath}
                    >
                      UI
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {pinnedFiles.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-ide-text-dim">Pinned files</p>
            <div className="space-y-1">
              {pinnedFiles.map((path) => (
                <div
                  key={path}
                  className="flex items-center gap-1 rounded bg-ide-surface border border-ide-border"
                >
                  <button
                    onClick={() => {
                      void openFileAtPath(path);
                    }}
                    className="flex-1 px-2 py-1 text-[10px] text-left text-ide-text hover:text-ide-accent truncate"
                    title={path}
                  >
                    ★ {path}
                  </button>
                  <button
                    onClick={() => removePinnedFile(path)}
                    className="px-2 text-[10px] text-ide-text-dim hover:text-red-400"
                    title={`Unpin ${path}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-ide-text-dim">
          Current root: <span className="text-ide-text">{workspaceRoot}</span>
        </p>
        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto bg-ide-bg">
        {isLoading ? (
          <p className="text-xs text-ide-text-dim p-3">Loading files...</p>
        ) : tree.length === 0 ? (
          <p className="text-xs text-ide-text-dim p-3">
            No files found under <span className="text-ide-text">{workspaceRoot}</span>.
          </p>
        ) : (
          tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              onOpenFile={openFileAtPath}
              pinnedFiles={pinnedFiles}
              onTogglePinnedFile={togglePinnedFile}
            />
          ))
        )}
      </div>
    </div>
  );
}
