# Gymind — Path to Published App

Everything beyond "the UI is implemented" needed to actually ship this on the App Store / Play Store, on top of `README.md` (screens/behavior) and `BRAND_GUIDE.md` (visual system).

## 1. Finish the UI implementation
- Recreate all screens in `README.md` (Login, Register, Onboarding, Home, Workout, Nutrition, Progress, Coach) in `mobile/` using the existing Expo Router + ThemeContext patterns.
- Build the backend pieces flagged as "not yet built" in the README's per-screen sections: exercise Prev/Tgt history endpoint, workout-exercise notes routes (model already exists), meal/progress photo upload + storage, `POST /coach` (scope + LLM choice still open — see PROJECT_STATUS.md Section 17).
- Wire Login/Register screens to the real `/auth/login` and `/auth/register` endpoints (JWT storage + `checkOnboarding` redirect already exist and should be reused, not rebuilt).

## 2. App identity assets
- `brand/app-icon-1024.png` → run through `npx expo-optimize` / `expo prebuild` icon pipeline, or use `app.json`'s `"icon"` field directly (Expo generates all required sizes for iOS/Android from one 1024×1024 PNG with no transparency — already satisfied).
- `brand/splash-screen.png` is a **design reference**, not a drop-in asset — configure the real splash via `expo-splash-screen` / `app.json`'s `"splash"` key using the brand's dark base color (`#131a1d`-ish, matches `oklch(0.16 0.022 228)`) and the logo mark only (native splash screens should not include animated blobs).
- Android adaptive icon: derive a simple layered version (background = brand gradient or solid dark, foreground = the pulse-mark only) per Android's adaptive-icon spec — the current 1024px icon is a single flat layer and needs splitting into `foreground`/`background` layers for `app.json`'s `android.adaptiveIcon`.
- Favicon / web icon (if `mobile-web` build target is used): export a 48×48 and 512×512 from the same mark.

## 3. Store listing assets (not yet created — need real screenshots once built)
- iOS: 6.7" and 6.5" display screenshots (at least 3, ideally all core screens), App Store preview video optional.
- Android: phone screenshots (min 2, 320-3840px), a 1024×500 feature graphic, 512×512 hi-res icon.
- Short description (≤80 chars) and full description copy — tone per `BRAND_GUIDE.md` ("Name & positioning": direct, competent, not hype-y). Suggested short description: "Track workouts, nutrition, and progress — with an AI coach."
- Keywords/category: Health & Fitness.
- Privacy policy URL — **required by both stores** since the app collects account data (email, password hash — not stored, just derived), workout/nutrition/body-weight logs, and (once built) photos. Must be a real hosted page before submission.
- Data-safety / App Privacy declarations: declare collected data types (account info, health & fitness data, user content/photos) and whether they're shared with third parties (the LLM coach endpoint, once built, counts if it sends user data to an external API — disclose accordingly).

## 4. Permissions to declare (once photo attach + coach are built)
- Camera + Photo Library (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` on iOS; `READ_MEDIA_IMAGES`/`CAMERA` on Android) for meal/progress photo attachment.
- No location, contacts, or background permissions are needed by anything currently designed — don't request more than the app uses (store review will flag unused permission requests).

## 5. Backend/production readiness (cross-referencing PROJECT_STATUS.md's own open items)
- Pin `requirements.txt` versions and create `.env.example` (currently TODO in the repo).
- Move off the home-server (ZimaOS/Docker Compose) setup to a real hosting target before public launch, or confirm the home server can handle production traffic/uptime expectations — currently a personal dev setup, fine for beta, risky for a public store listing.
- HTTPS: the app currently talks to a raw IP (`192.168.0.241:8001`) — a published app needs a real domain with TLS; app store review will reject plaintext HTTP API calls on iOS (App Transport Security) without explicit exceptions.
- Decide token expiry / refresh strategy before public launch (currently 7-day JWT, no refresh token — open question in PROJECT_STATUS.md Section 11).
- Rate limiting exists on auth routes only — consider extending to write-heavy routes (already flagged as a "TODO if abuse becomes a concern").

## 6. Build & submit
- Use EAS Build (`eas build --platform ios` / `--platform android`) — the project already targets Expo SDK 57 / Expo Router, so EAS is the natural path (no bare native project to maintain).
- Apple: needs an Apple Developer Program account ($99/yr) — note PROJECT_STATUS.md already flags that Apple sign-in specifically was deferred because of this; a full store submission needs the account regardless of sign-in.
- Google: needs a Google Play Developer account ($25 one-time) + a signed app bundle via EAS Submit.
- App version/build numbers: start at `1.0.0` / build `1`, follow semantic versioning for updates.

## 7. Legal
- Terms of Service + Privacy Policy pages (linked from Register screen's fine print if added, and from both store listings).
- If nutrition/calorie data could be read as medical/dietary advice, add a standard "not a substitute for professional medical advice" disclaimer somewhere in onboarding or settings.
