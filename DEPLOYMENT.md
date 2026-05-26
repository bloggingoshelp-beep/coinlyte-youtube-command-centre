# CoinLyte Command Centre Deployment

This app is ready for Vercel as a private owner dashboard. Public requests are routed through `api/static.js`, which serves dashboard files only after a signed owner session cookie is present.

Read `HANDOVER.md` before changing production setup. This file is the quick deployment reference; `HANDOVER.md` is the full operating manual.

Required Vercel environment variables:

- `OWNER_ACCESS_CODE`: the owner access code. On the login screen use User ID `Mrvyas`, `owner`, or `kirtish` plus this code.
- `OWNER_USER_IDS` optional: comma-separated owner login IDs if you want to customize them, for example `Mrvyas,owner`.
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

Do not store secret values in code, screenshots, docs, frontend JavaScript, or Git history.

Required GitHub Actions secrets:

- `YT_API_KEY`
- `YT_CLIENT_ID`
- `YT_CLIENT_SECRET`
- `YT_REFRESH_TOKEN`
- `ANTHROPIC_API_KEY`
- `GH_PAT`
- `VERCEL_DEPLOY_HOOK`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The Supabase secrets are needed in GitHub Actions too, not only Vercel. The refresh script reads shared board memory from Supabase before asking Claude for new video ideas, so planned, saved, dismissed, or recently published topics do not keep returning after refresh.

Refresh flow:

1. The dashboard calls `/api/refresh`.
2. The Vercel function triggers the GitHub Actions workflow.
3. The workflow runs `.github/scripts/refresh.py`.
4. The script pulls YouTube, analytics, comments, competitor RSS, market RSS, Supabase board memory, and Claude-generated ideas.
5. The workflow commits `assets/live-data.js` and `assets/refresh-status.json`.
6. The deploy hook publishes the refreshed dashboard.

This is the expensive/full intelligence refresh. Use it when you want fresh YouTube, comment, competitor, market, and AI-generated insight.

Board sync flow:

1. The dashboard calls `/api/board`.
2. Vercel reads/writes Supabase `app_state`.
3. Sync Board, Sync Planner, Sync Brands, and Sync Team only refresh shared operating data.
4. These board sync actions do not trigger GitHub Actions, YouTube API calls, RSS fetches, or Claude idea generation.

Use board sync when a planner card, saved radar link, brand record, team user, notification, or dismissed item changed and another device/user needs the latest shared state.

Important storage note:

- Live intelligence data is refreshed into files in this repo.
- Shared operating data lives in Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
- Run `supabase/schema.sql` in the Supabase SQL editor before enabling shared mode.
- If "Automatically expose new tables" is disabled in Supabase, keep the explicit `grant ... to service_role` lines in the schema. The app only uses the service role from Vercel API routes.
- Planner cards, saved radar links, brand records, team members, notifications, and dismissed items sync through `/api/board`.
- Team users get separate User IDs plus login codes through `/api/team-user`; codes are hashed before storage and cannot be viewed later. Use Team Access -> Check Login Users to confirm a member shows `Login ready` before sharing their code.
- If a team user is paused or their board access changes, `/api/me` and `/api/board` re-check Supabase on sync/reload so the old browser session does not keep stale permissions.
- If Supabase is not configured, the app falls back to browser local storage.
- Before large UI changes, export the board from Content Planner or create a backup branch.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Vercel.
4. Redeploy Vercel.
5. Login as owner and use Sync Board once to seed shared board state.

The frontend must never receive the Supabase service-role key.

## Email Setup

1. Verify the sending domain or sender in Resend.
2. Add `RESEND_API_KEY` to Vercel.
3. Add `NOTIFY_FROM` to Vercel using a verified sender, for example `CoinLyte Command <notification@coinlyte.com>`.
4. Redeploy Vercel.
5. In Team Access, give a member an email address and select the Email notification channel.
6. Assign a planner card to that member, move the card to another stage, and check Resend logs.

In-app notifications work even when email is not configured.
