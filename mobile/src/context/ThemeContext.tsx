// src/context/ThemeContext.tsx
import React, { createContext, useContext, useMemo, useState } from "react";
import { baseTokens, statusColors, getAccentTokens, AccentPreset } from "../constants/theme";

type ThemeMode = "dark" | "light";

const ThemeContext = createContext<any>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [accent, setAccent] = useState<AccentPreset>("Ember");

  const colors = useMemo(
    () => ({ ...baseTokens[mode], ...getAccentTokens(accent, mode), ...statusColors }),
    [mode, accent]
  );

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider");
  return ctx;
}