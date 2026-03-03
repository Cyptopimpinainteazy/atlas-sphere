import { useIDEStore, type SidebarPanel } from '../store/ideStore';

export function TitleBar() {
  const { setSidebar, toggleBottomPanel } = useIDEStore();

  const handleMenuClick = (action: string) => {
    switch (action) {
      case 'file':
        setSidebar('explorer');
        break;
      case 'view':
        setSidebar('explorer');
        break;
      case 'ai':
        setSidebar('ai-chat');
        break;
      case 'remix':
        setSidebar('remix');
        break;
      case 'tools':
        setSidebar('skills');
        break;
      case 'help':
        setSidebar('knowledge');
        break;
    }
  };

  return (
    <div className="flex items-center h-9 bg-ide-surface border-b border-ide-border px-4 select-none"
         style={{ WebkitAppRegion: 'drag' } as any}>
      {/* Logo */}
      <div className="flex items-center gap-2 mr-6" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
          A
        </div>
        <span className="text-xs font-semibold text-ide-text tracking-wide">Atlas SuperIDE</span>
      </div>

      {/* Menu Items */}
      <div className="flex items-center gap-4 text-xs text-ide-text-dim" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button onClick={() => handleMenuClick('file')} className="hover:text-ide-text transition-colors">File</button>
        <button onClick={() => handleMenuClick('edit')} className="hover:text-ide-text transition-colors">Edit</button>
        <button onClick={() => handleMenuClick('view')} className="hover:text-ide-text transition-colors">View</button>
        <button onClick={() => handleMenuClick('ai')} className="hover:text-ide-text transition-colors">AI</button>
        <button onClick={() => handleMenuClick('remix')} className="hover:text-ide-text transition-colors">Remix</button>
        <button onClick={() => handleMenuClick('tools')} className="hover:text-ide-text transition-colors">Tools</button>
        <button onClick={() => handleMenuClick('help')} className="hover:text-ide-text transition-colors">Help</button>
      </div>

      {/* Center title */}
      <div className="flex-1 text-center text-xs text-ide-text-dim">
        Atlas SuperIDE — Remix · OpenClaw · NotebookLM · RAG · Knowledge
      </div>

      {/* Window controls (for desktop) */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400" />
        <button className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400" />
        <button className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400" />
      </div>
    </div>
  );
}
