// FlowOS — Scheduled posts queue (platform-agnostic)
//
// Frontend writes here when the user clicks Schedule in the Publishing Queue
// drawer. Cron at /api/cron/fire-scheduled polls the resulting rows.
//
// Actions:
//   create  { tenantId, itemId, platform, fireAt (ISO UTC), payload }
//             → inserts a pending row, returns { ok, id }
//   list    { tenantId }
//             → returns the tenant's open rows for PublishingQueue hydration
//   cancel  { tenantId, id }
//             → flips a pending row to cancelled (no-op if already firing/done)
//
// All writes use the service key, but tenantId is now resolved from the user
// JWT (requireAuth) — the request body's tenantId is ignored. This is what
// keeps cron's snapshot `payload` trustworthy: at queue time we stamped the
// authenticated tenant onto the row, and the cron later replays that exact
// tenant id when calling /api/<platform>.

import { requireAuth } from "./lib/auth.js";
import { corsHeaders } from "./lib/cors.js";

export const config = { runtime: "edge" };

const CORS = corsHeaders();

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Allowlist of platforms that have a working /api/<platform> publish_now.
// Keep in sync with the PLATFORM_PUBLISHERS map in app/workspaces3.jsx.
const SUPPORTED_PLATFORMS = new Set([
  "linkedin", "facebook", "x", "instagram", "reddit",
]);

function sbHeaders(serviceKey) {
  return {
    apikey:         serviceKey,
    Authorization:  `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return reply({ error: "Method not allowed" }, 405);
  }

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) {
    return reply({ error: "Supabase env vars not configured" }, 500);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;

  let body;
  try { body = await req.json(); }
  catch { return reply({ error: "Invalid JSON body" }, 400); }

  const { action } = body;
  if (!action) return reply({ error: "action required" }, 400);

  try {
    if (action === "create") {
      const { itemId, platform, fireAt, payload } = body;
      if (!itemId)   return reply({ error: "itemId required" }, 400);
      if (!platform) return reply({ error: "platform required" }, 400);
      if (!fireAt)   return reply({ error: "fireAt required" }, 400);
      if (!payload || typeof payload !== "object") {
        return reply({ error: "payload must be an object" }, 400);
      }
      if (!SUPPORTED_PLATFORMS.has(platform)) {
        return reply({ error: `Platform '${platform}' not supported for scheduled posting` }, 400);
      }
      // Parse fireAt — must be a valid date and shouldn't be in the past
      // beyond a small grace window (allow ~60s slack so a near-now schedule
      // doesn't fire immediately due to clock skew; older than that is likely
      // a UI bug).
      const fireMs = Date.parse(fireAt);
      if (Number.isNaN(fireMs)) {
        return reply({ error: "fireAt must be a valid ISO timestamp" }, 400);
      }
      if (fireMs < Date.now() - 60_000) {
        return reply({ error: "fireAt is in the past" }, 400);
      }

      const row = {
        tenant_id: tenantId,
        item_id:   itemId,
        platform,
        fire_at:   new Date(fireMs).toISOString(),
        payload,
        status:    "pending",
      };

      const res = await fetch(`${sbUrl}/rest/v1/scheduled_posts`, {
        method:  "POST",
        headers: { ...sbHeaders(sbKey), Prefer: "return=representation" },
        body:    JSON.stringify(row),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // 23505 = unique_violation (item already has a pending row)
        if (res.status === 409 || text.includes("scheduled_posts_item_pending_idx")) {
          return reply({ error: "This item already has a pending scheduled post — cancel it first" }, 409);
        }
        return reply({ error: `Insert failed: ${res.status} ${text.slice(0, 200)}` }, 502);
      }
      const [created] = await res.json();
      return reply({ ok: true, id: created.id, fireAt: created.fire_at });
    }

    if (action === "list") {
      // Returns rows for PublishingQueue hydration:
      //   - all open (pending/publishing/failed)
      //   - published in the last 7 days (so the client can flip 'scheduled'
      //     calendar rows to 'sent' after the cron fired them, and copy
      //     postUrl/postId into the matching calendar item)
      // Cancelled rows are not returned.
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const qs = new URLSearchParams({
        select:    "id,item_id,platform,fire_at,status,last_error,attempts,fire_attempted_at,published_at,payload,result",
        tenant_id: `eq.${tenantId}`,
        or:        `(status.in.(pending,publishing,failed),and(status.eq.published,published_at.gte.${cutoff}))`,
        order:     "fire_at.asc",
      });
      const res = await fetch(`${sbUrl}/rest/v1/scheduled_posts?${qs}`, {
        headers: sbHeaders(sbKey),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return reply({ error: `Fetch failed: ${res.status} ${text.slice(0, 200)}` }, 502);
      }
      const rows = await res.json();
      return reply({ ok: true, rows });
    }

    if (action === "cancel") {
      const { id, itemId } = body;
      if (!id && !itemId) return reply({ error: "id or itemId required" }, 400);

      // Only cancel rows that are still pending — publishing/published are
      // either in-flight or terminal and shouldn't be touched here.
      const filter = id
        ? `id=eq.${id}`
        : `item_id=eq.${itemId}&status=eq.pending`;
      const qs = `${filter}&tenant_id=eq.${tenantId}&status=eq.pending`;
      const res = await fetch(`${sbUrl}/rest/v1/scheduled_posts?${qs}`, {
        method:  "PATCH",
        headers: { ...sbHeaders(sbKey), Prefer: "return=representation" },
        body:    JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return reply({ error: `Cancel failed: ${res.status} ${text.slice(0, 200)}` }, 502);
      }
      const updated = await res.json();
      return reply({ ok: true, cancelled: updated.length });
    }

    return reply({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[FlowOS scheduled-posts]", e.message);
    return reply({ error: e.message }, 500);
  }
}
