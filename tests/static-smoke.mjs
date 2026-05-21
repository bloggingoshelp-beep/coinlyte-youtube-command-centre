import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = {
  html: await readFile(new URL("index.html", root), "utf8"),
  loginPage: await readFile(new URL("login.html", root), "utf8"),
  data: await readFile(new URL("assets/data.js", root), "utf8"),
  app: await readFile(new URL("assets/app.js", root), "utf8"),
  refresh: await readFile(new URL("api/refresh.js", root), "utf8"),
  status: await readFile(new URL("api/refresh-status.js", root), "utf8"),
  login: await readFile(new URL("api/login.js", root), "utf8"),
  auth: await readFile(new URL("api/auth.js", root), "utf8"),
  me: await readFile(new URL("api/me.js", root), "utf8"),
  board: await readFile(new URL("api/board.js", root), "utf8"),
  teamUser: await readFile(new URL("api/team-user.js", root), "utf8"),
  db: await readFile(new URL("api/db.js", root), "utf8"),
  staticGate: await readFile(new URL("api/static.js", root), "utf8"),
  workflow: await readFile(new URL(".github/workflows/refresh.yml", root), "utf8"),
  refreshScript: await readFile(new URL(".github/scripts/refresh.py", root), "utf8"),
  liveData: await readFile(new URL("assets/live-data.js", root), "utf8")
};

const requiredText = [
  "YouTube Command Centre",
  "Team Hub",
  "Best Hours To Publish",
  "Market Intel",
  "Comment Pulse",
  "Video Ideas",
  "Community + AI Suggested Ideas",
  "Dismiss",
  "Monthly Review",
  "Upload Calendar",
  "Add Link",
  "Queue Refresh",
  "scripting",
  "draftupload",
  "OWNER_ACCESS_CODE",
  "AUTH_COOKIE_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "Team login",
  "Check Login Users",
  "Shared board",
  "User ID",
  "coinlyte-logo.png"
];

for (const text of requiredText) {
  const haystack = Object.values(files).join("\n");
  if (!haystack.includes(text)) {
    throw new Error(`Missing required text: ${text}`);
  }
}

const forbiddenFrontendPatterns = [
  /GH_PAT/i,
  /Authorization:\s*`?Bearer/i,
  /github_pat_/i,
  /ghp_[A-Za-z0-9_]+/i,
  /Mrvyas@2026/i
];
const frontend = `${files.html}\n${files.data}\n${files.app}`;
for (const pattern of forbiddenFrontendPatterns) {
  if (pattern.test(frontend)) {
    throw new Error(`Forbidden frontend secret/token pattern found: ${pattern}`);
  }
}

if (!files.refresh.includes("process.env.GH_PAT")) {
  throw new Error("Refresh endpoint must read GH_PAT server-side.");
}
if (!files.status.includes("workflow_runs")) {
  throw new Error("Refresh status endpoint must inspect workflow runs.");
}
if (!files.login.includes("process.env.OWNER_ACCESS_CODE")) {
  throw new Error("Login endpoint must read OWNER_ACCESS_CODE server-side.");
}
if (!files.auth.includes("cl_session") || !files.auth.includes("timingSafeEqual")) {
  throw new Error("Auth helper must validate the signed owner cookie.");
}
if (!files.staticGate.includes("parseSession") || !files.staticGate.includes("login.html")) {
  throw new Error("Static gate must protect dashboard files behind login.");
}
if (!files.login.includes("listTeamUsers") || !files.login.includes("verifyAccessCode")) {
  throw new Error("Login endpoint must support hashed team access codes.");
}
if (!files.login.includes("params.get(\"userId\")") || !files.loginPage.includes("name=\"userId\"")) {
  throw new Error("Login must require a User ID plus access code.");
}
if (!files.login.includes("OWNER_USER_IDS") || !files.login.includes("mrvyas")) {
  throw new Error("Owner login should support configurable owner User IDs including Mrvyas.");
}
if (!files.db.includes("app_state") || !files.board.includes("requireSession") || !files.board.includes("saveAppState")) {
  throw new Error("Board API must read/write shared Supabase app_state behind login.");
}
if (!files.teamUser.includes("hashAccessCode") || !files.teamUser.includes("requireOwner") || !files.teamUser.includes("listTeamUsers")) {
  throw new Error("Team user API must hash codes, require owner access, and list login-ready users.");
}
if (!files.teamUser.includes("DELETE") || !files.db.includes("deleteTeamUser") || !files.app.includes("Team member and login removed")) {
  throw new Error("Team deletion must remove the secure Supabase login row.");
}
if (!files.app.includes("Unknown owner") || !files.app.includes("👤 Unassigned")) {
  throw new Error("Planner cards must visibly show assigned/unassigned ownership.");
}
if (!files.app.includes("persistBoardNow({ force: true });")) {
  throw new Error("Stage moves must immediately persist to the shared board.");
}
if (!files.refresh.includes("requireOwner") || !files.status.includes("requireOwner")) {
  throw new Error("Refresh API endpoints must require owner access.");
}
if (!files.refreshScript.includes("assets/live-data.js")) {
  throw new Error("Refresh script must write the live data asset.");
}
if (!files.workflow.includes("VERCEL_DEPLOY_HOOK")) {
  throw new Error("Refresh workflow should support the Vercel deploy hook.");
}
if (!files.liveData.includes("window.COINLYTE_LIVE_DATA")) {
  throw new Error("Live data asset must expose COINLYTE_LIVE_DATA.");
}

console.log("Static smoke checks passed.");
