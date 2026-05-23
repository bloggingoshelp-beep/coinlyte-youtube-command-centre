import { APP_ACCESS, hasAccess, requireSession } from "./auth.js";
import { getAppState, isDbConfigured, missingDbMessage, saveAppState } from "./db.js";

const KEY = "operational";
const OWNER_FIELDS = ["pipeline", "hubLinks", "brands", "savedRadar", "teamMembers", "notifications", "dismissedIdeas", "dismissedCommand"];
const ACCESS_FIELDS = {
  Command: ["dismissedCommand", "notifications"],
  Analytics: [],
  "Channel Intelligence": ["pipeline", "savedRadar", "dismissedIdeas"],
  "Content Planner": ["pipeline", "hubLinks", "savedRadar", "notifications", "dismissedIdeas", "dismissedCommand"],
  "Brand Deals": ["brands", "notifications"],
  "Team Access": ["teamMembers", "notifications"],
  Refresh: []
};

function allowedFields(session) {
  if (session.role === "owner") return OWNER_FIELDS;
  return [...new Set(["notifications", ...APP_ACCESS.flatMap((area) => hasAccess(session, area) ? ACCESS_FIELDS[area] || [] : [])])];
}

function canSeeNotification(note = {}, session = {}) {
  if (session.role === "owner") {
    if (note.audience) return note.audience === "owner";
    return !note.memberId || note.memberId === "owner-kirtish" || note.memberName === "Kirtish" || note.memberName === "Owner";
  }
  const memberId = session.memberId || "";
  const name = session.name || "";
  if (note.audience === "owner") return false;
  if (note.audience === "member") return note.memberId === memberId || note.memberName === name;
  return !note.memberId || note.memberId === memberId || note.memberName === name;
}

function filterBoard(data = {}, session) {
  const allowed = allowedFields(session);
  return Object.fromEntries(allowed.map((field) => {
    const value = field === "notifications" && Array.isArray(data[field])
      ? data[field].filter((note) => canSeeNotification(note, session))
      : data[field];
    return [field, value];
  }).filter(([, value]) => value !== undefined));
}

function mergeBoard(current = {}, incoming = {}, session) {
  const allowed = allowedFields(session);
  const next = { ...current };
  allowed.forEach((field) => {
    if (incoming[field] === undefined) return;
    if (field === "notifications") {
      const currentNotes = Array.isArray(current.notifications) ? current.notifications : [];
      const incomingNotes = Array.isArray(incoming.notifications) ? incoming.notifications : [];
      const incomingIds = new Set(incomingNotes.map((note) => note?.id).filter(Boolean));
      const hiddenNotes = currentNotes.filter((note) => !canSeeNotification(note, session) && !incomingIds.has(note?.id));
      next.notifications = [...incomingNotes, ...hiddenNotes]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 80);
      return;
    }
    next[field] = incoming[field];
  });
  return next;
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2000000) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => resolve(body ? JSON.parse(body) : {}));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!isDbConfigured()) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, mode: "local", error: missingDbMessage() }));
  }
  try {
    if (req.method === "GET") {
      const row = await getAppState(KEY);
      return res.end(JSON.stringify({ ok: true, mode: "cloud", empty: !row, data: filterBoard(row?.data || {}, session), updatedAt: row?.updated_at || "" }));
    }
    if (req.method === "PUT") {
      const incoming = await readJson(req);
      const current = await getAppState(KEY);
      const data = mergeBoard(current?.data || {}, incoming, session);
      const saved = await saveAppState(KEY, data);
      return res.end(JSON.stringify({ ok: true, mode: "cloud", data: filterBoard(saved?.data || data, session), updatedAt: saved?.updated_at || "" }));
    }
    res.setHeader("Allow", "GET, PUT");
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  } catch (error) {
    res.statusCode = error.status || 500;
    return res.end(JSON.stringify({ ok: false, error: error.message || "Board sync failed" }));
  }
}
