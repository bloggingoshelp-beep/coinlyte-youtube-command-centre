# Testing Checklist

Use this checklist before pushing or deploying.

## Latest Handover QA Pass

Last full QA: May 31, 2026.

Verified in this pass:

- JavaScript syntax for the frontend and all Vercel API routes.
- Python syntax for `.github/scripts/refresh.py`.
- Static smoke suite: security, refresh, Supabase, notification, planner, saved radar, duplicate-filter, scam-filter, and Top 30 Coin Momentum guards.
- Auth helpers: signed session cookie round trip, team access-code hash verification, and wrong-code rejection.
- Browser smoke: login screen, all top-level nav areas, Channel Intelligence subtabs, Content Planner board/calendar/saved radar, planner modal structure, Brand Deals board/modal, Team Access modal, Refresh screen, and notification drawer.
- Coin Stats tab: confirmed no ghost items appear when live-data has no valid coin momentum data (change_24h null check working).
- Video performance: confirmed real view counts from topVideos rows appear in Analytics tab.
- Video Ideas: confirmed coin momentum ideas capped at 3, urgent section populates correctly, narrative-mined coin ideas show catalyst/sector context not price prediction.
- Scam filter: confirmed `!!TICKER!!` pump spam and "boring stock / threw it into" vocabulary blocked from Community Pulse.

## Automated

```bash
node --check assets/app.js
node --check api/auth.js
node --check api/board.js
node --check api/db.js
node --check api/login.js
node --check api/logout.js
node --check api/me.js
node --check api/notify.js
node --check api/refresh.js
node --check api/refresh-status.js
node --check api/static.js
node --check api/team-user.js
PYTHONPYCACHEPREFIX=/private/tmp/coinlyte-pycache python3 -m py_compile .github/scripts/refresh.py
npm test
```

## Browser Smoke Test

- Open the local app.
- Confirm Command loads first.
- Click these top nav items:
  - Command
  - Analytics
  - Channel Intelligence
  - Content Planner
  - Brand Deals
  - Team Access
  - Refresh
- Confirm no blank screen appears.

## Command

- Daily owner card is visible.
- Blocker alerts are visible.
- Daily action cards are visible.
- Buttons jump to Planner, Intelligence, Team Access, and Brand Deals.
- Dismiss buttons hide Command alerts/actions/Owner Action Queue cards and Restore brings them back.
- Owner `CL` profile button opens settings; Logout routes to the login page.

## Intelligence

- Market Intel shows India policy, US regulation, global market, and embedded Source Radar sections.
- Coin Stats is the separate top-30 coin momentum tab. It uses CoinGecko top-market-cap movers plus fresh 7-day Google News sources. Coins with null `change_24h` (old-format ghost entries) must not appear.
- Source Radar shows source-only cards inside Market Intel with source, save, add-planner, and dismiss actions.
- Saved Source Radar links appear under Content Planner -> Saved Radar and survive Sync Planner.
- Competitor Intel shows competitor videos and generated CoinLyte-fit ideas.
- Community Pulse shows comment-led video ideas before raw top comments.
- Community Pulse excludes obvious scam/reply-farm comments, including fake author names that start with `Oliv`, contact-me bait, Telegram/WhatsApp bait, phone-number spam, and `!!TICKER!!` style pump spam.
- Video Ideas is the final combined shortlist across Market Intel, Coin Stats, Competitor Intel, Community Pulse, analytics, saved radar, dismissed ideas, existing planner cards, and recent uploads.
- Video Ideas urgent section must show at least some ideas on a normal refresh — if it is empty, check that the Claude prompt urgency definition is not too narrow.
- Video Ideas coin momentum ideas: must show no more than 3 in the visible list. Each coin idea must explain the narrative/catalyst behind the price move — not raw price prediction or FOMO language.
- Video Ideas categories include: Security, India Focus, Policy, Tax & Compliance, Education, DeFi, Comparison, SIP & Investing, Passive Income, Coin Analysis, Breaking, Strategy.
- Add-to-Planner removes the idea from the loose idea list.
- Dismiss hides the idea/card.

