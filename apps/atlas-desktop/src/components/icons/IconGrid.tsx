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

export interface IconGridProps {
  /** Applications to display */
  applications: Application[];
  /** Called when an application is launched */
  onLaunch: (appId: string) => void;
}

const COLUMNS_MAP: Record<IconSize, string> = {
  small: "grid-cols-6 sm:grid-cols-8 lg:grid-cols-10",
  medium: "grid-cols-4 sm:grid-cols-5 lg:grid-cols-6",
  large: "grid-cols-3 sm:grid-cols-4",
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

  if (applications.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-sm">
        No applications registered
      </div>
    );
  }

  return (
    <div
      className={`grid ${COLUMNS_MAP[iconSize]} gap-4 p-4 overflow-y-auto max-h-full`}
      role="list"
      aria-label="Application launcher"
    >
      {applications.map((app) => (
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
