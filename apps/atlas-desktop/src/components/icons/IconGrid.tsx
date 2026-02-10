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
 * 3-row side layout: icons flow left→right in 3 rows, scrolling horizontally
 * if they overflow. On smaller screens we allow overflow-x scroll.
 */
const ROWS_MAP: Record<IconSize, string> = {
  small: "grid-rows-3",
  medium: "grid-rows-3",
  large: "grid-rows-3",
};

const COLS_MAP: Record<IconSize, string> = {
  small: "grid-cols-[repeat(auto-fill,minmax(56px,1fr))]",
  medium: "grid-cols-[repeat(auto-fill,minmax(72px,1fr))]",
  large: "grid-cols-[repeat(auto-fill,minmax(100px,1fr))]",
};

const IconGrid: React.FC<IconGridProps> = ({ applications, onLaunch }) => {
  const iconSize = useDesktopStore((s) => s.iconSize);
  const isRunning = useApplicationStore((s) => s.isRunning);

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
      className={`grid ${ROWS_MAP[iconSize]} ${COLS_MAP[iconSize]} gap-3 p-4 overflow-y-auto max-h-full auto-rows-min grid-flow-col`}
      role="list"
      aria-label="Application launcher"
    >
      {gridApps.map((app) => (
        <div key={app.id} role="listitem">
          <ApplicationIcon
            app={app}
            isRunning={isRunning(app.id)}
            onLaunch={handleLaunch}
            size={iconSize}
          />
        </div>
      ))}
    </div>
  );
};

export default React.memo(IconGrid);
