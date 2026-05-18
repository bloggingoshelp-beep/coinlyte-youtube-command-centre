# Testing Checklist

Use this checklist before pushing or deploying.

## Automated

```bash
node --check assets/app.js
node --check api/refresh.js
node --check api/refresh-status.js
node --check api/notify.js
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
- Dismiss buttons hide Command alerts/actions and Restore brings them back.
- Owner `CL` profile button opens settings; Logout routes to the login page.

## Intelligence

- Market Intel shows India policy, US regulation, and global market sections.
- Competitor Intel shows competitor videos and generated CoinLyte-fit ideas.
- Community Pulse shows comment-led video ideas before raw top comments.
- Add-to-Planner removes the idea from the loose idea list.
- Dismiss hides the idea/card.

## Planner

- Planner board shows stage columns.
- Backup Board downloads JSON.
- Import Backup asks for confirmation before replacing local data.
- Add Video opens modal.
- Edit card opens modal.
- Category and priority are dropdowns.
- Target date uses date picker.
- Research brief is read-only when created from intelligence.
- Editor reference source can be added with title and URL.
- Source buttons open in a new tab.
- Moving stages creates notifications for assigned team members.

## Brand Deals

- Brand modal opens.
- Currency and amount are aligned.
- Deal type dropdown works.
- Brand cards remain color coded by status.
- Backup Brands downloads JSON.
- Import Backup asks for confirmation before replacing brand records.

## Team Access

- Add/edit team member works.
- Multiple notification channels can be selected.
- App access checkboxes can be selected.
- Access status can be set to Active or Paused.
- Notification board displays stage/assignment alerts.
- Notification items can be opened, marked read/unread, and dismissed.

## Refresh

- Refresh button calls the backend on deployed Vercel.
- Status can be checked after a refresh starts.
- Missing backend configuration is shown as an error, not a blank page.
