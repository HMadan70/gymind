// src/constants/theme.ts
// Brand 2.0 — values sourced directly from Design2/BRAND_GUIDE.md and the
// canonical DARK/LIGHT token objects in Design2/Gymind UI.dc.html. Supersedes
// the old "5c" theme (Sora, Ember-orange default, 5 switchable accent
// presets) — see PROJECT_STATUS.md Section 14/Phase 3.5.
//
// Single fixed palette, no user-selectable accent: teal (primary),
// gold (secondary), coral (danger/alert-only — never decorative).
//
// The design source defines every color in OKLCH (see the comment beside
// each token below). React Native's color parser (@react-native/normalize-colors,
// checked against RN 0.86.3 / Expo SDK 57) does not understand oklch()/oklab()
// syntax — feeding it raw would silently fail to render. Each value here is
// the exact sRGB conversion of that OKLCH value (via the standard OKLab
// matrices from the CSS Color 4 spec), so colors match the design pixel-for-
// pixel while staying usable in RN style props.

export type ThemeMode = "dark" | "light";

// Typography (BRAND_GUIDE.md "Typography") — Space Grotesk 600/700 for
// headings/titles/large numerals, Manrope 400-800 for everything else.
// Font family names match the @expo-google-fonts/* packages' exported keys.
export const fonts = {
  headingSemiBold: "SpaceGrotesk_600SemiBold",
  headingBold: "SpaceGrotesk_700Bold",
  bodyRegular: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodySemiBold: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
  bodyExtraBold: "Manrope_800ExtraBold",
} as const;

export const baseTokens = {
  dark: {
    bg: "#040f15", // oklch(0.16 0.022 228)
    bgGrad1: "#003f4b", // oklch(0.32 0.10 205)
    bgGrad2: "#453000", // oklch(0.32 0.11 95)
    card: "#091b22", // oklch(0.21 0.028 228)
    cardAlt: "#122730", // oklch(0.26 0.032 228)
    border: "#1f3945", // oklch(0.33 0.038 228)
    navBg: "rgba(9, 27, 34, 0.85)", // oklch(0.21 0.028 228 / 0.85)
    text: "#edf3f6", // oklch(0.96 0.008 228)
    textDim: "#85959d", // oklch(0.66 0.022 228)
    primary: "#00bcc7", // oklch(0.72 0.13 202)
    primaryDeep: "#007783", // oklch(0.50 0.13 202)
    primarySoft: "rgba(0, 188, 199, 0.2)", // oklch(0.72 0.13 202 / 0.20)
    onPrimary: "#001113", // oklch(0.16 0.03 202)
    secondary: "#dcbc33", // oklch(0.80 0.15 95)
    secondarySoft: "rgba(220, 188, 51, 0.2)", // oklch(0.80 0.15 95 / 0.20)
    danger: "#e6424c", // oklch(0.62 0.20 22)
    dangerSoft: "rgba(230, 66, 76, 0.2)", // oklch(0.62 0.20 22 / 0.20)
  },
  light: {
    bg: "#f0f6f9", // oklch(0.97 0.008 228)
    bgGrad1: "#b8e8ee", // oklch(0.90 0.05 205)
    bgGrad2: "#ede2b5", // oklch(0.91 0.06 95)
    card: "#ffffff", // oklch(1 0 0)
    cardAlt: "#e7f0f5", // oklch(0.95 0.012 228)
    border: "#cddae0", // oklch(0.88 0.016 228)
    navBg: "rgba(255, 255, 255, 0.85)", // oklch(1 0 0 / 0.85)
    text: "#0b181e", // oklch(0.20 0.022 228)
    textDim: "#59656b", // oklch(0.50 0.018 228)
    primary: "#007680", // oklch(0.50 0.12 202)
    primaryDeep: "#00535d", // oklch(0.38 0.12 202)
    primarySoft: "rgba(0, 118, 128, 0.14)", // oklch(0.50 0.12 202 / 0.14)
    onPrimary: "#ffffff",
    secondary: "#a18400", // oklch(0.62 0.14 95)
    secondarySoft: "rgba(161, 132, 0, 0.14)", // oklch(0.62 0.14 95 / 0.14)
    danger: "#cc323e", // oklch(0.56 0.19 22)
    dangerSoft: "rgba(204, 50, 62, 0.14)", // oklch(0.56 0.19 22 / 0.14)
  },
} as const;

export type ThemeColors = (typeof baseTokens)["dark"];

// Shape language (BRAND_GUIDE.md "Shape language") — the cut-corner radius
// is the one signature container shape; tap targets stay fully rounded.
// RN's `borderRadius` has no CSS shorthand-string support — only individual
// numeric borderTopLeftRadius/etc — so each cut-corner spec is a per-corner
// object (order matches the CSS shorthand it's transcribed from: TL TR BR BL).
type CornerRadii = {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
};

export const shape = {
  // Hero/feature cards — "30px 12px 30px 12px": large TL & BR, small TR & BL
  heroCutCorner: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 30,
    borderBottomLeftRadius: 12,
  } satisfies CornerRadii,
  // Secondary cards — "26px 10px 26px 10px"
  cardCutCorner: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 26,
    borderBottomLeftRadius: 10,
  } satisfies CornerRadii,
  // Bottom sheets — "26px 26px 0 0", flat bottom
  sheetTop: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
  } satisfies CornerRadii,
  pill: 999,
} as const;

// Motion timings (BRAND_GUIDE.md "Motion principles")
export const motion = {
  screenIn: 425,
  sheetUp: 300,
  popIn: 300,
  progress: 550,
  ambientLoopMin: 16000,
  ambientLoopMax: 22000,
  easing: [0.2, 0.8, 0.2, 1] as const,
} as const;
