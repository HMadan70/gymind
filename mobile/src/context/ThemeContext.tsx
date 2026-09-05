// src/context/ThemeContext.tsx
import React, { createContext, useContext, useMemo, useState } from "react";
import {
  brand2Base,
  getBrandTokens,
  statusColors,
  shapeTokens,
  motionTokens,
  Mode,
} from "../constants/theme";

const ThemeContext = createContext<any>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("dark");

  const colors = useMemo(
    () => ({ ...brand2Base[mode], ...getBrandTokens(mode), ...statusColors }),
    [mode]
  );

  return (
    <ThemeContext.Provider
      value={{ mode, setMode, colors, shapes: shapeTokens, motion: motionTokens }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider");
  return ctx;
}