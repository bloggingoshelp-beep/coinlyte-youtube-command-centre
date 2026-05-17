import { MAX_SESSION_AGE, safeEqual, sign } from "./auth.js";

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
  if (!safeEqual(code, expected)) {
    return res.redirect(302, "/login.html?error=1");
  }

  const payload = Buffer.from(JSON.stringify({ role: "owner", iat: Date.now() })).toString("base64url");
  const cookie = `${payload}.${sign(payload, secret)}`;
  res.setHeader("Set-Cookie", `cl_session=${cookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_SESSION_AGE}`);
  return res.redirect(302, "/");
}
