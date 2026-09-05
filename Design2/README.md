# Handoff: Gymind Mobile UI Migration

## Overview
A full visual redesign of the Gymind mobile app (React Native / Expo), replacing the old "5c" temp UI. Covers Onboarding, Home, Workout logging, Nutrition, Progress, and a new AI Coach chat screen. Also specs several features that are designed but **not yet built** on the backend/frontend, so they can be implemented alongside the visual migration.

## About the Design Files
`Gymind UI.dc.html` is a **design reference built in HTML** (a single-file interactive prototype), not production code. It is not React Native and must not be copied in verbatim. Your task is to **recreate this design inside the existing `mobile/` Expo (React Native + Expo Router) codebase**, using its existing patterns: `ThemeContext`/`theme.ts` for tokens, the existing 6-tab Expo Router navigation skeleton, and existing API calls in the routes noted below. Open the HTML file in a browser to interact with it — every screen, transition, and modal is live and clickable.

## Fidelity
**High-fidelity.** Colors, type, spacing, corner-radius language, and animation timings in the HTML are final — recreate them pixel-for-pixel using React Native's `StyleSheet`/Reanimated equivalents, not just "inspired by."

## Design Language / System
- **Type**: Space Grotesk (headings/numerals, 600–700 weight) + Manrope (body/UI, 400–800 weight). Both on Google Fonts.
- **Shape language**: most large cards use an asymmetric "cut corner" radius — `30px 12px 30px 12px` (hero cards) or `26px 10px 26px 10px` (secondary cards) — large radius on top-left/bottom-right, small on the other two corners. This is the app's signature shape; buttons/chips/inputs/avatars stay fully rounded (pill/circle) for contrast. Bottom sheets use `26px 26px 0 0` (flat bottom).
- **Motion**: screen/tab switches animate with a `screenIn` keyframe (opacity 0→1, translateY 14px→0, scale .985→1, 400-450ms, cubic-bezier(.2,.8,.2,1)) — trigger by remounting/keying the screen container. Bottom sheets slide up (`sheetUp`, translateY 100%→0, 300ms same easing). Centered modals pop in (`popIn`, scale .85→1 + fade, 300ms). Tab-bar active indicator (a small rotated diamond) slides between tabs with a 350ms transition on `left`. Progress rings/bars animate via CSS `transition` on `stroke-dashoffset`/`width` (500-600ms ease) whenever their underlying value changes — implement with Reanimated's `withTiming`.
- **Ambient background**: 3 large blurred conic/radial gradient blobs drift slowly (16-22s loops, translate+rotate+scale) behind all content — decorative, low opacity (0.35-0.55), never intercepts touches.

## Design Tokens (dark theme — see file for light-mode equivalents, same hues/shape just remapped lightness)
| Token | Value | Use |
|---|---|---|
| bg | oklch(0.16 0.022 228) | screen background |
| card | oklch(0.21 0.028 228) | card/sheet surfaces |
| cardAlt | oklch(0.26 0.032 228) | recessed surfaces (progress track, input bg) |
| border | oklch(0.33 0.038 228) | 1px card/input borders |
| text | oklch(0.96 0.008 228) | primary text |
| textDim | oklch(0.66 0.022 228) | secondary/meta text |
| primary (teal) | oklch(0.72 0.13 202) | primary actions, active states, calorie/e1RM rings |
| secondary (gold) | oklch(0.80 0.15 95) | coach gradient, macro/notes accents |
| danger/rest (coral) | oklch(0.62 0.20 22) | rest timer ring, destructive actions |
| onPrimary | oklch(0.16 0.03 202) | text on primary-filled buttons |

Light mode keeps identical hues (202 teal, 95 gold, 22 coral, 228 neutral) at inverted lightness — see `DARK`/`LIGHT` objects in the file's script for exact values.

Both dark and light themes must be supported via a runtime toggle (already the pattern in `ThemeContext.tsx` — extend rather than replace it; the accent-preset system in the backend/`theme.ts` should either be retired in favor of this single-accent design or kept only for the still-open "accent preset" backend field, product decision needed).

