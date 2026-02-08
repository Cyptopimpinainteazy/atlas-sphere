/**
 * Desktop.tsx — main desktop environment component.
 *
 * Composes:
 * - Three.js eyeball in the centre background
 * - Icon grid with all registered applications
 * - Window manager for floating application windows
 * - Taskbar at the bottom
 * - Right-click context menu
 */
import React, { useCallback, useState, useMemo } from "react";
import Eyeball from "@/components/eyeball/Eyeball";
import IconGrid from "@/components/icons/IconGrid";
import WindowManager from "@/components/desktop/WindowManager";
import Taskbar from "@/components/desktop/Taskbar";
import ContextMenu, {
  type ContextMenuItem,
} from "@/components/common/ContextMenu";
import Modal from "@/components/common/Modal";
import { useApplicationStore } from "@/stores/applicationStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useApplicationRegistry } from "@/hooks/useApplicationRegistry";
import { useWindowManager } from "@/hooks/useWindowManager";

const Desktop: React.FC = () => {
  // Initialise the application registry on mount
  useApplicationRegistry();

  const applications = useApplicationStore((s) => s.applications);
  const { launch } = useWindowManager();
  const { toggle: toggleTheme, isDark } = useTheme();
  const iconSize = useDesktopStore((s) => s.iconSize);
  const setIconSize = useDesktopStore((s) => s.setIconSize);
  const minimizeAll = useDesktopStore((s) => s.minimizeAll);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // About modal
  const [showAbout, setShowAbout] = useState(false);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const contextMenuItems: ContextMenuItem[] = useMemo(
    () => [
      {
        label: "Show Desktop",
        icon: "🖥",
        shortcut: "Ctrl+D",
        action: minimizeAll,
      },
      {
        label: isDark ? "Light Mode" : "Dark Mode",
        icon: isDark ? "☀" : "🌙",
        action: toggleTheme,
      },
      {
        label: "Icon Size",
        icon: "📐",
        divider: true,
        action: () => {
          const sizes: Array<"small" | "medium" | "large"> = [
            "small",
            "medium",
            "large",
          ];
          const idx = sizes.indexOf(iconSize);
          setIconSize(sizes[(idx + 1) % sizes.length]);
        },
      },
      {
        label: "Refresh",
        icon: "🔄",
        shortcut: "F5",
        action: () => window.location.reload(),
      },
      {
        label: "About Atlas Desktop",
        icon: "ℹ",
        divider: true,
        action: () => setShowAbout(true),
      },
    ],
    [isDark, toggleTheme, iconSize, setIconSize, minimizeAll],
  );

  return (
    <div
      className="relative w-full h-full no-select"
      onContextMenu={handleContextMenu}
    >
      {/* ── Eyeball background (centre) ────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[320px] h-[320px] opacity-90">
          <Eyeball />
        </div>
      </div>

      {/* ── Icon grid (left side) ──────────────────────── */}
      <div className="absolute top-4 left-4 bottom-14 w-[320px] lg:w-[400px]">
        <IconGrid applications={applications} onLaunch={launch} />
      </div>

      {/* ── Window manager layer ───────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="pointer-events-auto">
          <WindowManager />
        </div>
      </div>

      {/* ── Taskbar ────────────────────────────────────── */}
      <Taskbar />

      {/* ── Context menu ───────────────────────────────── */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={contextMenuItems}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* ── About modal ────────────────────────────────── */}
      <Modal
        open={showAbout}
        onClose={() => setShowAbout(false)}
        title="About Atlas Desktop"
        width={360}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl text-accent-primary">⬡</span>
            <div>
              <h3 className="font-bold text-base">Atlas Sphere Desktop</h3>
              <p className="text-xs text-text-secondary">
                Blockchain Command Center
              </p>
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            Version 0.1.0 — Built with Tauri, React, Three.js, and Zustand.
          </p>
          <div className="text-[10px] text-text-secondary/60 pt-2 border-t border-border-default">
            <p>© 2026 Atlas Sphere Project</p>
            <p>Dark-themed desktop environment for blockchain operations.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Desktop;
