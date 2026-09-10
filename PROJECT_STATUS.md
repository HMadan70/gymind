# Gymind Project Status

_Updated: 2026-09-09_

## Current state

Gymind is an active Expo/FastAPI/PostgreSQL fitness tracker. Authentication,
onboarding/profile data, workout logging, exercise favorites/history/notes,
nutrition logging/targets/favorites, body weight, and progress summaries are
implemented. The Expo application targets iOS and Android only; the web
target was removed.

The AI Coach has been rebuilt. `POST /coach` assembles a system prompt from
the caller's own profile, training consistency, best Epley e1RM per exercise,
body-weight trend and nutrition targets, then calls an OpenRouter-hosted
model; conversations and messages persist in `coach_conversations` and
`coach_messages`. The Coach tab is a working chat screen.

## Feature status

| Area | Status | Notes |
|---|---|---|
| Registration/login | Implemented | bcrypt passwords, seven-day HS256 JWT, rate-limited auth routes. |
| Session/onboarding guard | Implemented | Stored tokens are verified with the backend; incomplete profiles route to onboarding. |
| Profile/preferences | Implemented | Profile and dark/light theme preferences persist through the API. |
| Home | Implemented | Aggregates consistency, nutrition, workouts, e1RM, and body weight. |
| Workout | Implemented, polish remains | Sessions, sets, custom/shared exercises, favorites, history, notes, recent-edit window. Rest timer and secondary finish actions remain. |
| Nutrition | Implemented | Food search/create/favorite, logs, edit/delete, daily summary, automatic/manual targets, basic meal-photo attach/view/delete per log. No AI-based macro estimation from a photo - explicitly deferred, out of scope. |
| Progress | Implemented | Weight trend/ranges, consistency, muscle groups, exercise e1RM, aggregate `GET /progress`, basic progress-photo gallery (upload/list/delete). No AI-based body-composition analysis from a photo - explicitly deferred, out of scope. |
| Coach | Implemented | `POST /coach` with data-grounded prompts, conversation storage, and a chat UI. Requires `OPENROUTER_API_KEY`; returns 503 when unset. |
| Web | Removed | **Scope change:** Gymind is mobile-only (iOS/Android). The web target, `react-native-web` and `react-dom` were removed; there is no longer a browser build. The previous row read "Functional shared export — Expo static export uses the mobile routes; desktop-specific navigation/layout still needs polish." Screens themselves were not changed. |

## Architecture

- Frontend: Expo SDK 57, React Native, TypeScript, Expo Router. Mobile-only -
  `app.json` declares `"platforms": ["ios", "android"]`, so a web build is
  refused rather than silently attempted.
- Backend: FastAPI, Pydantic, SQLAlchemy.
- Database: PostgreSQL 16 with Alembic migrations.
- Deployment: Docker Compose on a self-hosted server.
- State: screen-local React state, typed ThemeContext, AsyncStorage-backed session store.
- API: JSON REST. Protected frontend requests use the shared `authFetch` helper.

## Design system

Brand 2.0 lives in `Design2/`, not `Design/`. There is no `DESIGN_SYSTEM.md`
and no `theme.json` anywhere in the repo; anything referring to those is out
of date. The two sources that do exist are:

- `Design2/BRAND_GUIDE.md` — the written spec (color, typography, shape
  language, motion), alongside `Design2/Gymind UI.dc.html` and `Design2/brand/`.
- `mobile/src/constants/theme.ts` — the runtime tokens transcribed from that
  guide, consumed through `ThemeContext`. Screens read tokens from the
  context rather than hardcoding values.

Palette is two brand hues (teal, gold) plus coral for alerts only; type is
Space Grotesk for headings and Manrope for body, with no third family.
Icons are Lucide (`lucide-react-native`), per `BRAND_GUIDE.md`'s
Iconography section - stroke-only by construction, so there's no
fill/duotone/bold weight to reach for later and break the guide's "no
filled/glossy/3D" rule the way Phosphor's weight prop would allow.

## Security and quality state

- User-owned queries enforce authenticated ownership.
- Shared/private food and exercise visibility is checked on indirect ID routes.
- Authentication endpoints are rate limited.
- Secrets stay in ignored environment files; examples contain placeholders only.
- `JWT_SECRET` is required at backend startup.
- CORS is environment-configurable.
- Database health failures return a generic 503 rather than internal exceptions.
- Request schemas bound text and numeric fitness/nutrition inputs.
- Production Docker no longer uses source reload or a source bind mount;
  PostgreSQL is loopback-only and has a startup health check.
- Mobile builds require `EXPO_PUBLIC_API_URL`; no private server address is
  embedded as a client fallback.
- Full mobile TypeScript and ESLint validation pass.

## Database and migrations

Current model groups:

- users, profiles, preferences
- workouts, sets, workout exercise notes
- shared/private exercises and user favorites
- shared/private foods, food favorites, nutrition logs and targets
- body-weight logs
- coach conversations and messages
- progress photos; a nullable photo_filename column on nutrition_logs

