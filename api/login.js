import { APP_ACCESS, MAX_SESSION_AGE, createSessionCookie, safeEqual, verifyAccessCode } from "./auth.js";
import { isDbConfigured, listTeamUsers } from "./db.js";

const DEFAULT_OWNER_USER_IDS = ["owner", "kirtish", "mrvyas"];

function ownerUserIds() {
  return String(process.env.OWNER_USER_IDS || DEFAULT_OWNER_USER_IDS.join(","))
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4096) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method not allowed");
  }

  const expected = process.env.OWNER_ACCESS_CODE;
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!expected || !secret) {
    return res.status(500).end("Dashboard access is not configured.");
  }

  const raw = await readBody(req);
  const params = new URLSearchParams(raw);
  const code = String(params.get("code") || "");
  const userId = String(params.get("userId") || "").trim().toLowerCase();
  let session = null;
  if (ownerUserIds().includes(userId) && safeEqual(code, expected)) {
    session = { role: "owner", name: "Kirtish", userId: userId || "owner", access: APP_ACCESS, iat: Date.now() };
  } else if (isDbConfigured()) {
    try {
      const users = await listTeamUsers();
      const matched = users.find((user) => {
        const matchesUser = String(user.user_id || "").toLowerCase() === userId;
        return matchesUser && user.access_status !== "Paused" && verifyAccessCode(code, user.access_code_salt, user.access_code_hash);
      });
      if (matched) {
        session = {
          role: matched.role || "Team",
          name: matched.name,
          userId: matched.user_id,
          memberId: matched.id,
          access: matched.access || ["Content Planner"],
          iat: Date.now()
        };
      }
    } catch {
      session = null;
    }
  }
  if (!session) {
    return res.redirect(302, "/login.html?error=1");
  }

  const cookie = createSessionCookie(session, secret);
  res.setHeader("Set-Cookie", `cl_session=${cookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_SESSION_AGE}`);
  return res.redirect(302, "/");
}
