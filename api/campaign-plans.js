// FlowOS Reach — Campaign plans CRUD
//
// Persistent campaign briefs / plans. Replaces the ephemeral `state.activePlan`
// pattern (chat brief lost on refresh) with a durable lifecycle:
//   draft → active → paused → archived
//
// Actions (all body-driven, requireAuth):
//   list_plans     { status? }                           → rows
//   get_plan       { id }                                → row
//   create_plan    { title, summary, goal, audience,
//                    timeline, budget, channels, brief,
//                    sourceChatThreadId, sourceSpecialist,
//                    status? = 'draft' }                  → created row
//   update_plan    { id, ...patchable }                  → updated row
//   activate_plan  { id }                                → row (status=active, activated_at=now)
//   pause_plan     { id }                                → row (status=paused)
//   archive_plan   { id }                                → row (status=archived, archived_at=now)
//   delete_plan    { id }                                → { ok } (only draft)
//
// tenantId is always resolved from the user JWT — never trusted from the body.

import { requireAuth } from "./lib/auth.js";
import { corsHeaders } from "./lib/cors.js";

export const config = { runtime: "edge" };

const CORS = corsHeaders();

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const STATUSES = new Set(["draft", "active", "paused", "archived"]);

// Columns the caller may write via create_plan / update_plan.
// tenant_id, id, created_at, status timestamps are derived server-side.
const PATCHABLE = new Set([
  "title", "summary", "goal", "audience", "timeline", "budget",
  "channels", "brief", "source_chat_thread_id", "source_specialist",
]);

