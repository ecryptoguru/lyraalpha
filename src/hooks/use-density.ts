"use client";

import { useEffect, useState, useCallback } from "react";

type Density = "cozy" | "compact";

const STORAGE_KEY = "lyraalpha-density";

function getInitialDensity(): Density {
  if (typeof window === "undefined") return "cozy";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "compact" || stored === "cozy") return stored;
  } catch {
    // ignore
  }
  return "cozy";
}

function applyDensityToRoot(density: Density) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-density", density);
}

/**
 * Manages the global density mode (cozy vs compact).
 * Persists to localStorage and sets `data-density` attribute on <html>.
 * The CSS vars `--density-gap-y`, `--density-gap-x`, `--density-padding`,
 * `--density-row-height` are driven by this attribute (see globals.css).
 */
export function useDensity() {
  const [density, setDensityState] = useState<Density>(getInitialDensity);

  // Apply on mount + changes
  useEffect(() => {
    applyDensityToRoot(density);
  }, [density]);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity(density === "cozy" ? "compact" : "cozy");
  }, [density, setDensity]);

  return { density, setDensity, toggleDensity } as const;
}
