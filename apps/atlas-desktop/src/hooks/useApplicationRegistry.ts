/**
 * useApplicationRegistry — fetches and caches the application registry.
 */
import { useEffect } from "react";
import { useApplicationStore } from "@/stores/applicationStore";
import {
  fetchApplicationRegistry,
  DEFAULT_APPLICATIONS,
} from "@/services/applicationService";

/**
 * Fetches the application registry on mount and populates the store.
 */
export function useApplicationRegistry(): void {
  const setApplications = useApplicationStore((s) => s.setApplications);
  const applications = useApplicationStore((s) => s.applications);

  useEffect(() => {
    if (applications.length > 0) return; // already loaded

    let cancelled = false;

    fetchApplicationRegistry().then((apps) => {
      if (!cancelled) {
        setApplications(apps.length > 0 ? apps : DEFAULT_APPLICATIONS);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [setApplications, applications.length]);
}
