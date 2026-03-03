import { useIDEStore, type SidebarPanel } from '../store/ideStore';

const sidebarItems: { id: SidebarPanel; icon: string; label: string }[] = [
  { id: 'explorer', icon: '📂', label: 'Explorer' },
  { id: 'search', icon: '🔍', label: 'Search' },
  { id: 'remix', icon: '⟠', label: 'Remix IDE' },
  { id: 'ai-chat', icon: '🤖', label: 'AI Chat' },
  { id: 'notebook', icon: '🎙️', label: 'NotebookLM' },
  { id: 'rag', icon: '🕸️', label: 'RAG / Crawl' },
  { id: 'knowledge', icon: '🧠', label: 'Knowledge Base' },
  { id: 'research', icon: '📊', label: 'Research Dashboard' },
  { id: 'skills', icon: '⚡', label: 'Skills' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

export function Sidebar() {
  const { activeSidebar, setSidebar, isSidebarOpen, toggleSidebar } = useIDEStore();

  return (
    <div className="flex flex-col items-center w-12 bg-ide-surface border-r border-ide-border py-2 gap-1">
      {sidebarItems.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            if (activeSidebar === item.id && isSidebarOpen) {
              toggleSidebar();
            } else {
              setSidebar(item.id);
            }
          }}
          className={`sidebar-btn ${activeSidebar === item.id && isSidebarOpen ? 'active' : ''}`}
          title={item.label}
        >
          <span className="text-lg">{item.icon}</span>
        </button>
      ))}
    </div>
  );
}
