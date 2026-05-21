import { requireSession } from "./auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await requireSession(req, res);
  if (!session) return;

  const { to, subject, message, cardTitle } = req.body || {};
  if (!to || !subject || !message) {
    return res.status(400).json({ error: "Missing email notification fields", status: "failed" });
  }

  const token = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM || "CoinLyte Command <notifications@coinlyte.local>";
  if (!token) {
    return res.status(200).json({ status: "not_configured" });
  }

  try {
    const email = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: `${message}\n\nCard: ${cardTitle || "Planner card"}`
      })
    });
    if (!email.ok) {
      const detail = await email.text().catch(() => "");
      return res.status(502).json({ error: detail || "Email provider failed", status: "failed" });
    }
    return res.status(200).json({ status: "sent" });
  } catch (error) {
    return res.status(500).json({ error: error.message, status: "failed" });
  }
}
