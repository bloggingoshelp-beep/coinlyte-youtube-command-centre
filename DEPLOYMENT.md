# CoinLyte Command Centre Deployment

This app is ready for Vercel as a private owner dashboard. Public requests are routed through `api/static.js`, which serves dashboard files only after a signed owner session cookie is present.

Required Vercel environment variables:

- `OWNER_ACCESS_CODE`: the access code you type on the login screen.
- `AUTH_COOKIE_SECRET`: a long random string for signing the private session cookie.
- `GH_PAT`: GitHub token with workflow dispatch access.
- `GH_OWNER`: GitHub owner, for example `bloggingoshelp-beep`.
- `GH_REPO`: repository name for this command centre, for example `coinlyte-youtube-command-centre`.
- `GH_WORKFLOW`: optional, defaults to `refresh.yml`.
- `GH_REF`: optional, defaults to `main`.
- `SUPABASE_URL`: Supabase project URL for shared board storage and team login.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key, used only by Vercel API routes. Never expose it in frontend files.
- `RESEND_API_KEY`: optional, enables email notifications.
- `NOTIFY_FROM`: optional email sender, for example `CoinLyte Command <notify@yourdomain.com>`.

Required GitHub Actions secrets:

- `YT_API_KEY`
- `YT_CLIENT_ID`
- `YT_CLIENT_SECRET`
- `YT_REFRESH_TOKEN`
- `ANTHROPIC_API_KEY`
- `GH_PAT`
- `VERCEL_DEPLOY_HOOK`

Refresh flow:

1. The dashboard calls `/api/refresh`.
2. The Vercel function triggers the GitHub Actions workflow.
3. The workflow runs `.github/scripts/refresh.py`.
4. The script pulls YouTube, analytics, comments, competitor RSS, market RSS, and Claude-generated ideas.
5. The workflow commits `assets/live-data.js` and `assets/refresh-status.json`.
6. The deploy hook publishes the refreshed dashboard.

Board sync flow:

1. The dashboard calls `/api/board`.
2. Vercel reads/writes Supabase `app_state`.
3. Sync Board, Sync Planner, Sync Brands, and Sync Team only refresh shared operating data.
4. These board sync actions do not trigger GitHub Actions, YouTube API calls, RSS fetches, or Claude idea generation.

Important storage note:

- Live intelligence data is refreshed into files in this repo.
- Shared operating data lives in Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
- Run `supabase/schema.sql` in the Supabase SQL editor before enabling shared mode.
- If "Automatically expose new tables" is disabled in Supabase, keep the explicit `grant ... to service_role` lines in the schema. The app only uses the service role from Vercel API routes.
- Planner cards, brand records, team members, notifications, and dismissed items sync through `/api/board`.
- Team users get separate login codes through `/api/team-user`; codes are hashed before storage and cannot be viewed later.
- If Supabase is not configured, the app falls back to browser local storage.
- Before large UI changes, export the board from Content Planner or create a backup branch.
