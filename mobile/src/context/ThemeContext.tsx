// src/context/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  brand2Base,
  getBrandTokens,
  statusColors,
  shapeTokens,
  motionTokens,
  Mode,
} from "../constants/theme";
import { API_URL } from "../constants/api";
import { authFetch, getToken } from "../lib/session";

export type ThemeColors = (typeof brand2Base)[Mode] &
  ReturnType<typeof getBrandTokens> &
  typeof statusColors;

type ThemeContextValue = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  colors: ThemeColors;
  shapes: typeof shapeTokens;
  motion: typeof motionTokens;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_CACHE_KEY = "theme_mode";

const isMode = (value: unknown): value is Mode => value === "dark" || value === "light";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("dark");

  // Restore the saved theme on startup. Settings writes the choice to
  // /users/preferences, but nothing read it back, so every relaunch fell
  // back to dark. Two sources, in order:
  //   1. AsyncStorage — applies immediately, and works offline/logged out.
  //   2. GET /users/preferences — the authoritative per-account value,
  //      which also picks up a change made on another device.
  // A brand-new user with no saved preference keeps the dark default.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cached = await AsyncStorage.getItem(THEME_CACHE_KEY);
        if (!cancelled && isMode(cached)) setMode(cached);
      } catch {
        // cache is a convenience only — fall through to the server
      }

      try {
        // Reads the token through session.ts's own accessor rather than a
        // second hardcoded AsyncStorage key - the token itself now lives in
        // expo-secure-store (see session.ts), not AsyncStorage, so a
        // duplicated key here would always read back null.
        const token = await getToken();
        if (!token) return;
        const response = await authFetch(`${API_URL}/users/preferences`);
        if (!response.ok) return; // 404 = no preference saved yet, keep default
        const preferences = await response.json();
        if (!cancelled && isMode(preferences?.theme_mode)) {
          setMode(preferences.theme_mode);
          await AsyncStorage.setItem(THEME_CACHE_KEY, preferences.theme_mode);
        }
      } catch {
        // offline or server down — whatever we already have stands
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Wraps setMode so any caller's choice is cached locally too, which is
  // what makes the next launch instant rather than waiting on the network.
  const selectMode = useMemo(
    () => (next: Mode) => {
      setMode(next);
      AsyncStorage.setItem(THEME_CACHE_KEY, next).catch(() => {});
    },
    []
  );

  const colors = useMemo(
    () => ({ ...brand2Base[mode], ...getBrandTokens(mode), ...statusColors }),
    [mode]
  );

  return (
    <ThemeContext.Provider
      value={{ mode, setMode: selectMode, colors, shapes: shapeTokens, motion: motionTokens }}
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
