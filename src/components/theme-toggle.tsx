"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

type ThemeOption = "system" | "light" | "dark";

type ThemeToggleProps = {
  className?: string;
  showLabels?: boolean;
  fullWidth?: boolean;
  showStatus?: boolean;
  includeSystem?: boolean;
};

const themeOptions: Array<{
  value: ThemeOption;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function ThemeToggle({ className, showLabels = false, fullWidth = false, showStatus = false, includeSystem = true }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const visibleOptions = includeSystem ? themeOptions : themeOptions.filter((option) => option.value !== "system");
  const railClass = showLabels
    ? "inline-grid h-11 rounded-full border border-border/70 bg-background/80 p-1 shadow-sm backdrop-blur-xl"
    : "inline-grid h-10 rounded-full border border-border/70 bg-background/90 p-0.5 shadow-sm backdrop-blur-xl";
  const itemClass = showLabels
    ? "inline-flex min-w-[92px] min-h-[40px] items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold"
    : "inline-flex size-9 min-h-9 min-w-9 items-center justify-center rounded-full text-xs font-semibold";

  if (!mounted) {
    return (
      <div className={cn("space-y-2", className)}>
        <div
          aria-hidden="true"
          className={cn(
            railClass,
            includeSystem ? "grid-cols-3" : "grid-cols-2",
            fullWidth && "w-full",
            !fullWidth && "w-fit",
          )}
        >
          {visibleOptions.map(({ value, label, Icon }) => (
            <div
              key={value}
              className={cn(
                itemClass,
                showLabels ? "text-muted-foreground/60" : "text-muted-foreground/70",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {showLabels ? <span className="truncate">{label}</span> : <span className="sr-only">{label}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const selectedTheme = ((theme as ThemeOption | undefined) ?? "system");
  const activeThemeLabel = resolvedTheme === "dark" ? "Dark" : "Light";
  const activeQuickTheme = selectedTheme === "system" ? (resolvedTheme === "dark" ? "dark" : "light") : selectedTheme;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="group"
        aria-label="Theme preference"
        className={cn(
          railClass,
          includeSystem ? "grid-cols-3" : "grid-cols-2",
          fullWidth && "w-full",
          !fullWidth && "w-fit",
        )}
      >
        {visibleOptions.map(({ value, label, Icon }) => {
          const isActive = includeSystem ? selectedTheme === value : activeQuickTheme === value;

          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              aria-label={label}
              title={label}
              onClick={() => setTheme(value)}
              className={cn(
                itemClass,
                "gap-1.5 transition-all focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px]",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(245,158,11,0.24)]"
                  : showLabels
                    ? "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                    : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {showLabels ? <span className="truncate">{label}</span> : <span className="sr-only">{label}</span>}
            </button>
          );
        })}
      </div>

      {mounted && showStatus && selectedTheme === "system" ? (
        <p className="text-xs text-muted-foreground">
          Following system. Currently using {activeThemeLabel}.
        </p>
      ) : null}
    </div>
  );
}
