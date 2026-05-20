import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { getTeamUserById, isDbConfigured } from "./db.js";

export const MAX_SESSION_AGE = 60 * 60 * 24 * 7;
export const APP_ACCESS = ["Command", "Analytics", "Channel Intelligence", "Content Planner", "Brand Deals", "Team Access", "Refresh"];

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

export function encodeSession(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function createSessionCookie(payload, secret) {
  const encoded = encodeSession(payload);
  return `${encoded}.${sign(encoded, secret)}`;
}

export function parseSession(req) {
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!secret) return null;
  const cookies = parseCookies(req.headers.cookie || "");
  const [payload, signature] = String(cookies.cl_session || "").split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(signature, sign(payload, secret))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session || typeof session !== "object") return null;
    if (session.iat && Date.now() - Number(session.iat) > MAX_SESSION_AGE * 1000) return null;
    return session;
  } catch {
    return null;
  }
}

export function hasValidSession(req) {
  return Boolean(parseSession(req));
}

export function hasAccess(session, area) {
  if (session?.role === "owner") return true;
  return Array.isArray(session?.access) && session.access.includes(area);
}

export async function getCurrentSession(req) {
  const session = parseSession(req);
  if (!session) return null;
  if (session.role === "owner") return { ...session, access: APP_ACCESS };
  if (!isDbConfigured() || !session.memberId) return session;
  const member = await getTeamUserById(session.memberId);
  if (!member || member.access_status === "Paused") return null;
  return {
    ...session,
    role: member.role || "Team",
    name: member.name || session.name,
    userId: member.user_id || session.userId,
    memberId: member.id,
    access: Array.isArray(member.access) ? member.access : []
  };
}

export async function requireSession(req, res) {
  const session = await getCurrentSession(req);
  if (session) return session;
  res.statusCode = 401;
  res.setHeader("Set-Cookie", "cl_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "Login required" }));
  return null;
}

export function requireOwner(req, res) {
  const session = parseSession(req);
  if (session?.role === "owner") return true;
  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "Owner access required" }));
  return false;
}

export function hashAccessCode(code, salt = randomBytes(16).toString("base64url")) {
  const hash = pbkdf2Sync(String(code), salt, 120000, 32, "sha256").toString("base64url");
  return { salt, hash };
}

export function verifyAccessCode(code, salt, expectedHash) {
  if (!code || !salt || !expectedHash) return false;
  const { hash } = hashAccessCode(code, salt);
  return safeEqual(hash, expectedHash);
}
