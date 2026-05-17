import { requireOwner } from "./auth.js";

const OWNER = process.env.GH_OWNER || "bloggingoshelp-beep";
const REPO = process.env.GH_REPO || "coinlyte-youtube-command-centre";
const WORKFLOW = process.env.GH_WORKFLOW || "refresh.yml";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!requireOwner(req, res)) return;

  const token = process.env.GH_PAT;
  if (!token) {
    return res.status(500).json({
      error: "GH_PAT env var is not configured",
      status: "not_configured"
    });
  }

  try {
    const dispatch = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({ ref: process.env.GH_REF || "main" })
    });

    if (dispatch.status !== 204) {
      const detail = await dispatch.text().catch(() => "");
      return res.status(dispatch.status).json({ error: `GitHub dispatch failed: ${detail}` });
    }

    const runs = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }).then((r) => r.ok ? r.json() : null).catch(() => null);

    const latest = runs?.workflow_runs?.[0];
    return res.status(200).json({
      status: "queued",
      runId: latest?.id ? String(latest.id) : null,
      runUrl: latest?.html_url || null,
      queuedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
