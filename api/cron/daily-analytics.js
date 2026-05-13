/**
 * FlowOS — Daily analytics cron
 * Vercel Cron: GET /api/cron/daily-analytics — runs at 06:00 UTC every day
 *
 * 1. Verify Vercel cron secret (set automatically on Pro; optional on Hobby)
 * 2. Fetch all distinct tenant IDs from the brands table
 * 3. POST to /api/analytics-ingest for each tenant, sequentially
 * 4. Return a run summary
 */

export const config = { runtime: "edge" };

export default async function handler(req) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  // Vercel sets Authorization: Bearer <CRON_SECRET> on every cron invocation.
  // If CRON_SECRET is set in env, reject anything that doesn't match.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;

  if (!sbUrl || !sbKey) {
    return json(500, { ok: false, error: "Supabase env vars not configured" });
  }

  // ── Fetch all active tenants ───────────────────────────────────────────────
  let tenantIds;
  try {
    const res = await fetch(
      `${sbUrl}/rest/v1/brands?select=user_id&order=updated_at.desc`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
    );
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const rows = await res.json();
    tenantIds  = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
  } catch (e) {
    return json(500, { ok: false, error: `Could not fetch tenants: ${e.message}` });
  }

  if (tenantIds.length === 0) {
    return json(200, { ok: true, message: "No tenants found — nothing to ingest" });
  }

  // ── Run ingest per tenant (sequential — avoids hammering Composio / Claude) ─
  const origin  = new URL(req.url).origin;
  const results = [];

  for (const tenantId of tenantIds) {
    const start = Date.now();
    try {
      const res = await fetch(`${origin}/api/analytics-ingest`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tenantId, period: "30d" }),
      });
      const data    = await res.json().catch(() => ({}));
      const elapsed = Date.now() - start;
      results.push({
        tenantId,
        ok:      res.ok,
        elapsed: `${elapsed}ms`,
        ...(res.ok
          ? { snapshotCount: data.snapshots?.length ?? 0 }
          : { error: data.error ?? `HTTP ${res.status}` }),
      });
    } catch (e) {
      results.push({ tenantId, ok: false, error: e.message });
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;

  console.log(`[cron/daily-analytics] ${passed} ok · ${failed} failed`, results);

  return json(200, {
    ok:        failed === 0,
    processed: results.length,
    passed,
    failed,
    results,
  });
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
