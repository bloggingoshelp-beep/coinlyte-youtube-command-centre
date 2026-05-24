import { requireOwner } from "./auth.js";
import { readFile } from "node:fs/promises";

const OWNER = process.env.GH_OWNER || "bloggingoshelp-beep";
const REPO = process.env.GH_REPO || "coinlyte-youtube-command-centre";
const WORKFLOW = process.env.GH_WORKFLOW || "refresh.yml";
const DATASET_KEYS = ["channel", "analytics", "comments", "competitors", "ideas"];

async function readLastSuccessfulCache() {
  try {
    const raw = await readFile(new URL("../assets/refresh-status.json", import.meta.url), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function datasetStatus(ok, cache) {
  if (ok) return Object.fromEntries(DATASET_KEYS.map((key) => [key, "updated"]));
  if (cache?.status === "completed") return Object.fromEntries(DATASET_KEYS.map((key) => [key, "cached"]));
  return Object.fromEntries(DATASET_KEYS.map((key) => [key, "pending"]));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!requireOwner(req, res)) return;

  const token = process.env.GH_PAT;
  if (!token) {
    return res.status(500).json({ error: "GH_PAT env var is not configured", status: "not_configured" });
  }

  try {
    const runId = req.query?.runId;
    const url = runId && runId !== "pending"
      ? `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${encodeURIComponent(runId)}`
      : `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return res.status(response.status).json({ error: `GitHub status failed: ${detail}` });
    }

    const body = await response.json();
    const run = body.workflow_runs ? body.workflow_runs[0] : body;
    const completed = run.status === "completed";
    const ok = completed && run.conclusion === "success";
    const cache = await readLastSuccessfulCache();

    return res.status(200).json({
      status: completed ? (ok ? "completed" : "failed") : run.status,
      conclusion: run.conclusion || null,
      runId: run.id ? String(run.id) : null,
      runUrl: run.html_url || null,
      updatedAt: run.updated_at || new Date().toISOString(),
      cacheStatus: cache?.status || null,
      lastSuccessfulRefresh: cache?.lastRefresh || null,
      lastSuccessfulAt: cache?.completedAt || null,
      cacheDatasets: cache?.datasets || null,
      note: ok
        ? "Latest workflow completed and wrote a fresh data cache."
        : cache?.status === "completed"
          ? "Latest workflow attempt did not complete successfully, so the app is showing the last good data cache."
          : "No successful refresh cache was found yet.",
      datasets: datasetStatus(ok, cache)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
