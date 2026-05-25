/**
 * FlowOS — Scheduled post firing cron
 * Vercel Cron: GET /api/cron/fire-scheduled — runs every minute on Pro.
 *
 * Flow per invocation:
 *   1. Verify CRON_SECRET.
 *   2. RPC `claim_due_scheduled_posts(20)` — atomically claims up to 20 due
 *      rows in 'pending' status, transitions them to 'publishing', returns them.
 *      Row-level locking (SKIP LOCKED) guarantees a given row is only ever
 *      picked up by one concurrent run — so we cannot double-post.
 *   3. For each claimed row: POST `${origin}/api/<platform>` with the snapshot
 *      payload. Platform-agnostic by construction — the row's `payload` jsonb
 *      already matches the publish_now body shape that workspaces3.jsx
 *      generates today.
 *   4. PATCH the row to 'published' or 'failed' based on the result.
 *
 * The cron does NOT patch the calendar row in state — clients reconcile via
 * /api/scheduled-posts list at PublishingQueue mount.
 */

import { requireCron } from "../lib/auth.js";

export const config = { runtime: "edge" };

// Platforms this cron knows how to fire. Must match scheduled-posts.js
// SUPPORTED_PLATFORMS and the PLATFORM_PUBLISHERS map in workspaces3.jsx.
// All social platforms now route through their thin Zernio proxy routes.
const PLATFORM_ROUTES = {
  linkedin:       "/api/linkedin",
  facebook:       "/api/facebook",
  x:              "/api/x",
  instagram:      "/api/instagram",
  reddit:         "/api/reddit",
  tiktok:         "/api/tiktok",
  pinterest:      "/api/pinterest",
  threads:        "/api/threads",
  bluesky:        "/api/bluesky",
  youtube:        "/api/youtube",
  whatsapp:       "/api/whatsapp",
  telegram:       "/api/telegram",
  snapchat:       "/api/snapchat",
  discord:        "/api/discord",
  gbusiness:      "/api/googlebusiness",
};

export default async function handler(req) {
  const cronAuth = requireCron(req);
  if (cronAuth instanceof Response) return cronAuth;

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) {
    return json(500, { ok: false, error: "Supabase env vars not configured" });
  }

  // ── Claim due rows ────────────────────────────────────────────────────────
  let claimed;
  try {
    const res = await fetch(`${sbUrl}/rest/v1/rpc/claim_due_scheduled_posts`, {
      method:  "POST",
      headers: {
        apikey:         sbKey,
        Authorization:  `Bearer ${sbKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit_n: 20 }),
    });
    if (!res.ok) throw new Error(`claim rpc ${res.status} ${await res.text().catch(() => "")}`);
    claimed = await res.json();
  } catch (e) {
    return json(500, { ok: false, error: `Claim failed: ${e.message}` });
  }

  if (!claimed || claimed.length === 0) {
    return json(200, { ok: true, processed: 0 });
  }

  // ── Fire each claimed row sequentially ────────────────────────────────────
  // Sequential is fine — the cron's own SKIP LOCKED claim already serialises
  // across cron runs, and 20 rows/minute is well under any rate ceiling.
  const origin  = new URL(req.url).origin;
  const results = [];

  for (const row of claimed) {
    const route = PLATFORM_ROUTES[row.platform];
    if (!route) {
      await patchRow(sbUrl, sbKey, row.id, {
        status:     "failed",
        last_error: `Unsupported platform: ${row.platform}`,
      });
      results.push({ id: row.id, ok: false, error: "unsupported platform" });
      continue;
    }

    const t0 = Date.now();
    try {
      // The payload in the DB is already a complete publish_now body for the
      // matching platform — just spread it back. tenantId travels via the
      // top-level column on the row, not inside payload, so re-attach it.
      const fireBody = {
        ...row.payload,
        action:   "publish_now",
        tenantId: row.tenant_id,
      };

      const res = await fetch(`${origin}${route}`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          // Service-to-service auth — platform handlers' requireAuthOrCron
          // verifies this matches CRON_SECRET and the tenant id in the body
          // (passed below) was server-stamped at queue time in
          // /api/scheduled-posts.
          Authorization:  `Bearer ${process.env.CRON_SECRET}`,
        },
        body:    JSON.stringify(fireBody),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        await patchRow(sbUrl, sbKey, row.id, {
          status:       "published",
          published_at: new Date().toISOString(),
          result:       data,
          last_error:   null,
        });
        results.push({
          id:      row.id,
          ok:      true,
          elapsed: `${Date.now() - t0}ms`,
          postUrl: data.postUrl || null,
        });
      } else {
        const err = data?.error || `HTTP ${res.status}`;
        await patchRow(sbUrl, sbKey, row.id, {
          status:     "failed",
          last_error: err,
          result:     data,
        });
        results.push({ id: row.id, ok: false, error: err });
      }
    } catch (e) {
      await patchRow(sbUrl, sbKey, row.id, {
        status:     "failed",
        last_error: e.message,
      });
      results.push({ id: row.id, ok: false, error: e.message });
    }
  }

  const passed = results.filter(r => r.ok).length;
  console.log(`[cron/fire-scheduled] ${passed}/${results.length} fired`, results);

  return json(200, {
    ok:        results.every(r => r.ok),
    processed: results.length,
    passed,
    failed:    results.length - passed,
    results,
  });
}

async function patchRow(sbUrl, sbKey, id, patch) {
  await fetch(`${sbUrl}/rest/v1/scheduled_posts?id=eq.${id}`, {
    method:  "PATCH",
    headers: {
      apikey:         sbKey,
      Authorization:  `Bearer ${sbKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
