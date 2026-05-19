const requiredTables = ["app_state", "team_users"];

export function isDbConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function missingDbMessage() {
  return `Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then run supabase/schema.sql (${requiredTables.join(", ")}).`;
}

async function supabaseFetch(path, options = {}) {
  if (!isDbConfigured()) {
    const error = new Error(missingDbMessage());
    error.status = 503;
    throw error;
  }
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    const error = new Error(text || `Supabase request failed: ${res.status}`);
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function getAppState(key = "operational") {
  const rows = await supabaseFetch(`app_state?key=eq.${encodeURIComponent(key)}&select=key,data,updated_at&limit=1`);
  return rows?.[0] || null;
}

export async function saveAppState(key, data) {
  const rows = await supabaseFetch("app_state?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ key, data, updated_at: new Date().toISOString() }])
  });
  return rows?.[0] || null;
}

export async function listTeamUsers() {
  return supabaseFetch("team_users?select=*&order=created_at.asc");
}

export async function upsertTeamUser(user) {
  const rows = await supabaseFetch("team_users?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ ...user, updated_at: new Date().toISOString() }])
  });
  return rows?.[0] || null;
}

export function publicTeamUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    userId: row.user_id,
    email: row.email || "",
    accessStatus: row.access_status,
    channels: row.channels || ["In-app"],
    access: row.access || ["Content Planner"],
    notifyStages: row.notify_stages !== false,
    hasAccessCode: Boolean(row.access_code_hash)
  };
}
