import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_SESSION_AGE = 60 * 60 * 24 * 7;

export function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index === -1) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

export function hasValidSession(req) {
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!secret) return false;
  const cookies = parseCookies(req.headers.cookie || "");
  const [payload, signature] = String(cookies.cl_session || "").split(".");
  if (!payload || !signature) return false;
  return safeEqual(signature, sign(payload, secret));
}

export function requireOwner(req, res) {
  if (hasValidSession(req)) return true;
  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "Owner access required" }));
  return false;
}
