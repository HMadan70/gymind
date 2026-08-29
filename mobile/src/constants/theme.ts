// src/constants/theme.ts
// Values sourced directly from the Gymind design system (theme.json / DESIGN_SYSTEM.md)

export const baseTokens = {
  dark: {
    bgBase: "#0A0F1A",
    bgElevated: "#0D1420",
    bgCard: "#131B2B",
    cardEdge: "rgba(255,255,255,0.06)",
    bgInset: "rgba(255,255,255,0.045)",
    border: "rgba(255,255,255,0.14)",
    textPrimary: "#F0F3F8",
    textDim: "rgba(240,243,248,0.72)",
    textFaint: "rgba(240,243,248,0.42)",
    shadow: "0 8px 30px rgba(0,0,0,0.45)",
  },
  light: {
    bgBase: "#F4F5F7",
    bgElevated: "#EDEEF1",
    bgCard: "#FFFFFF",
    cardEdge: "rgba(16,20,28,0.09)",
    bgInset: "#F1F2F5",
    border: "rgba(16,20,28,0.14)",
    textPrimary: "#10141C",
    textDim: "rgba(16,20,28,0.68)",
    textFaint: "rgba(16,20,28,0.42)",
    shadow: "0 2px 12px rgba(16,20,28,0.07)",
  },
} as const;

// Status colors are fixed — never swapped with accent/mode
export const statusColors = {
  success: "#35C880",
  warning: "#FFB23F",
  danger: "#FF5247",
} as const;

// Only 5 presets exist in the real design system (not 6 — no "Teal")
export type AccentPreset = "Ember" | "Signal" | "Amber" | "Violet" | "Volt";

export const accentPresetNames: AccentPreset[] = ["Ember", "Signal", "Amber", "Violet", "Volt"];

export const accentBase: Record <
  AccentPreset,
  { accent: string; tint2: string; tint3: string; deep: string; on: string }
> = {
  Ember:  { accent: "#FF6B1F", tint2: "#FF9A5E", tint3: "#FFD2B3", deep: "#C4470D", on: "#170800" },
  Signal: { accent: "#3FC4FF", tint2: "#7ED8FF", tint3: "#B7EBFF", deep: "#0A6E9E", on: "#001622" },
  Amber:  { accent: "#FFD023", tint2: "#FFE07A", tint3: "#FFEFBC", deep: "#A6740A", on: "#241A00" },
  Violet: { accent: "#A788FA", tint2: "#C4B2FC", tint3: "#E2D9FE", deep: "#6D45D9", on: "#170634" },
  Volt:   { accent: "#3FE07A", tint2: "#7DEBA6", tint3: "#BAF5CE", deep: "#12813F", on: "#04240F" },
};

// Converts a hex color to an rgba string at a given alpha (0-1)
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Derived tokens: computed from the accent hex, differ by mode (per DESIGN_SYSTEM.md)
export function getAccentTokens(preset: AccentPreset, mode: "dark" | "light") {
  const base = accentBase[preset];
  return {
    ...base,
    text: mode === "dark" ? base.tint2 : base.deep,
    chart: mode === "dark" ? base.tint3 : base.accent,
    soft: hexToRgba(base.accent, mode === "dark" ? 0.16 : 0.14),
    softStrong: hexToRgba(base.accent, mode === "dark" ? 0.24 : 0.18),
    dash: hexToRgba(base.accent, mode === "dark" ? 0.4 : 0.45),
  };
}