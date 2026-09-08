# Gymind — Path to Published App

Everything beyond "the UI is implemented" needed to actually ship this on the App Store / Play Store, on top of `README.md` (screens/behavior) and `BRAND_GUIDE.md` (visual system).

## 1. Finish the UI implementation
- Treat the current Expo application as the runtime source of truth and this directory as visual reference material.
- Complete the remaining product work documented in the root `PROJECT_STATUS.md`, including meal/progress photo storage and workout-session polish.
- Rebuild AI Coach separately and incrementally; the current Coach tab is intentionally a placeholder with no backend or provider integration.

## 2. App identity assets
- `brand/app-icon-1024.png` → run through `npx expo-optimize` / `expo prebuild` icon pipeline, or use `app.json`'s `"icon"` field directly (Expo generates all required sizes for iOS/Android from one 1024×1024 PNG with no transparency — already satisfied).
- `brand/splash-screen.png` is a **design reference**, not a drop-in asset — configure the real splash via `expo-splash-screen` / `app.json`'s `"splash"` key using the brand's dark base color (`#131a1d`-ish, matches `oklch(0.16 0.022 228)`) and the logo mark only (native splash screens should not include animated blobs).
- Android adaptive icon: derive a simple layered version (background = brand gradient or solid dark, foreground = the pulse-mark only) per Android's adaptive-icon spec — the current 1024px icon is a single flat layer and needs splitting into `foreground`/`background` layers for `app.json`'s `android.adaptiveIcon`.
- Favicon / web icon (if `mobile-web` build target is used): export a 48×48 and 512×512 from the same mark.

## 3. Store listing assets (not yet created — need real screenshots once built)
- iOS: 6.7" and 6.5" display screenshots (at least 3, ideally all core screens), App Store preview video optional.
- Android: phone screenshots (min 2, 320-3840px), a 1024×500 feature graphic, 512×512 hi-res icon.
- Short description (≤80 chars) and full description copy — tone per `BRAND_GUIDE.md` ("Name & positioning": direct, competent, not hype-y). Do not advertise AI Coach until the rebuilt feature is production-ready.
- Keywords/category: Health & Fitness.
- Privacy policy URL — **required by both stores** since the app collects account data (email, password hash — not stored, just derived), workout/nutrition/body-weight logs, and (once built) photos. Must be a real hosted page before submission.
- Data-safety / App Privacy declarations: declare collected data types (account info, health and fitness data, and future user content/photos) and any third-party sharing. Reassess these declarations before enabling a future AI provider.

## 4. Permissions to declare (once photo attachment is built)
- Camera + Photo Library (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` on iOS; `READ_MEDIA_IMAGES`/`CAMERA` on Android) for meal/progress photo attachment.
- No location, contacts, or background permissions are needed by anything currently designed — don't request more than the app uses (store review will flag unused permission requests).

## 5. Backend/production readiness
- Keep Python and JavaScript dependencies pinned and review compatible security updates regularly.
- Verify that the selected self-hosted environment meets public-launch uptime, monitoring, backup, and recovery requirements.
- Serve the API through a stable domain with TLS; do not ship a production client configured for plaintext HTTP.
- Decide token refresh and revocation behavior before public launch (the current access token expires after seven days and has no refresh token).
- Rate limiting currently protects authentication routes; extend it to write-heavy routes if the public traffic and abuse model require it.

## 6. Build & submit
- Use EAS Build (`eas build --platform ios` / `--platform android`) — the project already targets Expo SDK 57 / Expo Router, so EAS is the natural path (no bare native project to maintain).
- Apple: needs an Apple Developer Program account ($99/yr) — note PROJECT_STATUS.md already flags that Apple sign-in specifically was deferred because of this; a full store submission needs the account regardless of sign-in.
- Google: needs a Google Play Developer account ($25 one-time) + a signed app bundle via EAS Submit.
- App version/build numbers: start at `1.0.0` / build `1`, follow semantic versioning for updates.

## 7. Legal
- Terms of Service + Privacy Policy pages (linked from Register screen's fine print if added, and from both store listings).
- If nutrition/calorie data could be read as medical/dietary advice, add a standard "not a substitute for professional medical advice" disclaimer somewhere in onboarding or settings.
