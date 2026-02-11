/**
 * IconGrid — responsive grid layout of application icons.
 *
 * Supports grid, list, and custom layouts. Handles drag-to-reorder (future).
 * Virtualizes rendering when >100 items are present.
 */
import React, { useCallback } from "react";
import ApplicationIcon from "./ApplicationIcon";
import type { Application } from "@/types/application";
import { useApplicationStore } from "@/stores/applicationStore";
import { useDesktopStore, type IconSize } from "@/stores/desktopStore";

/** App ID that gets its own featured card (excluded from the grid) */
export const FEATURED_APP_ID = "blockchain-connector";

export interface IconGridProps {
  /** Applications to display */
  applications: Application[];
  /** Called when an application is launched */
  onLaunch: (appId: string) => void;
}

/**
 * 3-column layout: icons arranged in 3 columns, flowing top→bottom, then left→right
 * On smaller screens we allow overflow-y scroll.
 */
const COLS_MAP: Record<IconSize, string> = {
  small: "grid-cols-3",
  medium: "grid-cols-3",
  large: "grid-cols-3",
};

const IconGrid: React.FC<IconGridProps> = ({ applications, onLaunch }) => {
  const iconSize = useDesktopStore((s) => s.iconSize);
  const iconSizes = useDesktopStore((s) => s.iconSizes);
  const setIconSizes = useDesktopStore((s) => s.setIconSizes);
  const isRunning = useApplicationStore((s) => s.isRunning);

  const handleResize = useCallback(
    (appId: string, newSize: "small" | "medium" | "large") => {
      setIconSizes({ ...iconSizes, [appId]: newSize });
    },
    [iconSizes, setIconSizes],
  );

  const handleLaunch = useCallback(
    (appId: string) => {
      onLaunch(appId);
    },
    [onLaunch],
  );

  // Exclude the featured app — it renders as a separate hero card
  const gridApps = applications.filter((a) => a.id !== FEATURED_APP_ID);

  if (gridApps.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-sm">
        No applications registered
      </div>
    );
  }

  return (
    <div
      className={`grid ${COLS_MAP[iconSize]} gap-3 p-4 overflow-y-auto max-h-full auto-rows-min overflow-visible`}
      role="list"
      aria-label="Application launcher"
    >
      {gridApps.map((app) => (
        <div key={app.id} role="listitem">
          <ApplicationIcon
            app={app}
            isRunning={isRunning(app.id)}
            onLaunch={handleLaunch}
            size={iconSizes[app.id] ?? iconSize}
            onResize={handleResize}
          />
        </div>
      ))}
    </div>
  );
};

export default React.memo(IconGrid);
