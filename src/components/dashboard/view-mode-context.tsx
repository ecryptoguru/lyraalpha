"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type DashboardMode = "simple" | "advanced";

const STORAGE_KEY = "dashboard:view-mode";

interface ViewModeContextValue {
  mode: DashboardMode;
  setMode: (mode: DashboardMode) => void;
  isLoading: boolean;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

function normalizeMode(value: unknown): DashboardMode | null {
  return value === "advanced" || value === "simple" ? value : null;
}

export function ViewModeProvider({
  children,
  initialMode = "simple",
}: {
  children: React.ReactNode;
  initialMode?: DashboardMode;
}) {
  const [mode, setModeState] = useState<DashboardMode>(initialMode);
  const [isLoading, setIsLoading] = useState(true);
  const userSelectedRef = useRef(false);

  const persistMode = useCallback(async (nextMode: DashboardMode) => {
    try {
      await fetch("/api/user/preferences/dashboard-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardMode: nextMode }),
      });
    } catch {
      // Silent failure: local state + localStorage keep UX responsive.
    }
  }, []);

  const setMode = useCallback(
    (nextMode: DashboardMode) => {
      userSelectedRef.current = true;
      setModeState(nextMode);
      try {
        window.localStorage.setItem(STORAGE_KEY, nextMode);
      } catch {
        // Ignore storage errors.
      }
      void persistMode(nextMode);
    },
    [persistMode],
  );

  useEffect(() => {
    let active = true;

    const localMode = (() => {
      try {
        return normalizeMode(window.localStorage.getItem(STORAGE_KEY));
      } catch {
        return null;
      }
    })();

    if (localMode) {
      setModeState(localMode);
    }

    async function loadServerMode() {
      try {
        const response = await fetch("/api/user/preferences/dashboard-mode", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { dashboardMode?: DashboardMode };
        const serverMode = normalizeMode(data.dashboardMode);
        if (!active || !serverMode) return;

        if (!userSelectedRef.current) {
          setModeState(serverMode);
        }

        try {
          window.localStorage.setItem(STORAGE_KEY, serverMode);
        } catch {
          // Ignore storage errors.
        }
      } catch {
        // Silent failure by design.
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadServerMode();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, isLoading }),
    [isLoading, mode, setMode],
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used inside ViewModeProvider");
  }
  return context;
}
