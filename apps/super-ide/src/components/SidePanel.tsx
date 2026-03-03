import { useIDEStore } from '../store/ideStore';
import { ExplorerPanel } from './panels/ExplorerPanel';
import { SearchPanel } from './panels/SearchPanel';
import { RemixPanel } from './panels/RemixPanel';
import { AiChatPanel } from './panels/AiChatPanel';
import { NotebookPanel } from './panels/NotebookPanel';
import { RagPanel } from './panels/RagPanel';
import { KnowledgePanel } from './panels/KnowledgePanel';
import { ResearchPanel } from './panels/ResearchPanel';
import { SkillsPanel } from './panels/SkillsPanel';
import { SettingsPanel } from './panels/SettingsPanel';

const panelMap: Record<string, React.ComponentType> = {
  explorer: ExplorerPanel,
  search: SearchPanel,
  remix: RemixPanel,
  'ai-chat': AiChatPanel,
  notebook: NotebookPanel,
  rag: RagPanel,
  knowledge: KnowledgePanel,
  research: ResearchPanel,
  skills: SkillsPanel,
  settings: SettingsPanel,
};

export function SidePanel() {
  const { activeSidebar } = useIDEStore();
  const Panel = panelMap[activeSidebar];

  return (
    <div className="w-80 bg-ide-bg border-r border-ide-border flex flex-col overflow-hidden">
      {Panel ? <Panel /> : <div className="p-4 text-ide-text-dim text-sm">Select a panel</div>}
    </div>
  );
}