Alembic currently has one linear head: `c8f3a9d2e6b1`, which adds photo
storage on top of `b4d21c0a7e15`'s two Coach tables. progress_photos
cascades from its user, same as the Coach tables; cascade changes to the
older tables remain deferred until account-deletion semantics are designed
and reviewed.

## Test database

Production (`gymind`, real users and real food data) and the backend test
suite's database (`gymind_test`) are two separate Postgres databases on the
same server instance - not two containers, since Postgres databases are
already fully isolated from each other (no cross-database queries without
`dblink`), so a second container would only double resource usage without
adding isolation. `db-init/001-create-test-db.sh` creates `gymind_test`
alongside `gymind` on a fresh volume, so the separation survives a rebuild
rather than depending on someone re-creating it by hand, the way it
originally came to exist. `backend/conftest.py` swaps to it automatically -
every test run already targets `gymind_test`, never production - and
`Base.metadata.create_all()`/`drop_all()` per test means it starts and ends
each run with no tables at all; no production data is ever copied into it.

Both databases stay behind the production Postgres container's loopback-only
bind (`127.0.0.1:5433`, see `docker-compose.yml`). Running the suite from a
workstation therefore needs a tunnel, opened on demand rather than kept
running between sessions:

```text
ssh -L 5433:localhost:5433 <server>
# then, in another terminal, from backend/:
DATABASE_URL=postgresql+psycopg://<user>:<password>@localhost:5433/gymind python -m pytest -q
```

## Photo storage

Meal photos (one per nutrition log, optional) and progress photos (a
standalone timeline on the Progress tab) are stored on local disk under
`UPLOAD_DIR` - not object storage, since this app is self-hosted with no
cloud storage account configured anywhere in the stack. Files live in a
Docker named volume (`gymind_uploads`, alongside `gymind_pgdata`) so they
survive a container rebuild.

Retrieval is authenticated per-row (`GET /nutrition/{id}/photo`,
`GET /progress-photos/{id}/photo`), not a public static-file mount -
matching how every other resource in this app is authorized, rather than
making photo URLs guessable-public.

Deliberately out of scope, and not started: AI-based macro estimation from
a meal photo, or body-composition analysis from a progress photo. Nothing
in `backend/app/storage.py` inspects pixel content.

## Configuration

Backend/server:

- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `OPENROUTER_API_KEY` (Coach; unset disables `POST /coach` with a 503)
- `OPENROUTER_MODEL` (Coach; defaults to `anthropic/claude-sonnet-4.5`)
- `COACH_RATE_LIMIT_REQUESTS`, `COACH_RATE_LIMIT_WINDOW_SECONDS` (Coach;
  default 10 requests / 60s per authenticated user - see
  `backend/app/coach_rate_limit.py`)
- `UPLOAD_DIR` (photos; defaults to `backend/uploads/`, gitignored - see
  Photo storage below)

Frontend:

- `EXPO_PUBLIC_API_URL`

## Next priorities

1. Coach follow-ups: conversation history UI (the list/detail/delete routes
   exist but no screen consumes them) and streaming replies. Per-user rate
   limiting is done (below).
2. Deploy behind HTTPS and formalize database backups/migrations.
3. Backend CI is done (`.github/workflows/backend-tests.yml`). Frontend has
   no automated test suite yet - validation is tsc/ESLint/expo-doctor/native
   export only, run locally, not in CI.
4. Plan token refresh/revocation and account deletion.
5. Move native token storage to a platform-secure facility and review password
   length/enumeration hardening before public launch.
6. (Done) Basic meal/progress photo storage and upload. AI-based macro
   estimation or body-composition analysis from a photo remains explicitly
   deferred and out of scope - nothing here inspects pixel content.
7. Complete workout rest timing and finish-session polish.
8. (Removed) Responsive desktop web navigation and layouts - no longer
   applicable now that the web target is gone.

## Validation commands

```text
mobile:  npx tsc --noEmit
mobile:  npm run lint -- --max-warnings=0
mobile:  npx expo-doctor
mobile:  npx expo export --platform android
backend: python -m pytest -q
backend: python -m compileall -q app tests
backend: alembic heads
root:    docker compose config
```

## Latest validation

- Backend suite: 84 passed (through the on-demand SSH tunnel, against
  `gymind_test` - see Test database above).
- Python compilation: passed.
- Alembic: one head (`c8f3a9d2e6b1`).
- TypeScript: passed.
- ESLint: passed with zero warnings.
- Expo Doctor: 20/21 checks passed. The one failure is pre-existing patch
  drift unrelated to the web removal (`expo` 57.0.20 vs `~57.0.21`,
  `expo-router` 57.0.19 vs `~57.0.20`); no dependency upgrade was applied.
- Expo native export: Android bundle built successfully.
- Expo web export: no longer applicable - refused by the `platforms` array.
- npm audit: 14 moderate transitive advisories, no high/critical advisories;
  forced incompatible downgrade suggestions were not applied.
- Docker Compose: not executable on this workstation because Docker is absent;
  validate and start the stack on the server.
