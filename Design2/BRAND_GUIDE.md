# Gymind — Brand Guide

## Name & positioning
**Gymind** — fitness tracking with a mind: workouts, nutrition, body progress, and an AI coach in one account. Tone: encouraging, direct, competent — a knowledgeable training partner, not a hype-man. Avoid exclamation-heavy or overly cute copy; state facts and progress plainly ("5-day streak", "365 lb best e1RM"), let the numbers carry the energy.

## Logo mark
A small cut-corner square (the app's signature shape) filled with the teal→gold brand gradient, containing a simple white pulse/heartbeat line (a zig-zag polyline — evokes a workout heart-rate readout without using a literal heart icon). See the mark in the Login/Register screens of `Gymind UI.dc.html`, and as standalone assets in `brand/`:
- `brand/logo-mark.png` — mark only, transparent-safe on brand gradient, 256×256.
- `brand/app-icon-1024.png` — full app-icon-ready export, 1024×1024, no transparency (App Store / Play Store spec).
- `brand/splash-screen.png` — reference splash/launch screen (dark base, ambient teal/gold glow, centered mark + wordmark + tagline), 1170×2532 (iPhone-class resolution) — use as the visual target for the native splash screen config (`app.json`'s `splash`/`expo-splash-screen`), not as a literal asset to ship (native splash assets are typically just the mark on a flat background per platform guidelines).
- Minimum size: 32px (app icon can simplify to just the mark, no wordmark, down to 24px).
- Always render on either the brand gradient fill or a solid dark/light surface — never busy photography behind it without a scrim.
- Wordmark: "Gymind" in Space Grotesk 700, sentence case, no tagline stacked under it in-product (fine in marketing/splash contexts — "Train smarter, together").

## Color
Two accent hues carried through the whole product, always on the same neutral dark/light base — never introduce a third accent hue.

| Role | Dark value | Light value | Usage |
|---|---|---|---|
| Base | oklch(0.16 0.022 228) | oklch(0.97 0.008 228) | screens |
| Surface | oklch(0.21 0.028 228) | oklch(1 0 0) | cards, sheets |
| Ink | oklch(0.96 0.008 228) | oklch(0.20 0.022 228) | primary text |
| Ink dim | oklch(0.66 0.022 228) | oklch(0.50 0.018 228) | secondary text |
| **Teal** (primary) | oklch(0.72 0.13 202) | oklch(0.50 0.12 202) | primary actions, progress, focus |
| **Gold** (secondary) | oklch(0.80 0.15 95) | oklch(0.62 0.14 95) | coach/energy accents, macro highlights |
| **Coral** (alert) | oklch(0.62 0.20 22) | oklch(0.56 0.19 22) | rest timer, destructive actions only |

Never use pure orange (hue ~40-60) or saturated "electric" blue (hue ~250-260, high chroma+lightness) — both were deliberately avoided as generic/AI-tool-coded. Teal + gold is the pairing; coral is reserved strictly for alerts/countdowns, not decoration.

## Typography
- **Space Grotesk** (600/700) — all headings, screen titles, large numerals (timers, stats, ring labels).
- **Manrope** (400-800) — everything else: body copy, labels, buttons, inputs.
- Never introduce a third family. Both load from Google Fonts.

## Shape language
The brand's one consistent geometric signature: an **asymmetric cut corner** — large radius on top-left & bottom-right, small radius on the other two corners (`30px 12px 30px 12px` for hero cards, `26px 10px 26px 10px` for secondary cards). Used on: hero cards, feature cards, the logo mark, corner accent marks. Everything tap-sized (buttons, chips, inputs, avatars, dots) stays fully rounded (pill/circle) — the cut corner marks "containers," full-round marks "things you touch." Don't apply the cut corner to bottom sheets (flat-bottom, `26px 26px 0 0`) or centered modals (uniform rounded rect).

A small rotated square ("diamond") is the recurring accent motif — appears as a corner mark on hero cards and as the active-tab indicator in the nav bar. Keep it small (9-14px) and either brand-gradient-filled or outlined, never literal/decorative beyond that.

## Iconography
No icon font/library used in the prototype — icons are minimal geometric shapes (lines, circles, simple polylines) to avoid a generic "AI slop" look. For production, adopt a single simple/geometric icon set (e.g. Lucide or Phosphor, regular weight) and restyle icons to match this restraint — no filled/glossy/3D icon styles.

## Motion principles
- Screens/tabs animate in with a soft rise-and-fade (`screenIn`: 400-450ms, translateY 14px→0, opacity 0→1, cubic-bezier(.2,.8,.2,1)).
- Sheets slide up from the bottom; modals pop from the center — never both use the same motion.
- Numeric/progress changes (rings, bars, timers) always transition smoothly (500-600ms), never jump.
- Ambient background gradients drift continuously but slowly (16-22s loops) and stay decorative — never distract from content or block touches.
- Motion should read as "confident, unhurried energy" — not bouncy/cartoonish, not clinical/instant.

## Don'ts
- Don't add a third accent color.
- Don't use left-border-accent "AI dashboard" cards.
- Don't use orange or high-chroma electric blue anywhere.
- Don't mix in a third typeface.
- Don't apply the cut-corner shape to interactive controls (buttons/inputs/chips) — reserve it for containers.
