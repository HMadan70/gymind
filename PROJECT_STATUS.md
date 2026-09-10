# Gymind Project Status

_Updated: 2026-09-08_

## Current state

Gymind is an active Expo/FastAPI/PostgreSQL fitness tracker. Authentication,
onboarding/profile data, workout logging, exercise favorites/history/notes,
nutrition logging/targets/favorites, body weight, and progress summaries are
implemented. The same Expo application targets native and static web output.

**AI Coach implementation intentionally reset for manual rebuild and learning.**
The Coach tab remains in its intended navigation position but is now only a
clean placeholder. There is no Coach backend route, AI provider integration,
prompt logic, conversation storage, or OpenRouter configuration.

## Feature status

| Area | Status | Notes |
|---|---|---|
| Registration/login | Implemented | bcrypt passwords, seven-day HS256 JWT, rate-limited auth routes. |
| Session/onboarding guard | Implemented | Stored tokens are verified with the backend; incomplete profiles route to onboarding. |
| Profile/preferences | Implemented | Profile and dark/light theme preferences persist through the API. |
| Home | Implemented | Aggregates consistency, nutrition, workouts, e1RM, and body weight. |
| Workout | Implemented, polish remains | Sessions, sets, custom/shared exercises, favorites, history, notes, recent-edit window. Rest timer and secondary finish actions remain. |
| Nutrition | Implemented, upload remains | Food search/create/favorite, logs, edit/delete, daily summary, automatic/manual targets. No photo upload yet. |
| Progress | Implemented, upload remains | Weight trend/ranges, consistency, muscle groups, exercise e1RM. No progress-photo storage yet. |
| Coach | Intentionally reset | Themed placeholder only, ready for a from-zero manual rebuild. |
| Web | Functional shared export | Expo static export uses the mobile routes; desktop-specific navigation/layout still needs polish. |

## Architecture

- Frontend: Expo SDK 57, React Native, TypeScript, Expo Router, React Native Web.
- Backend: FastAPI, Pydantic, SQLAlchemy.
- Database: PostgreSQL 16 with Alembic migrations.
- Deployment: Docker Compose on a self-hosted server.
- State: screen-local React state, typed ThemeContext, AsyncStorage-backed session store.
- API: JSON REST. Protected frontend requests use the shared `authFetch` helper.

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

Alembic currently has one linear head: `9c4a1b7fe210`. The Coach reset required
no database change because no Coach-specific tables existed. Cascade changes
remain deferred until account-deletion semantics are designed and reviewed.

## Configuration

Backend/server:

- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `JWT_SECRET`
- `CORS_ORIGINS`

Frontend:

- `EXPO_PUBLIC_API_URL`

The removed `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` variables are no longer
part of the application contract.

## Next priorities

1. Rebuild Coach manually from the clean placeholder when ready.
2. Deploy behind HTTPS and formalize database backups/migrations.
3. Add frontend tests and CI validation.
4. Plan token refresh/revocation and account deletion.
5. Move native token storage to a platform-secure facility and review password
   length/enumeration hardening before public launch.
6. Finish meal/progress photo storage and upload.
7. Complete workout rest timing and finish-session polish.
8. Improve responsive desktop web navigation and layouts.

## Validation commands

```text
mobile:  npx tsc --noEmit
mobile:  npm run lint -- --max-warnings=0
mobile:  npx expo-doctor
mobile:  npx expo export --platform web
backend: python -m pytest -q
backend: python -m compileall -q app tests
backend: alembic heads
root:    docker compose config
```

See `CODEBASE_REVIEW.md` for the detailed architecture and remaining risk register.

## Latest validation

- Backend suite: 52 passed.
- Python compilation: passed.
- Alembic: one head (`9c4a1b7fe210`).
- TypeScript: passed.
- ESLint: passed with zero warnings.
- Expo Doctor: 21/21 checks passed.
- Expo web export: 17 static routes exported successfully.
- npm audit: 14 moderate transitive advisories, no high/critical advisories;
  forced incompatible downgrade suggestions were not applied.
- Docker Compose: not executable on this workstation because Docker is absent;
  validate and start the stack on the server.
