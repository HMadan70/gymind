// src/constants/theme.ts
// Values sourced directly from the Gymind Brand 2.0 design system (Design2/BRAND_GUIDE.md)

export const brand2Base = {
  dark: {
    bgBase: "#040f15",
    bgCard: "#091b22",
    bgInset: "#122730",   // design-source cardAlt — oklch(0.26 0.032 228)
    border: "#1f3945",    // design-source border  — oklch(0.33 0.038 228)
    textPrimary: "#edf3f6",
    textDim: "#85959d",
    textFaint: "rgba(237,243,246,0.42)",
  },
  light: {
    bgBase: "#f0f6f9",
    bgCard: "#ffffff",
    bgInset: "#e7f0f5",   // design-source cardAlt — oklch(0.95 0.012 228)
    border: "#cddae0",    // design-source border  — oklch(0.88 0.016 228)
    textPrimary: "#0b181e",
    textDim: "#59656b",
    textFaint: "rgba(11,24,30,0.42)",
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

// Typography families (BRAND_GUIDE.md "Typography").
// Space Grotesk 600/700 → headings, screen titles, large numerals (timers, stats).
// Manrope 400-800 → body copy, labels, buttons, inputs. Never a third family.
// RN has no font cascade, so these are applied per-Text via `fonts.*`.
export const fonts = {
  heading: "SpaceGrotesk_700Bold",
  headingSemi: "SpaceGrotesk_600SemiBold",
  headingMedium: "SpaceGrotesk_500Medium",
  body: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodySemi: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
  bodyExtra: "Manrope_800ExtraBold",
} as const;

// Converts a hex color to an rgba string at a given alpha (0-1)
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Blends an accent into a base colour and returns an opaque hex. Used for
// the ambient gradient stops: they must be fully opaque, because the
// gradient is the screen's backdrop and has nothing behind it to composite
// against (a translucent stop reads as a washed-out light haze instead).
function hexBlend(base: string, accent: string, amount: number): string {
  const channel = (hex: string, index: number) =>
    parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(channel(base, i) * (1 - amount) + channel(accent, i) * amount)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

// Derived tokens per role: a translucent "soft" wash for tinted card backgrounds,
// computed from the same base hex rather than hand-picked — keeps dark/light consistent.
export function getBrandTokens(mode: Mode) {
  const c = brandColors[mode];
  const base = brand2Base[mode];

  // Text/icon colour that sits ON a filled teal or gold surface. This has to
  // flip with the mode: dark-mode teal/gold are bright (luminance .40/.51) so
  // they take dark text, but the light-mode variants are deliberately much
  // deeper (.15/.24) and need white on top instead. Using one fixed value put
  // near-black text on a dark teal button in light mode.
  const onAccent = mode === "dark" ? "#0b181e" : "#ffffff";

  return {
    teal: c.teal,
    gold: c.gold,
    coral: c.coral,
    tealSoft: hexToRgba(c.teal, mode === "dark" ? 0.16 : 0.12),
    goldSoft: hexToRgba(c.gold, mode === "dark" ? 0.16 : 0.12),
    coralSoft: hexToRgba(c.coral, mode === "dark" ? 0.18 : 0.14),
    tealOn: onAccent,
    goldOn: onAccent,
    coralOn: "#ffffff",  // white text — coral is a darker/more saturated red in both modes

    // Ambient background gradient stops — the base tinted 15% toward each
    // brand hue, so the dark base still dominates and the tint reads as a
    // soft glow. Mode-aware so light mode gets a light wash rather than the
    // dark stops the screens previously hardcoded.
    gradientTop: hexBlend(base.bgBase, c.teal, 0.15),
    gradientBottom: hexBlend(base.bgBase, c.gold, 0.15),

    // Floating nav bar fill — the card colour at 85% so the ambient
    // gradient reads faintly through it (design source's `navBg`:
    // oklch(0.21 0.028 228 / 0.85) dark, oklch(1 0 0 / 0.85) light).
    navBg: hexToRgba(base.bgCard, 0.85),
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