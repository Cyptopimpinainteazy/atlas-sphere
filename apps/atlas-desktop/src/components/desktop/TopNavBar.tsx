/**
 * TopNavBar.tsx — Top navigation bar with dropdown menus
 *
 * Features:
 * - File menu with New, Open, Save options
 * - Edit menu with Copy, Paste, Preferences
 * - View menu with themes, layouts
 * - Tools menu with developer options
 * - Help menu with documentation
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../theme/ThemeProvider';
import { useDesktopStore } from '@/stores/desktopStore';
import { useSocialStore } from '@/stores/socialStore';
import { useApplicationStore } from '@/stores/applicationStore';
import { useWindowManager } from '@/hooks/useWindowManager';
import type { ApplicationCategory } from '@/types/application';

interface MenuItem {
  label?: string;
  icon?: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  submenu?: MenuItem[];
}

interface DropdownMenuProps {
  items: MenuItem[];
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ items, isOpen, onClose, position }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Menu */}
      <div
        className="absolute glass-panel border border-border-default rounded-lg shadow-2xl z-50 min-w-[200px] py-1"
        style={{ top: position.top, left: position.left }}
      >
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {item.divider && <div className="border-t border-border-default my-1" />}
            {!item.divider && (
              <button
                className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-accent-primary/10
                  hover:text-accent-primary transition-colors flex items-center justify-between group"
                onClick={() => {
                  item.action?.();
                  onClose();
                }}
              >
                <div className="flex items-center gap-3">
                  {item.icon && <span className="text-base">{item.icon}</span>}
                  <span>{item.label}</span>
                </div>
                {item.shortcut && (
                  <span className="text-xs text-text-secondary group-hover:text-accent-primary/70">
                    {item.shortcut}
                  </span>
                )}
              </button>
            )}
          </React.Fragment>
        ))}
      </div>
    </>
  );
};

