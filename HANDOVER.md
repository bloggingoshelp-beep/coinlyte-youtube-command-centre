# AI Handover Notes

Use this file before making changes with Codex, Claude, or any other AI coding tool.

## Product Goal

CoinLyte Command Centre is not a generic dashboard. It is the control room for one YouTube business. Every change should help Kirtish decide:

- What video should be made next?
- Why does this idea fit the CoinLyte audience?
- What source/research supports it?
- Who owns the next step?
- What brand/sponsor work is active?
- Is the channel healthy?

## Code Map

- `index.html`: app shell and asset loading.
- `login.html`: User ID plus access-code screen with CoinLyte logo branding.
- `assets/app.js`: main application logic and rendering.
- `assets/styles.css`: all UI styling.
- `assets/data.js`: seed/default data.
- `assets/live-data.js`: generated live data.
- `api/static.js`: private static file serving behind login.
- `api/login.js` / `api/logout.js`: owner and team access sessions. Owner login accepts User ID `Mrvyas`, `owner`, or `kirtish` by default plus the owner code. `OWNER_USER_IDS` can override the allowed owner IDs.
- `api/refresh.js`: starts GitHub Actions refresh.
- `api/refresh-status.js`: checks refresh run status.
- `api/notify.js`: optional email notification endpoint.
- `.github/workflows/refresh.yml`: refresh workflow.
- `.github/scripts/refresh.py`: pulls YouTube, analytics, RSS, comments, market intel, and AI ideas.

## Must Not Break

- Login/access-code protection.
- Refresh flow from dashboard -> Vercel API -> GitHub Actions -> refreshed `assets/live-data.js`.
- Planner cards stored in `cl_pipeline_v4`.
- Brand records stored in `cl_brands_v3`.
- Team members stored in `cl_team_members_v1`.
- Notifications stored in `cl_notifications_v1`.
- Dismissed ideas stored in `cl_dismissed_ideas_v1`.
- Dismissed Command dashboard cards stored in `cl_dismissed_command_v1`.
- Source links and research briefs when adding ideas to Planner.
- Owner login/access code must stay server-side in Vercel `OWNER_ACCESS_CODE`; do not hardcode it in frontend files.
- Supabase-backed Team Access users can log in with their User ID plus separate hashed access codes. Do not store team passwords in localStorage or frontend files.

## Design Direction

The preferred style is Claude-inspired: premium cards, strong color coding, clear emojis, fast scanning, horizontal grouped sections, and operational clarity. Avoid plain text-heavy boards.

## Before Any Major Change

1. Create a new branch.
2. Run `node --check assets/app.js`.
3. Run `npm test`.
4. Browser-test the changed screen.
5. Check the main nav and planner source links.
6. Do not merge until the app still works end to end.

## Good Future Improvements

- Supabase project setup in production Vercel environment variables.
- Granular server-side data filtering for every future app module as the app grows.
- Email provider/domain setup for production notifications.
- Export/import backup stored server-side.
- More automated browser tests.

## Reliability Features Added

- Content Planner has a full board backup/import flow.
- Brand Deals has a brand-only backup/import flow for directory and deal board records.
- Command dashboard cards, quick actions, and Owner Action Queue cards can be dismissed and restored.
- Notification Board supports open card, mark read/unread, and dismiss.
- Owner `CL` profile button opens owner settings and logout.
- Team users include an access status, app-area permissions, multiple notification channels, and optional hashed login codes. Already logged-in team users are re-validated against Supabase during sync/reload, so paused users or changed access should take effect without editing code.
- Shared board API stores planner, brand, team, notification, and dismissed-item state in Supabase when configured.