## Branding
See `BRAND_GUIDE.md` in this folder for the full brand system (logo mark, color tokens, type, shape language, motion principles, do's/don'ts) — read it alongside this README before implementing any screen.

## Screens

### 0. Login / Register
Shared auth shell: brand mark (cut-corner square, gradient fill, pulse-line icon) top-left, then the form. **Login**: email-or-username field, password field, "Forgot?" link on its own row below the password field (intentional, matches an existing deviation already decided in PROJECT_STATUS.md), primary "Log in" button, an "OR" divider, inert/visual-only Apple and Google buttons (no OAuth wired — same intentional deviation as the current app), and a "New here? Create account" link. **Register**: username, email, password (with an animated 4-segment strength meter — red/gold/teal fill by score), confirm password, primary "Create account" button, and a "Already have an account? Log in" link. Both submit straight to Onboarding in the prototype (no real validation) — wire to `POST /auth/login` and `POST /auth/register` respectively, keeping the app's existing JWT-storage and `checkOnboarding` redirect logic (`GET /users/onboarding-check`).

### 1. Onboarding (5-step wizard)
Steps: Goal (single-select cards: Lose weight / Build muscle / Maintain / Improve endurance) → Experience level (Beginner/Intermediate/Advanced cards) → Injuries (free-text textarea, optional) → Equipment (multi-select chips) → Dietary restrictions (multi-select chips). Top bar: back arrow + animated progress bar (width = step/5) + step label. Bottom: full-width Continue button, disabled (grey) until the step's required field is set; label changes to "Let's go" on the last step. Maps to `POST /users/profile` (`goal`, `experience_level`, `injuries`, `equipment[]`, `dietary_restrictions[]`).

### 2. Home
Greeting + theme toggle (sun/moon dot) in header. Streak pill (pulsing dot + "5-day streak" — **not yet wired to any backend streak field; needs a `consistency`-derived calculation or a new field**). Coach teaser card (gradient teal→gold, diamond corner mark, tappable → Coach tab). Nutrition ring card (mini calorie ring + summary, tappable → Nutrition tab). Workout CTA card (cut-corner, diamond outline mark, changes copy/button between "Start" and "Resume" depending on session state, tappable → Workout tab, auto-starts if idle). Two stat cards: Best e1RM (has an animated shimmer sweep — decorative, purely CSS/Reanimated) and current body weight.

### 3. Workout logging
Session header card: three states — **NOT STARTED / SESSION LIVE / SESSION PAUSED** — driving a live MM:SS timer and Start/Pause/Resume buttons; "Finish" text button appears only when live, opens a confirm modal. Three stat cards (Volume, Sets done/total, Best e1RM) computed live from entered sets. Exercise list: collapsible cards, status dot + label (QUEUED/IN PROGRESS/COMPLETED) based on whether any/all sets are marked done. Expanded card shows a set table: set #, **Prev** (last session's weight×reps, shows "—" if none), editable Weight/Reps inputs, **Tgt** (suggested target), and a checkb" done toggle. Marking a set done opens the **rest timer** (radial countdown, default 90s, +15s / Skip buttons, auto-dismisses at 0). Each exercise has a "+ Add note" button opening a bottom sheet with a free-text note field. "+ Add exercise" opens a bottom-sheet picker (search + list, grouped visually by muscle group tag) to add a new exercise card. Finishing opens a summary modal (duration, volume, sets) before resetting to idle.

