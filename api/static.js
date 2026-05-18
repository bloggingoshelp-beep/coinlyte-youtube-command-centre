import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hasValidSession } from "./auth.js";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function sendFile(res, filePath) {
  const info = statSync(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Length", String(info.size));
  res.setHeader("Content-Type", types[extname(filePath)] || "application/octet-stream");
  createReadStream(filePath).pipe(res);
}

export default function handler(req, res) {
  const url = new URL(req.url, "https://coinlyte.local");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

  if (pathname === "/login.html") {
    return sendFile(res, join(root, "login.html"));
  }

  if (!hasValidSession(req)) {
    res.statusCode = 302;
    res.setHeader("Location", "/login.html");
    return res.end();
  }

  const requested = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(join(root, requested));
  if (!filePath.startsWith(root)) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }

  try {
    return sendFile(res, filePath);
  } catch {
    if (extname(filePath)) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end("Not found");
    }
    return sendFile(res, join(root, "index.html"));
  }
}
