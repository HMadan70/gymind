// src/context/ThemeContext.tsx
//
// NOTE: `colors` is intentionally loosely typed (matches the pre-Brand-2.0
// version of this file) rather than typed as the strict `ThemeColors` shape.
// Several already-built screens (login/register/onboarding/workout/etc.)
// still reference old "5c" token names (colors.bgBase, colors.accent, ...)
// pending their Brand 2.0 re-skin pass (PROJECT_STATUS.md Phase 3.5) — a
// strict type here would fail `tsc --noEmit` on files this step doesn't
// touch. Re-skinning those screens (and tightening this type once every
// consumer uses the new token names) is tracked as separate follow-up work.
import React, { createContext, useContext, useMemo, useState } from "react";
import { baseTokens, shape, motion, ThemeMode } from "../constants/theme";

const ThemeContext = createContext<any>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  const colors = useMemo(() => baseTokens[mode], [mode]);

  const value = useMemo(
    () => ({ mode, setMode, colors, shape, motion }),
    [mode, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider");
  return ctx;
}
