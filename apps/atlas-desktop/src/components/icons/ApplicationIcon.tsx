/**
 * ApplicationIcon — renders a single app icon with hover effects,
 * running indicator, and click handlers.
 *
 * Single-click → tooltip. Double-click → launch application.
 */
import React, { useCallback, useState, useRef } from "react";
import type { Application, ApplicationCategory } from "@/types/application";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/types/application";

export interface ApplicationIconProps {
  /** Application manifest */
  app: Application;
  /** Whether the application is currently running */
  isRunning: boolean;
  /** Called on double-click to launch */
  onLaunch: (appId: string) => void;
  /** Icon display size */
  size: "small" | "medium" | "large";
}

const SIZE_MAP = {
  small: { icon: 48, text: "text-[10px]", gap: "gap-1" },
  medium: { icon: 64, text: "text-xs", gap: "gap-1.5" },
  large: { icon: 96, text: "text-sm", gap: "gap-2" },
} as const;

/**
 * Generate a placeholder icon with category indicator and accent colour.
 */
function PlaceholderIcon({
  category,
  color,
  size,
}: {
  category: ApplicationCategory;
  color?: string;
  size: number;
}) {
  const bg = color ?? CATEGORY_COLORS[category];
  const emoji = CATEGORY_LABELS[category];

  return (
    <div
      className="rounded-xl flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${bg}33 0%, ${bg}18 100%)`,
        border: `4px solid ${bg}77`,
        boxShadow: `0 0 15px ${bg}44, inset 0 0 15px ${bg}22`,
      }}
    >
      <span style={{ fontSize: size * 0.4 }}>{emoji}</span>
    </div>
  );
}

const ApplicationIcon: React.FC<ApplicationIconProps> = ({
  app,
  isRunning,
  onLaunch,
  size,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dims = SIZE_MAP[size];

  const handleClick = useCallback(() => {
    // Distinguish single from double click
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      // Double-click → launch
      onLaunch(app.id);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        // Single-click → toggle tooltip
        setShowTooltip((v) => !v);
      }, 250);
    }
  }, [app.id, onLaunch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onLaunch(app.id);
      }
    },
    [app.id, onLaunch],
  );

  return (
    <div
      className={`relative flex flex-col items-center ${dims.gap} cursor-pointer
        transition-transform duration-150 hover:scale-110 focus-visible:scale-110
        group`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setShowTooltip(false)}
      role="button"
      tabIndex={0}
      aria-label={`${app.name}${isRunning ? " (running)" : ""}`}
    >
      {/* Icon */}
      {app.icon.type === "file" && app.icon.path ? (
        <img
          src={app.icon.path}
          alt={app.name}
          className="rounded-xl object-contain"
          style={{ 
            width: dims.icon, 
            height: dims.icon, 
            border: `4px solid ${app.icon.color ?? '#ff6b35'}77`,
            boxShadow: `0 0 15px ${app.icon.color ?? '#ff6b35'}44, inset 0 0 15px ${app.icon.color ?? '#ff6b35'}22`
          }}
          draggable={false}
        />
      ) : (
        <PlaceholderIcon
          category={app.category}
          color={app.icon.color}
          size={dims.icon}
        />
      )}

      {/* Enhanced Glow on hover */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100
          transition-all duration-300 pointer-events-none"
        style={{
          boxShadow: `0 0 25px ${app.icon.color ?? '#ff6b35'}88, 0 0 50px ${app.icon.color ?? '#ff6b35'}44, 0 0 75px ${app.icon.color ?? '#ff6b35'}22`,
          filter: 'blur(1px)',
        }}
      />

      {/* Running indicator */}
      {isRunning && <span className="running-dot" />}

      {/* Label */}
      <span
        className={`${dims.text} text-text-secondary text-center truncate max-w-[80px]
          group-hover:text-text-accent transition-colors`}
      >
        {app.name}
      </span>

      {/* Tooltip */}
      {showTooltip && app.description && (
        <div
          className="absolute -top-14 left-1/2 -translate-x-1/2 glass-panel
            rounded-lg px-3 py-1.5 text-xs text-text-primary whitespace-nowrap
            z-50 animate-fade-in pointer-events-none"
        >
          {app.description}
          {isRunning && (
            <span className="ml-2 text-accent-primary font-medium">
              Running
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(ApplicationIcon);
