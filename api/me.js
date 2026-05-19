import { APP_ACCESS, parseSession } from "./auth.js";

export default function handler(req, res) {
  const session = parseSession(req);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!session) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ authenticated: false }));
  }
  return res.end(JSON.stringify({
    authenticated: true,
    role: session.role,
    name: session.name || "Team",
    userId: session.userId || "",
    memberId: session.memberId || "",
    access: session.role === "owner" ? APP_ACCESS : session.access || []
  }));
}