function sbHeaders(serviceKey) {
  return {
    apikey:         serviceKey,
    Authorization:  `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

// Translate camelCase input keys to snake_case DB columns.
function normaliseInput(input) {
  const out = {};
  const map = {
    title:              "title",
    summary:            "summary",
    goal:               "goal",
    audience:           "audience",
    timeline:           "timeline",
    budget:             "budget",
    channels:           "channels",
    brief:              "brief",
    sourceChatThreadId: "source_chat_thread_id",
    sourceSpecialist:   "source_specialist",
  };
  for (const [k, col] of Object.entries(map)) {
    if (input[k] !== undefined && PATCHABLE.has(col)) out[col] = input[k];
  }
  return out;
}

async function selectOne(sbUrl, sbKey, tenantId, id) {
  const qs = new URLSearchParams({
    select:    "*",
    id:        `eq.${id}`,
    tenant_id: `eq.${tenantId}`,
  });
  const res = await fetch(`${sbUrl}/rest/v1/campaign_plans?${qs}`, {
    headers: sbHeaders(sbKey),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fetch failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const rows = await res.json();
  return rows[0] || null;
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
    if (action === "list_plans") {
      const { status } = body;
      const qs = new URLSearchParams({
        select:    "*",
        tenant_id: `eq.${tenantId}`,
        order:     "updated_at.desc",
      });
      if (status) {
        if (!STATUSES.has(status)) return reply({ error: `Invalid status: ${status}` }, 400);
        qs.set("status", `eq.${status}`);
      }
      const res = await fetch(`${sbUrl}/rest/v1/campaign_plans?${qs}`, {
        headers: sbHeaders(sbKey),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return reply({ error: `List failed: ${res.status} ${text.slice(0, 200)}` }, 502);
      }
      const rows = await res.json();
      return reply({ ok: true, rows });
    }

    if (action === "get_plan") {
      const { id } = body;
      if (!id) return reply({ error: "id required" }, 400);
      const row = await selectOne(sbUrl, sbKey, tenantId, id);
      if (!row) return reply({ error: "Not found" }, 404);
      return reply({ ok: true, plan: row });
    }

    if (action === "create_plan") {
      const patch = normaliseInput(body);
      if (!patch.title) return reply({ error: "title required" }, 400);

      const status = body.status || "draft";
      if (!STATUSES.has(status)) return reply({ error: `Invalid status: ${status}` }, 400);

      const row = {
        tenant_id: tenantId,
        status,
        ...patch,
        ...(status === "active" ? { activated_at: new Date().toISOString() } : {}),
      };

      const res = await fetch(`${sbUrl}/rest/v1/campaign_plans`, {
        method:  "POST",
        headers: { ...sbHeaders(sbKey), Prefer: "return=representation" },
        body:    JSON.stringify(row),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return reply({ error: `Insert failed: ${res.status} ${text.slice(0, 200)}` }, 502);
      }
      const [created] = await res.json();
      return reply({ ok: true, plan: created });
    }

    if (action === "update_plan") {
      const { id } = body;
      if (!id) return reply({ error: "id required" }, 400);
      const patch = normaliseInput(body);
      if (Object.keys(patch).length === 0) {
        return reply({ error: "no patchable fields supplied" }, 400);
      }
      patch.updated_at = new Date().toISOString();

      const qs = new URLSearchParams({
        id:        `eq.${id}`,
        tenant_id: `eq.${tenantId}`,
      });
      const res = await fetch(`${sbUrl}/rest/v1/campaign_plans?${qs}`, {
        method:  "PATCH",
        headers: { ...sbHeaders(sbKey), Prefer: "return=representation" },
        body:    JSON.stringify(patch),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return reply({ error: `Update failed: ${res.status} ${text.slice(0, 200)}` }, 502);
      }
      const rows = await res.json();
      if (rows.length === 0) return reply({ error: "Not found" }, 404);
      return reply({ ok: true, plan: rows[0] });
    }

    // Status transitions. Each is a constrained PATCH that also stamps the
    // matching timestamp column. We don't enforce legal transitions in SQL —
    // the buttons in the UI just don't show illegal options.
    if (action === "activate_plan" || action === "pause_plan" || action === "archive_plan") {
      const { id } = body;
      if (!id) return reply({ error: "id required" }, 400);

      const now = new Date().toISOString();
      const patch = { updated_at: now };
      if (action === "activate_plan") {
        patch.status       = "active";
        patch.activated_at = now;
      } else if (action === "pause_plan") {
        patch.status = "paused";
      } else {
        patch.status      = "archived";
        patch.archived_at = now;
      }

      const qs = new URLSearchParams({
        id:        `eq.${id}`,
        tenant_id: `eq.${tenantId}`,
      });
      const res = await fetch(`${sbUrl}/rest/v1/campaign_plans?${qs}`, {
        method:  "PATCH",
        headers: { ...sbHeaders(sbKey), Prefer: "return=representation" },
        body:    JSON.stringify(patch),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return reply({ error: `Status update failed: ${res.status} ${text.slice(0, 200)}` }, 502);
      }
      const rows = await res.json();
      if (rows.length === 0) return reply({ error: "Not found" }, 404);
      return reply({ ok: true, plan: rows[0] });
    }

    if (action === "delete_plan") {
      const { id } = body;
      if (!id) return reply({ error: "id required" }, 400);

      // Only drafts may be hard-deleted; active/paused/archived must be archived
      // (preserves history). Filter on status=eq.draft so a concurrent activate
      // can't race a delete past the guard.
      const qs = new URLSearchParams({
        id:        `eq.${id}`,
        tenant_id: `eq.${tenantId}`,
        status:    "eq.draft",
      });
      const res = await fetch(`${sbUrl}/rest/v1/campaign_plans?${qs}`, {
        method:  "DELETE",
        headers: { ...sbHeaders(sbKey), Prefer: "return=representation" },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return reply({ error: `Delete failed: ${res.status} ${text.slice(0, 200)}` }, 502);
      }
      const rows = await res.json();
      if (rows.length === 0) {
        return reply({ error: "Not found, or plan is not a draft (archive instead)" }, 409);
      }
      return reply({ ok: true, deleted: rows[0].id });
    }

    return reply({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[campaign-plans]", e.message);
    return reply({ error: e.message }, 500);
  }
}