Maps to: `POST/GET/PUT/DELETE /workouts`, `POST /workouts/{id}/sets`, `GET /exercises`, `POST /exercises`. **Not yet built on backend, designed here**: per-set Prev/Tgt data source (needs an endpoint returning the last session's sets for a given exercise, e.g. extend `ExerciseHistoryOut`/`/exercises/{id}/history` which the schema already stubs), rest timer (pure frontend), per-exercise notes (`WorkoutExerciseNote` model/schema already exist — needs routes: `POST/GET /workouts/{id}/exercises/{exercise_id}/note`), finish-session summary (frontend aggregation only).

### 4. Nutrition
Large calorie ring (consumed/target, animated stroke) + 3 macro bars (protein/carbs/fat, target vs consumed). "+ Log food" opens a bottom sheet: search list of foods → tap to select → quantity stepper (±10g) → computed calorie estimate → "Add to log". "Attach photo" button opens a modal with a dashed placeholder / "tap to add" camera icon that, once tapped, shows a **placeholder photo preview** (striped pattern, labeled "sample photo") — this whole flow is UI-only; real photo capture/upload is not built. Meal log list: each row has a small placeholder thumbnail, food name, qty + calories, and a remove (×) button. Empty state (illustration placeholder + copy) when no logs exist.

Maps to: `POST/GET /foods`, `POST/GET/PUT/DELETE /nutrition`, `GET/PUT /nutrition/targets`. **Not yet built, designed here**: photo attachment for meals (needs a `photo_url` column on `nutrition_logs` + file upload endpoint/storage), empty-state and loading/error states (frontend only).

### 5. Progress
Overview: consistency ring ("X/Y days trained"), body-weight line chart (SVG polyline) + "+ Log" opening a small modal (weight input + lb/kg toggle), a horizontal "Progress photos" strip (placeholder thumbnails + "+" add tile — same photo-upload caveat as Nutrition, needs its own storage/endpoint, likely tied to `body_weight_logs` or a new `progress_photos` table), and a 2-column grid of muscle-group tiles (best e1RM per group, "—" if no data). Tapping a tile drills into a detail view: back button + group name + an e1RM trend line chart, or an empty-state message if no sets logged for that group yet.

Maps to: `GET /progress/body-weight`, `GET /progress/e1rm?exercise_id=`, `GET /progress/muscle-groups`, `GET /progress/consistency`, `POST /body-weight`.

### 6. Coach (AI chat)
Message thread (right-aligned filled bubbles for the user, left-aligned card bubbles for the coach), animated 3-dot typing indicator while "thinking", a horizontally-scrollable row of quick-prompt chips above the input bar, and a pill-shaped input + send button. **Not built on backend at all** (per PROJECT_STATUS.md Phase 4) — this screen is UI-only with canned mock replies; needs `POST /coach` wired to an LLM once scope is decided.

## Navigation
Custom floating bottom tab bar (5 tabs: Home/Train/Food/Progress/Coach), cut-corner rounded rect, translucent/blurred background, with a small glowing rotated-diamond indicator (not a sliding pill) that animates its `left` position under the active tab's icon.

## State Management
Mirrors the HTML's `Component` state 1:1 as a starting point for React state/hooks — theme, phase (onboarding vs main app), onboarding step + answers, active tab, workout session status + timer + exercise/set data + rest-timer countdown, nutrition logs + add-food flow, progress view (overview vs a selected muscle group) + body-weight log, chat messages + typing flag. Replace all mock arrays (`EXERCISE_CATALOG`, `FOOD_CATALOG`, `MUSCLE_GROUP_DATA`, seeded exercises/logs) with real API calls to the endpoints listed per screen above.

## Assets
No image assets — all "photos" in the design are CSS striped placeholders, explicitly marked as stand-ins for a future real upload feature. Icons are hand-drawn simple SVG/CSS shapes (no icon library used) — the dev team should pick a proper icon set (e.g. Lucide/Phosphor) for production, keeping the same simple/geometric feel.

## Files
- `Gymind UI.dc.html` — the full interactive prototype (open directly in any browser), now including Login/Register.
- `BRAND_GUIDE.md` — full brand system reference.
- `brand/logo-mark.png`, `brand/app-icon-1024.png`, `brand/splash-screen.png` — exported logo/icon/splash assets, ready to drop into the Expo app (`app.json` icon/splash config).
- `PUBLISHING_CHECKLIST.md` — everything beyond implementation needed to actually ship this to the App Store / Play Store (store assets, permissions, legal, backend production-readiness, build/submit steps).
