"use client";

import { useDensity } from "@/hooks/use-density";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useTheme } from "next-themes";
import { toast } from "sonner";

/**
 * Mount once in the dashboard layout. Wires the ⌘⇧P density toggle
 * and ⌘⇧D theme toggle shortcuts.
 */
export function DensityToggleProvider() {
  const { density, toggleDensity } = useDensity();
  const { resolvedTheme, setTheme } = useTheme();

  useKeyboardShortcut({
    key: "p",
    modifiers: ["meta", "shift"],
    onTrigger: () => {
      const next = density === "cozy" ? "compact" : "cozy";
      toggleDensity();
      toast.info(`Density: ${next}`, {
        description: next === "compact"
          ? "Tighter spacing for power users"
          : "Relaxed spacing for readability",
      });
    },
  });

  useKeyboardShortcut({
    key: "d",
    modifiers: ["meta", "shift"],
    onTrigger: () => {
      const next = resolvedTheme === "dark" ? "light" : "dark";
      setTheme(next);
      toast.info(`Theme: ${next}`, {
        description: next === "dark" ? "Dark mode activated" : "Light mode activated",
      });
    },
  });

  return null;
}
