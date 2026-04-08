"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

function ThemePersistence() {
  const { theme } = useTheme();

  React.useEffect(() => {
    if (!theme) return;

    window.localStorage.setItem("lyraalpha-theme", theme);
    document.cookie = `lyraalpha-theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemePersistence />
      {children}
    </NextThemesProvider>
  );
}
