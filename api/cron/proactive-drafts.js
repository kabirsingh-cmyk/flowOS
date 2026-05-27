/**
 * FlowOS Reach — Proactive drafts cron
 * Vercel Cron: GET /api/cron/proactive-drafts — runs at 07:00 UTC every day
 *
 * 1. Verify CRON_SECRET
 * 2. Fetch all distinct tenant IDs from the brands table
 * 3. POST to /api/proactive-drafts for each tenant
 * 4. Return a run summary
 *
 * Note: drafts are returned by /api/proactive-drafts but not yet persisted
 * server-side — they surface in the UI when the user next loads the queue.
 * A future iteration will upsert to a proactive_drafts Supabase table so
 * they pre-populate even before the user triggers generation manually.
 */

import { requireCron } from "../lib/auth.js";

export const config = { runtime: "edge" };

export default async function handler(req) {
  const cronAuth = requireCron(req);
  if (cronAuth instanceof Response) return cronAuth;

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
    tenantIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
  } catch (e) {
    return json(500, { ok: false, error: `Could not fetch tenants: ${e.message}` });
  }

  if (tenantIds.length === 0) {
    return json(200, { ok: true, message: "No tenants found — nothing to generate" });
  }

  // ── Generate drafts per tenant ─────────────────────────────────────────────
  const origin  = new URL(req.url).origin;
  const results = [];

  for (const tenantId of tenantIds) {
    const start = Date.now();
    try {
      const res = await fetch(`${origin}/api/proactive-drafts`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${process.env.CRON_SECRET}`,
        },
        body:    JSON.stringify({ tenantId, days: 7, count: 7 }),
      });
      const data    = await res.json().catch(() => ({}));
      const elapsed = Date.now() - start;
      results.push({
        tenantId,
        ok:           res.ok && data.ok,
        elapsed:      `${elapsed}ms`,
        source:       data.source || "unknown",
        draftCount:   data.drafts?.length ?? 0,
        ...((!res.ok || !data.ok) ? { error: data.error ?? `HTTP ${res.status}` } : {}),
      });
    } catch (e) {
      results.push({ tenantId, ok: false, error: e.message });
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;

  console.log(`[cron/proactive-drafts] ${passed} ok · ${failed} failed`, results);

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
