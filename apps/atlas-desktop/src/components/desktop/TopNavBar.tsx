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
import React, { useState, useRef, useCallback } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useDesktopStore } from '@/stores/desktopStore';

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

  const handleMenuClick = useCallback((menuName: string, event: React.MouseEvent) => {
    event.preventDefault();
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status Indicators */}
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>Online</span>
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
    </div>
  );
};

export default TopNavBar;