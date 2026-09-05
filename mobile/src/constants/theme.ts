// src/constants/theme.ts
// Values sourced directly from the Gymind Brand 2.0 design system (Design2/BRAND_GUIDE.md)

export const brand2Base = {
  dark: {
    bgBase: "#040f15",
    bgCard: "#091b22",
    textPrimary: "#edf3f6",
    textDim: "#85959d",
    textFaint: "rgba(237,243,246,0.42)",   // ← add this line
  },
  light: {
    bgBase: "#f0f6f9",
    bgCard: "#ffffff",
    textPrimary: "#0b181e",
    textDim: "#59656b",
    textFaint: "rgba(11,24,30,0.42)",   // ← add this line
  },
} as const;

// Two brand hues (teal/gold) + one alert-only hue (coral) — see BRAND_GUIDE.md "Color"
export const brandColors = {
  dark: {
    teal: "#00bcc7",
    gold: "#dcbc33",
    coral: "#e6424c",
  },
  light: {
    teal: "#007680",
    gold: "#a18400",
    coral: "#cc323e",
  },
} as const;

export type Mode = "dark" | "light";

// Converts a hex color to an rgba string at a given alpha (0-1)
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Derived tokens per role: a translucent "soft" wash for tinted card backgrounds,
// computed from the same base hex rather than hand-picked — keeps dark/light consistent.
export function getBrandTokens(mode: Mode) {
  const c = brandColors[mode];
  return {
    teal: c.teal,
    gold: c.gold,
    coral: c.coral,
    tealSoft: hexToRgba(c.teal, mode === "dark" ? 0.16 : 0.12),
    goldSoft: hexToRgba(c.gold, mode === "dark" ? 0.16 : 0.12),
    coralSoft: hexToRgba(c.coral, mode === "dark" ? 0.18 : 0.14),
    tealOn: "#0b181e",   // dark text — teal is bright enough to need dark text on top
    goldOn: "#0b181e",   // dark text — gold is bright, same logic
    coralOn: "#ffffff",  // white text — coral is a darker/more saturated red
  };
}
// Cut-corner shape presets (BRAND_GUIDE.md "Shape language")
// Order: top-left, top-right, bottom-right, bottom-left
export const shapeTokens = {
  heroCard: { borderTopLeftRadius: 30, borderTopRightRadius: 12, borderBottomRightRadius: 30, borderBottomLeftRadius: 12 },
  secondaryCard: { borderTopLeftRadius: 26, borderTopRightRadius: 10, borderBottomRightRadius: 26, borderBottomLeftRadius: 10 },
  bottomSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderBottomRightRadius: 0, borderBottomLeftRadius: 0 },
  modal: { borderRadius: 20 },
  pill: { borderRadius: 999 }, // buttons, chips, inputs, avatars, dots — always fully rounded
} as const;

export const setCircleBase = {
  width: 28,
  height: 28,
  borderRadius: 14,
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

// Motion timing tokens (BRAND_GUIDE.md "Motion principles")
export const motionTokens = {
  screenIn: { duration: 425, translateYFrom: 14 }, // ms, px
  numericTransition: { duration: 550 },
  ambientLoop: { duration: 19000 }, // 16-22s range, midpoint
} as const;

// Status colors are fixed — never swapped with brand/mode
export const statusColors = {
  success: "#35C880",
  warning: "#FFB23F",
  danger: "#FF5247",
} as const;