## Planner

- Planner board shows stage columns.
- Planner board defaults to Board mode and each stage can be sorted by due date, urgency, assigned user, newest, oldest, or title.
- Default stage sorting puts nearest target deadlines first, with urgent/high priority used as tie breakers.
- Planner cards can be dragged and dropped directly into any stage column, while Back/Fwd still works for one-stage moves.
- Backup Board downloads JSON.
- Import Backup asks for confirmation before replacing local data.
- Add Video opens modal.
- Edit card opens modal.
- Category and priority are dropdowns.
- Target deadline uses a date and time picker.
- Research brief is read-only when created from intelligence.
- Editor reference source can be added with title and URL; clicking row Save converts it into a locked source row with a Source link and Edit button.
- Source buttons open in a new tab.
- Saved Radar source buttons open in a new tab.
- Moving stages creates notifications for assigned team members.
- Sync Planner pulls shared board changes without triggering the live-data refresh workflow.

## Analytics

- Analytics tab shows channel stats, geographic breakdown, device split, traffic sources.
- Video performance section shows real view counts and watch percentage for top historical videos (not all zeros).
- If view counts are all zero, the topVideos Analytics data is not mapping correctly — check `video_performance` in live-data.js.

## Brand Deals

- Brand modal opens.
- Currency and amount are aligned.
- Deal type dropdown works.
- Brand cards remain color coded by status.
- Backup Brands downloads JSON.
- Import Backup asks for confirmation before replacing brand records.
- Sync Brands pulls shared brand changes without triggering the live-data refresh workflow.

## Team Access

- Add/edit team member works.
- Multiple notification channels can be selected.
- App access checkboxes can be selected.
- Access status can be set to Active or Paused.
- Login access code can be set/reset from the modal when Supabase is configured.
- A team user can log in with their own code and sees only the app areas selected in Board Access.
- Deleting a team user removes the secure Supabase login row, not only the visible team card.
- Sync Team pulls shared users and notifications without triggering the live-data refresh workflow.
- Notification board displays stage/assignment alerts.
- Notification items can be opened, marked read/unread, and dismissed.

## Shared Data

- With `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured, Planner, Brand Deals, Team Access, notifications, and dismissed cards sync across devices.
- Topbar Sync Board refreshes shared board state only; Refresh Live Data triggers the full GitHub Actions intelligence pipeline.
- Without Supabase, the app clearly falls back to local browser storage.
- First owner login on an empty Supabase board uploads the current local board snapshot.

## Refresh

- Refresh button calls the backend on deployed Vercel.
- Status can be checked after a refresh starts.
- Missing backend configuration is shown as an error, not a blank page.
- After a successful refresh, Coin Stats shows coins with real price data (change_24h, rank, volume).
- After a successful refresh, Video Ideas shows ideas across multiple categories including Security, Tax & Compliance, SIP & Investing, and Passive Income — not only coin/market ideas.
- After a successful refresh, Community Pulse comment themes show topic names (not blank labels).

## Scam Filter Verification

These comment patterns must NOT appear in the Community Pulse feed after a refresh:

- Any comment containing `!!WORD!!` (double exclamation ticker spam)
- Any comment containing "threw it into", "boring stock profit", or "stock profit"
- Any comment from an author whose name starts with `Oliv`
- Any comment containing WhatsApp, Telegram, or phone number bait
- Any comment with "guaranteed profit" or "contact me"

## Video Ideas Quality Check

After a fresh refresh, open Video Ideas and verify:

- Urgent section: at least 2-4 ideas visible. If empty, urgency definition is too narrow.
- Coin momentum ideas: at most 3 visible. Each must explain a narrative or sector story — not "buy X" or "X will 10x".
- Tax & Compliance: at least 1 idea mentioning ITR, TDS, capital gains, or 30% tax.
- Security: at least 2 ideas about wallets, scams, or exchange safety.
- No FOMO language in any title (10X, 100X, pump, breakout, moon, buy now).
