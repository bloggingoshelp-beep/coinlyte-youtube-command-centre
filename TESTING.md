# Testing Checklist

Use this checklist before pushing or deploying.

## Latest Handover QA Pass

Last full QA: May 31, 2026 (end of full session — live Vercel + automated).

Verified in this pass:
- JavaScript syntax for all frontend and API files. Python syntax for `refresh.py`. Static smoke suite. All pass.
- Auth helpers: signed cookie round trip, team code hash, wrong-code rejection.
- Live API tests against coinlyte-youtube-command-centre.vercel.app — owner login, all endpoints, session management.
- Video Ideas engine: 15 ideas, zero FOMO violations, all 6 channel pillars covered, 9.2/10 theme match score.
- Dismissed idea dedup: 0 escaped across all 3 layers (board memory → Claude prompt → frontend filter).
- Coin Stats: 0 ghost items, all 10 coins show correct narrative angles via coinNarrativeAngle() coin-knowledge map.
- Video performance: real view counts confirmed (0-views bug fixed, topVideos build working).
- Scam filter: !!TICKER!! regex in codebase — live data still has 32 slipped (from pre-fix refresh); next refresh clears them.
- Board: Supabase cloud mode, 9 pipeline cards, 3 in editing stage.
- Team: Diksha + Ankur correctly restricted to Command/Intelligence/Planner/Brands. Refresh and Analytics hidden.
- Auth security: all 7 protected endpoints return 401 unauthenticated. No secrets in frontend.

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

## Coin Stats — Narrative Angle Check

Open Channel Intelligence → Coin Stats and verify each coin card:

- Each coin card shows the coin data strip (rank, 24h%, 7d%, volume) at the top.
- Each coin card shows a "📹 Video Angle" section (violet box) with a narrative title — NOT a price prediction.
- RAIN should show prediction market / Polymarket narrative.
- HYPE should show DEX vs CEX / CFTC regulation narrative.
- TON should show Telegram 900M users ecosystem narrative.
- BNB should show Binance ecosystem / announcement narrative.
- XMR / ZEC should show privacy coins / government traceability narrative.
- Each card has "＋ Video Ideas", "＋ Planner", and "Dismiss" buttons.
- Clicking "＋ Video Ideas" adds the coin angle to Video Ideas tab (visible immediately, no page reload needed).
- Clicking "＋ Video Ideas" a second time shows "Already in Video Ideas" toast, not a duplicate.
- After adding, the button shows "✓ In Ideas" (greyed, not clickable).

## Video Ideas — Multi-Source Coverage Check

After a fresh refresh, Video Ideas must show ideas from ALL intelligence sources:

- AI-generated ideas from live-data.js (marked by signal: news_trend / competitor_gap / audience_ask etc.)
- At least 2 coin narrative ideas (from Coin Stats auto-flow, marked source: Coin Momentum)
- At least 1 market intel signal (from India Policy / US Regulation / Global Market)
- At least 1 competitor gap idea (from Coin Bureau or Cyber Scrilla)
- At least 1 community pulse idea (from Comment Themes, signal: audience_ask)
- Manually saved coin ideas (from "+ Video Ideas" button in Coin Stats) also appear
- No idea appears twice (deduplication working)

## Video Ideas Quality Check

After a fresh refresh, open Video Ideas and verify:

- Urgent section: at least 4 ideas visible. If empty, urgency definition is too narrow.
- Coin momentum ideas: at most 5 visible total (3 from AI cap + 2 auto-flow). Each explains a narrative — not "buy X" or "X will 10x".
- Tax & Compliance: at least 1 idea mentioning ITR, TDS, capital gains, or 30% tax.
- Security: at least 2 ideas about wallets, scams, or exchange safety.
- SIP or Long-Term Investing: at least 1 idea about DCA, portfolio, or bear market strategy.
- No FOMO language in any title (10X, 100X, pump, breakout, moon, buy now).
- All ideas have India angle: ₹ amounts, Hindi/English mix, CoinDCX/WazirX/India exchange names.

## Market Intel — Layout Check

Open Channel Intelligence → Market Intel and verify:

- India Policy lane: shows maximum 5 cards. If it was showing 10+ before, the cap is working.
- US Regulation lane: maximum 5 cards.
- Global Market lane: maximum 5 cards.
- Source Radar appears below the three lanes as compact chips (not full-size cards).
- Source Radar shows maximum 10 chips in a responsive multi-column grid.
- Each chip has: rank number, age, score, 2-line truncated title, micro buttons (↗ Save Planner ✕).
- Source Radar Save button saves to Saved Radar in Content Planner.
- Source Radar Planner button creates a planner card.
- Source Radar ✕ button dismisses the item with undo toast.

## Saved Coin Ideas — Persistence Check

- Add a coin angle to Video Ideas via Coin Stats "＋ Video Ideas" button.
- Reload the page. The saved coin idea should still appear in Video Ideas.
- Open Content Planner → the saved coin idea is NOT in the planner pipeline.
- Dismiss the saved coin idea from Video Ideas. It should disappear.
- The coin's "+ Video Ideas" button in Coin Stats should reflect dismissed state on next render.
