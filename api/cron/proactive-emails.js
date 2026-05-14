/**
 * FlowOS — Proactive emails cron
 * Vercel Cron: GET /api/cron/proactive-emails — runs at 07:30 UTC every day
 *
 * Runs 30 min after proactive-drafts so analytics_insights from the 06:00 cron
 * are settled. Iterates every tenant in `brands`, POSTs to /api/proactive-emails
 * which reads the latest insight, classifies recommended_actions into email-rules
 * (R1..R5), generates drafts via Claude, persists to proactive_emails (status
 * 'proactive_draft', not pushed). EmailStudio surfaces them for human review.
 */

export const config = { runtime: "edge" };

export default async function handler(req) {
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

  const origin  = new URL(req.url).origin;
  const results = [];

  for (const tenantId of tenantIds) {
    const start = Date.now();
    try {
      const res = await fetch(`${origin}/api/proactive-emails`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tenantId }),
      });
      const data    = await res.json().catch(() => ({}));
      const elapsed = Date.now() - start;
      results.push({
        tenantId,
        ok:           res.ok && data.ok,
        elapsed:      `${elapsed}ms`,
        matched:      data.matched ?? 0,
        inserted:     data.inserted ?? 0,
        usingFallback: !!data.usingFallback,
        ...((!res.ok || !data.ok) ? { error: data.error ?? `HTTP ${res.status}` } : {}),
      });
    } catch (e) {
      results.push({ tenantId, ok: false, error: e.message });
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;

  console.log(`[cron/proactive-emails] ${passed} ok · ${failed} failed`, results);

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
