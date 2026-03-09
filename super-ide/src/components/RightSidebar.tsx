import { useIDEStore, type RightSidebarPanel } from '../store/ideStore';

const rightSidebarItems: { id: RightSidebarPanel; icon: string; label: string }[] = [
  { id: 'bolt-chat', icon: '⚡', label: 'Bolt Chat' },
  { id: 'testing', icon: '🧪', label: 'Testing' },
  { id: 'coverage', icon: '📊', label: 'Coverage' },
  { id: 'outline', icon: '🗂️', label: 'Outline' },
  { id: 'git', icon: '🔀', label: 'Git' },
];

export function RightSidebar() {
  const { activeRightSidebar, setRightSidebar, isRightSidebarOpen, toggleRightSidebar } =
    useIDEStore();

  return (
    <div
      className="flex flex-col items-center w-12 bg-ide-surface border-l border-ide-border py-2 gap-1"
      data-testid="right-sidebar"
    >
      {rightSidebarItems.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            if (activeRightSidebar === item.id && isRightSidebarOpen) {
              toggleRightSidebar();
            } else {
              setRightSidebar(item.id);
            }
          }}
          className={`sidebar-btn ${activeRightSidebar === item.id && isRightSidebarOpen ? 'active' : ''}`}
          title={item.label}
          data-testid={`right-sidebar-btn-${item.id}`}
        >
          <span className="text-lg">{item.icon}</span>
        </button>
      ))}
    </div>
  );
}
