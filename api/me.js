import { APP_ACCESS, getCurrentSession } from "./auth.js";

export default async function handler(req, res) {
  const session = await getCurrentSession(req);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!session) {
    res.statusCode = 401;
    res.setHeader("Set-Cookie", "cl_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
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
