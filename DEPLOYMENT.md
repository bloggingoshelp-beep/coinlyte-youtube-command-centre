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

Important storage note:

- Live intelligence data is refreshed into files in this repo.
- Planner cards, brand records, dismissed ideas, team members, and notifications currently live in browser local storage.
- Team Access user IDs do not create separate production login codes yet. Team members can only log in with the owner access code until real server-side team auth is built.
- Before large UI changes, export the board from Content Planner or create a backup branch.
