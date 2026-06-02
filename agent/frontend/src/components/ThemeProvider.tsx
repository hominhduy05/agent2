"use client";

import { ThemeProvider as ThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) {
  return (
    <ThemesProvider {...props}>
      {children}
    </ThemesProvider>
  );
}
