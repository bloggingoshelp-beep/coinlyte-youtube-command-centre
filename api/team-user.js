import { hashAccessCode, requireOwner } from "./auth.js";
import { listTeamUsers, publicTeamUser, upsertTeamUser } from "./db.js";

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 50000) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => resolve(body ? JSON.parse(body) : {}));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (!requireOwner(req, res)) return;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "GET") {
    try {
      const members = await listTeamUsers();
      return res.end(JSON.stringify({ ok: true, members: members.map(publicTeamUser) }));
    } catch (error) {
      res.statusCode = error.status || 500;
      return res.end(JSON.stringify({ ok: false, error: error.message || "Team user check failed" }));
    }
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }
  try {
    const body = await readJson(req);
    const member = body.member || {};
    if (!member.id || !member.name || !member.userId) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Member id, name, and userId are required" }));
    }
    const row = {
      id: member.id,
      name: member.name,
      user_id: member.userId,
      email: member.email || "",
      role: member.role || "Team",
      access_status: member.accessStatus || "Active",
      access: Array.isArray(member.access) ? member.access : ["Content Planner"],
      channels: Array.isArray(member.channels) ? member.channels : ["In-app"],
      notify_stages: member.notifyStages !== false
    };
    if (body.accessCode) {
      const { salt, hash } = hashAccessCode(body.accessCode);
      row.access_code_salt = salt;
      row.access_code_hash = hash;
    }
    const saved = await upsertTeamUser(row);
    return res.end(JSON.stringify({ ok: true, member: publicTeamUser(saved) }));
  } catch (error) {
    res.statusCode = error.status || 500;
    return res.end(JSON.stringify({ ok: false, error: error.message || "Team user save failed" }));
  }
}
