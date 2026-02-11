/**
 * Desktop.tsx — main desktop environment component.
 *
 * Composes:
 * - Three.js eyeball in the centre background
 * - Icon grid with all registered applications
 * - Window manager for floating application windows
 * - Bottom navigation bar with two-column layout
 * - Right-click context menu
 */
import React, { useCallback, useState, useMemo } from "react";
import Eyeball from "@/components/eyeball/Eyeball";
import IconGrid from "@/components/icons/IconGrid";
import { FEATURED_APP_ID } from "@/components/icons/IconGrid";
import FeaturedAppCard from "@/components/icons/FeaturedAppCard";
import WindowManager from "@/components/desktop/WindowManager";
import BenchmarksCarousel from "@/components/results/BenchmarksCarousel";
import BottomNavBar from "@/components/desktop/BottomNavBar";
import TopNavBar from "@/components/desktop/TopNavBar";
import ContextMenu, {
  type ContextMenuItem,
} from "@/components/common/ContextMenu";
import Modal from "@/components/common/Modal";
import { useApplicationStore } from "@/stores/applicationStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useApplicationRegistry } from "@/hooks/useApplicationRegistry";
import { useWindowManager } from "@/hooks/useWindowManager";

interface DesktopProps {
  isTerminalOpen?: boolean;
  onTerminalToggle?: () => void;
}

const Desktop: React.FC<DesktopProps> = ({ 
  isTerminalOpen = true, 
  onTerminalToggle 
}) => {
  // Initialise the application registry on mount
  useApplicationRegistry();

  const applications = useApplicationStore((s) => s.applications);
  const isRunning = useApplicationStore((s) => s.isRunning);
  const { launch } = useWindowManager();

  // Featured app for the hero card (top-right)
  const featuredApp = applications.find((a) => a.id === FEATURED_APP_ID);
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
      className="relative w-full h-full no-select flex flex-col"
      onContextMenu={handleContextMenu}
    >
      {/* ── Top Navigation Bar ────────────────────────── */}
      <TopNavBar />

      {/* ── Main Desktop Area ─────────────────────────── */}
      <div className="flex-1 relative">
        {/* ── Eyeball background (centre) ────────────────── */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
          <div className="w-[400px] h-[400px]" style={{ pointerEvents: 'none' }}>
            <Eyeball />
          </div>
        </div>

      {/* ── Icon grid (left side) ──────────────────────── */}
      <div className="absolute top-4 left-4 bottom-4 w-[320px] lg:w-[400px] z-10">
        <IconGrid applications={applications} onLaunch={launch} />
      </div>


      {/* ── Featured App Card (top-right) ──────────────── */}
      {featuredApp && (
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-4">
          <FeaturedAppCard
            app={featuredApp}
            isRunning={isRunning(featuredApp.id)}
            onLaunch={launch}
          />
          <div className="mt-4 w-[420px]">
            <BenchmarksCarousel />
          </div>
        </div>
      )}

      {/* ── Window manager layer ───────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="pointer-events-auto">
          <WindowManager />
        </div>
      </div>

      {/* ── Bottom Navigation Bar ──────────────────────── */}
      <BottomNavBar 
        onTerminalToggle={onTerminalToggle}
        isTerminalOpen={isTerminalOpen}
      />

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
    </div>
  );
};

export default Desktop;