const TopNavBar: React.FC = () => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  const { toggle: toggleTheme, isDark } = useTheme();
  const iconSize = useDesktopStore((s) => s.iconSize);
  const setIconSize = useDesktopStore((s) => s.setIconSize);
  const minimizeAll = useDesktopStore((s) => s.minimizeAll);

  // Social login state
  const { isLoggedIn, currentUser, session, logout: socialLogout, restoreSession } = useSocialStore();
  const navigate = useNavigate();
  const [showLoginDropdown, setShowLoginDropdown] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const socialLogin = useSocialStore((s) => s.login);

  // Restore session on mount
  React.useEffect(() => { restoreSession(); }, []);

  // Application registry & window manager for Apps dropdown
  const applications = useApplicationStore((s) => s.applications);
  const { launch } = useWindowManager();

  const CATEGORY_META: Record<ApplicationCategory, { icon: string; label: string }> = {
    blockchain: { icon: '⛓️', label: 'Blockchain' },
    defi:       { icon: '💰', label: 'DeFi' },
    analysis:   { icon: '📊', label: 'Analysis' },
    service:    { icon: '🔧', label: 'Services' },
    security:   { icon: '🛡️', label: 'Security' },
    development:{ icon: '💻', label: 'Development' },
    utility:    { icon: '🧰', label: 'Utilities' },
    other:      { icon: '📦', label: 'Other' },
  };

  const CATEGORY_ORDER: ApplicationCategory[] = [
    'blockchain', 'defi', 'analysis', 'service', 'security', 'development', 'utility', 'other',
  ];

  const groupedApps = useMemo(() => {
    const groups: Partial<Record<ApplicationCategory, typeof applications>> = {};
    for (const app of applications) {
      const cat = app.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(app);
    }
    // Sort each group alphabetically by name
    for (const cat of Object.keys(groups) as ApplicationCategory[]) {
      groups[cat]!.sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [applications]);

  const [showAppsMenu, setShowAppsMenu] = useState(false);
  const [appsMenuFilter, setAppsMenuFilter] = useState('');
  const appsButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUser || !loginPass) { setLoginError('Fill in both fields'); return; }
    setLoginLoading(true);
    setLoginError('');
    try {
      await socialLogin(loginUser, loginPass);
      setShowLoginDropdown(false);
      setLoginUser('');
      setLoginPass('');
    } catch (err: any) {
      setLoginError(String(err));
    }
    setLoginLoading(false);
  };

  const handleSignOut = async () => {
    await socialLogout();
    setShowLoginDropdown(false);
  };

  const ROLE_ICON: Record<string, string> = { team: '🔶', admin: '👑', vip: '💎' };
  const ROLE_COLOR: Record<string, string> = { team: '#ff6b35', admin: '#ff2d55', vip: '#a855f7' };

  const handleMenuClick = useCallback((menuName: string, event: React.MouseEvent) => {
    event.preventDefault();
    setShowAppsMenu(false);
    const rect = menuRefs.current[menuName]?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({ top: rect.bottom + 4, left: rect.left });
      setOpenMenu(openMenu === menuName ? null : menuName);
    }
  }, [openMenu]);

  const closeMenu = useCallback(() => {
    setOpenMenu(null);
  }, []);

  const fileMenuItems: MenuItem[] = [
    { label: 'New Window', icon: '🆕', shortcut: 'Ctrl+N', action: () => console.log('New Window') },
    { label: 'Open File', icon: '📁', shortcut: 'Ctrl+O', action: () => console.log('Open File') },
    { label: 'Save', icon: '💾', shortcut: 'Ctrl+S', action: () => console.log('Save') },
    { divider: true },
    { label: 'Exit', icon: '🚪', shortcut: 'Alt+F4', action: () => window.close() },
  ];

  const editMenuItems: MenuItem[] = [
    { label: 'Copy', icon: '📋', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
    { label: 'Paste', icon: '📄', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
    { label: 'Cut', icon: '✂️', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
    { divider: true },
    { label: 'Preferences', icon: '⚙️', action: () => console.log('Preferences') },
  ];

  const viewMenuItems: MenuItem[] = [
    { label: isDark ? 'Light Mode' : 'Dark Mode', icon: isDark ? '☀️' : '🌙', shortcut: 'Ctrl+T', action: toggleTheme },
    { divider: true },
    { label: 'Icon Size', icon: '📐', action: () => {
      const sizes: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];
      const idx = sizes.indexOf(iconSize);
      setIconSize(sizes[(idx + 1) % sizes.length]);
    }},
    { label: 'Show Desktop', icon: '🖥️', shortcut: 'Ctrl+D', action: minimizeAll },
    { label: 'Refresh', icon: '🔄', shortcut: 'F5', action: () => window.location.reload() },
  ];

  const toolsMenuItems: MenuItem[] = [
    { label: 'Developer Tools', icon: '🛠️', shortcut: 'F12', action: () => console.log('Dev Tools') },
    { label: 'Terminal', icon: '💻', shortcut: 'Ctrl+`', action: () => console.log('Terminal') },
    { label: 'Task Manager', icon: '📊', action: () => console.log('Task Manager') },
    { divider: true },
    { label: 'System Info', icon: 'ℹ️', action: () => console.log('System Info') },
  ];

  const helpMenuItems: MenuItem[] = [
    { label: 'Documentation', icon: '📚', action: () => console.log('Documentation') },
    { label: 'Keyboard Shortcuts', icon: '⌨️', action: () => console.log('Shortcuts') },
    { divider: true },
    { label: 'About Atlas Desktop', icon: '🏢', action: () => console.log('About') },
  ];

  const menuItems = {
    file: fileMenuItems,
    edit: editMenuItems,
    view: viewMenuItems,
    tools: toolsMenuItems,
    help: helpMenuItems,
  };

  return (
    <div className="relative">
      {/* Top Navigation Bar */}
      <div className="h-10 bg-gradient-to-r from-bg-primary/95 via-bg-secondary/95 to-bg-primary/95
        backdrop-blur-md border-b border-border-default flex items-center px-4 gap-1
        shadow-lg z-30">

        {/* Atlas Logo */}
        <div className="flex items-center gap-2 mr-6">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary
            flex items-center justify-center text-xs font-bold text-white shadow-lg">
            A
          </div>
          <span className="text-sm font-semibold text-text-primary">Atlas</span>
        </div>

        {/* Menu Buttons */}
        {Object.keys(menuItems).map((menuName) => (
          <button
            key={menuName}
            ref={(el) => menuRefs.current[menuName] = el}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200
              hover:bg-accent-primary/20 hover:text-accent-primary capitalize
              ${openMenu === menuName ? 'bg-accent-primary/30 text-accent-primary shadow-md' : 'text-text-secondary'}`}
            onClick={(e) => handleMenuClick(menuName, e)}
          >
            {menuName}
          </button>
        ))}

        {/* Apps Mega-Menu Button */}
        <button
          ref={appsButtonRef}
          className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200
            hover:bg-accent-primary/20 hover:text-accent-primary
            ${showAppsMenu ? 'bg-accent-primary/30 text-accent-primary shadow-md' : 'text-text-secondary'}`}
          onClick={() => { setOpenMenu(null); setShowAppsMenu(!showAppsMenu); setAppsMenuFilter(''); }}
        >
          🚀 Apps
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Navigation Links */}
        <div className="flex items-center gap-2 mr-4">
          <button onClick={() => navigate('/social')} className="px-2 py-1 text-xs font-medium text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 rounded transition-all">
            🌐 Social
          </button>
          <button onClick={() => navigate('/crm')} className="px-2 py-1 text-xs font-medium text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 rounded transition-all">
            📅 CRM
          </button>
        </div>

        {/* User / Login */}
        <div className="relative flex items-center gap-2">
          {isLoggedIn && currentUser ? (
            <div className="flex items-center gap-2">
              {currentUser.role && ROLE_ICON[currentUser.role] && (
                <span style={{
                  background: `${ROLE_COLOR[currentUser.role]}22`,
                  border: `1px solid ${ROLE_COLOR[currentUser.role]}55`,
                  color: ROLE_COLOR[currentUser.role],
                  borderRadius: 8, padding: '1px 6px', fontSize: '0.55rem', fontWeight: 700,
                }}>
                  {ROLE_ICON[currentUser.role]}
                </span>
              )}
              <button
                onClick={() => setShowLoginDropdown(!showLoginDropdown)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-text-primary hover:bg-accent-primary/10 rounded transition-all"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-[9px] font-bold text-white">
                  {(currentUser.displayName || currentUser.username)[0].toUpperCase()}
                </div>
                <span className="max-w-[80px] truncate">{currentUser.displayName || session?.username}</span>
              </button>
              {showLoginDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLoginDropdown(false)} />
                  <div className="absolute right-0 top-9 z-50 glass-panel border border-border-default rounded-lg shadow-2xl min-w-[180px] py-1">
                    <button onClick={() => { navigate('/social/profile'); setShowLoginDropdown(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-accent-primary/10 transition-colors flex items-center gap-2">
                      👤 My Profile
                    </button>
                    <button onClick={() => { navigate('/social/messages'); setShowLoginDropdown(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-accent-primary/10 transition-colors flex items-center gap-2">
                      ✉️ Messages
                    </button>
                    <button onClick={() => { navigate('/crm'); setShowLoginDropdown(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-accent-primary/10 transition-colors flex items-center gap-2">
                      📅 Calendar CRM
                    </button>
                    <div className="border-t border-border-default my-1" />
                    <button onClick={handleSignOut}
                      className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2">
                      🚪 Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowLoginDropdown(!showLoginDropdown)}
                className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 rounded-lg transition-all"
              >
                🔑 Sign In
              </button>
              {showLoginDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLoginDropdown(false)} />
                  <div className="absolute right-0 top-9 z-50 glass-panel border border-border-default rounded-lg shadow-2xl min-w-[260px] p-4">
                    <div className="text-sm font-semibold text-text-primary mb-3">AtlasSpace Login</div>
                    {loginError && <div className="text-xs text-red-400 mb-2">{loginError}</div>}
                    <form onSubmit={handleQuickLogin} className="flex flex-col gap-2">
                      <input
                        className="px-3 py-1.5 text-xs bg-bg-primary border border-border-default rounded text-text-primary focus:border-accent-primary outline-none"
                        placeholder="Username"
                        value={loginUser}
                        onChange={e => setLoginUser(e.target.value)}
                        autoFocus
                      />
                      <input
                        className="px-3 py-1.5 text-xs bg-bg-primary border border-border-default rounded text-text-primary focus:border-accent-primary outline-none"
                        type="password"
                        placeholder="Password"
                        value={loginPass}
                        onChange={e => setLoginPass(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={loginLoading}
                        className="px-3 py-1.5 text-xs font-medium bg-accent-primary text-white rounded hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
                      >
                        {loginLoading ? 'Signing in...' : 'Sign In'}
                      </button>
                    </form>
                    <div className="mt-2 text-center">
                      <button onClick={() => { navigate('/social'); setShowLoginDropdown(false); }}
                        className="text-[10px] text-accent-primary hover:underline">
                        Create Account / Use Team Code →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3 text-xs text-text-secondary ml-3">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isLoggedIn ? 'bg-green-500' : 'bg-gray-500'} animate-pulse`}></div>
            <span>{isLoggedIn ? 'Online' : 'Offline'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🕒</span>
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Dropdown Menus */}
      {Object.keys(menuItems).map((menuName) => (
        <DropdownMenu
          key={menuName}
          items={menuItems[menuName as keyof typeof menuItems]}
          isOpen={openMenu === menuName}
          onClose={closeMenu}
          position={menuPosition}
        />
      ))}

      {/* Apps Mega-Dropdown */}
      {showAppsMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowAppsMenu(false)} />
          <div
            className="absolute z-50 glass-panel border border-border-default rounded-xl shadow-2xl"
            style={{
              top: (appsButtonRef.current?.getBoundingClientRect().bottom ?? 40) + 4,
              left: Math.max(8, (appsButtonRef.current?.getBoundingClientRect().left ?? 0) - 60),
              width: 'min(90vw, 820px)',
              maxHeight: '70vh',
            }}
          >
            {/* Search */}
            <div className="p-3 border-b border-border-default">
              <input
                autoFocus
                placeholder="Search apps…"
                value={appsMenuFilter}
                onChange={e => setAppsMenuFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-bg-primary border border-border-default rounded-lg text-text-primary focus:border-accent-primary outline-none"
              />
            </div>

            {/* Categorized grid */}
            <div className="overflow-y-auto p-3" style={{ maxHeight: 'calc(70vh - 56px)' }}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {CATEGORY_ORDER.map(cat => {
                  const apps = groupedApps[cat];
                  if (!apps || apps.length === 0) return null;
                  const filtered = appsMenuFilter
                    ? apps.filter(a => a.name.toLowerCase().includes(appsMenuFilter.toLowerCase()))
                    : apps;
                  if (filtered.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className="text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-2 flex items-center gap-1">
                        <span>{CATEGORY_META[cat].icon}</span>
                        <span>{CATEGORY_META[cat].label}</span>
                        <span className="text-text-secondary/50">({filtered.length})</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {filtered.map(app => (
                          <button
                            key={app.id}
                            title={app.description || app.name}
                            className="w-full text-left px-2 py-1.5 text-xs text-text-primary rounded-md
                              hover:bg-accent-primary/15 hover:text-accent-primary transition-colors
                              flex items-center gap-2 group"
                            onClick={() => { launch(app.id); setShowAppsMenu(false); }}
                          >
                            <span className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                              style={{ background: app.icon.color || '#666' }}>
                              {app.name[0]}
                            </span>
                            <span className="truncate">{app.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {appsMenuFilter && Object.values(groupedApps).every(apps => !apps?.some(a => a.name.toLowerCase().includes(appsMenuFilter.toLowerCase()))) && (
                <div className="text-center text-xs text-text-secondary py-6">No apps match "{appsMenuFilter}"</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TopNavBar;