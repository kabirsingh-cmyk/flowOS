/**
 * FlowOS Reach — Zernio webhook receiver
 * Vercel Edge Function: POST /api/webhooks/zernio
 *
 * Receives real-time events from Zernio for messages, comments, reactions,
 * reviews, and post status updates.
 *
 * Security:
 *   - Verifies HMAC-SHA256 signature in X-Zernio-Signature header
 *   - Uses ZERNIO_WEBHOOK_SECRET env var
 *
 * Events handled:
 *   message.received  → inbox_events (event_type: dm)
 *   comment.received  → inbox_events (event_type: comment)
 *   reaction.received → inbox_events (event_type: reaction)
 *   review.new        → inbox_events (event_type: review)
 *   post.published    → scheduled_posts status = published
 *   post.failed       → scheduled_posts status = failed
 *   webhook.test      → { ok: true, echo: true }
 *
 * Design notes:
 *   - Returns 200 on processing errors so Zernio does not retry and create
 *     duplicates. Only 401 is returned for invalid signatures.
 *   - Uses Supabase service-role key (no user JWT on webhooks).
 */

export const config = { runtime: "edge" };

function sbHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function verifySignature(payload, signature, secret) {
  const prefix = "sha256=";
  if (!signature || !signature.startsWith(prefix)) return false;
  const expected = signature.slice(prefix.length);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === expected;
}

function computeRisk(eventType, data) {
  if (eventType === "review") {
    const rating = data?.rating ?? data?.review_rating;
    if (typeof rating === "number" && rating < 3) return "high";
  }
  if (eventType === "reaction") return "low";
  return "medium";
}

async function handleInboxEvent(sbUrl, sbKey, tenantId, eventType, data) {
  const platform = data?.platform || "unknown";
  const externalId =
    data?.message_id ||
    data?.comment_id ||
    data?.reaction_id ||
    data?.review_id ||
    data?.id ||
    null;
  const authorName = data?.author?.name || data?.from?.name || null;
  const authorHandle =
    data?.author?.handle ||
    data?.author?.username ||
    data?.from?.username ||
    data?.from?.handle ||
    null;
  const text =
    data?.text || data?.message || data?.content || data?.body || null;
  const sourceUrl =
    data?.post_url ||
    data?.thread_url ||
    data?.url ||
    data?.permalink ||
    null;

  const row = {
    tenant_id: tenantId,
    event_type: eventType,
    platform,
    external_id: externalId,
    author_name: authorName,
    author_handle: authorHandle,
    text,
    risk: computeRisk(eventType, data),
    status: "open",
    source_url: sourceUrl,
    raw: data,
  };

  const res = await fetch(`${sbUrl}/rest/v1/inbox_events`, {
    method: "POST",
    headers: { ...sbHeaders(sbKey), Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const textErr = await res.text().catch(() => "");
    console.error("[zernio-webhook] inbox insert failed:", res.status, textErr);
  }

  return json({ ok: true });
}

// ─── lead.received ───────────────────────────────────────────────────────────
// Upserts into leads_cache and optionally surfaces in inbox_events so the
// InboxEscalation view (Track B) picks it up without code changes.

async function handleLeadReceived(sbUrl, sbKey, tenantId, data) {
  const platformLeadId = data?.lead_id || data?.id || null;
  const leadFormId     = data?.form_id || data?.formId || null;
  const platform       = data?.platform || "meta";
  const payload        = data?.fields || data?.fieldData || data?.raw || data || {};

  // Normalise field extraction (handles both { fields: { email: ... } }
  // and { fieldData: [{ name: "email", values: [...] }] } shapes).
  const fieldOf = (key) => {
    if (payload[key]) return String(payload[key]);
    if (Array.isArray(payload.fieldData)) {
      const f = payload.fieldData.find(fd => String(fd?.name || "").toLowerCase().includes(key));
      return f?.values?.[0] ? String(f.values[0]) : null;
    }
    return null;
  };

  const email     = fieldOf("email");
  const fullName  = fieldOf("full_name") || fieldOf("full name") || fieldOf("name");

  // Upsert leads_cache (ON CONFLICT → update payload in case it changes).
  const leadRow = {
    tenant_id:        tenantId,
    platform,
    lead_form_id:     leadFormId,
    platform_lead_id: platformLeadId,
    payload:          JSON.stringify(payload),
  };

  const upsertRes = await fetch(
    `${sbUrl}/rest/v1/leads_cache?on_conflict=tenant_id,platform,platform_lead_id`, {
    method: "POST",
    headers: { ...sbHeaders(sbKey), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(leadRow),
  });
  if (!upsertRes.ok) {
    const textErr = await upsertRes.text().catch(() => "");
    console.error("[zernio-webhook] leads_cache upsert failed:", upsertRes.status, textErr);
  }

  // Also append to inbox_events so InboxEscalation surfaces the lead.
  const inboxRow = {
    tenant_id:     tenantId,
    event_type:    "lead",
    platform,
    external_id:   platformLeadId,
    author_name:   fullName || null,
    author_handle: email || null,
    text:          `Lead from ${platform} form ${leadFormId || ""}`,
    risk:          "medium",
    status:        "open",
    raw:           JSON.stringify(data),
  };

  const inboxRes = await fetch(`${sbUrl}/rest/v1/inbox_events`, {
    method: "POST",
    headers: sbHeaders(sbKey),
    body: JSON.stringify(inboxRow),
  });
  if (!inboxRes.ok) {
    const textErr = await inboxRes.text().catch(() => "");
    console.error("[zernio-webhook] inbox_events insert failed:", inboxRes.status, textErr);
  }

  return json({ ok: true });
}

async function handlePostStatus(sbUrl, sbKey, tenantId, status, data) {
  const externalId =
    data?.post_id ||
    data?.schedule_id ||
    data?.external_id ||
    data?.id ||
    null;
  if (!externalId) {
    return json({ ok: true, skipped: true, reason: "no external_id" });
  }

  const qs = new URLSearchParams({
    tenant_id: `eq.${tenantId}`,
    external_id: `eq.${externalId}`,
  });

  const res = await fetch(`${sbUrl}/rest/v1/scheduled_posts?${qs}`, {
    method: "PATCH",
    headers: sbHeaders(sbKey),
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const textErr = await res.text().catch(() => "");
    console.error(
      "[zernio-webhook] scheduled_posts patch failed:",
      res.status,
      textErr,
    );
  }

  return json({ ok: true });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Zernio-Signature",
      },
    });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "POST required" }, 405);
  }

  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[zernio-webhook] ZERNIO_WEBHOOK_SECRET not set");
    return json({ ok: false, error: "Not configured" }, 200);
  }

  const signature =
    req.headers.get("x-zernio-signature") ||
    req.headers.get("X-Zernio-Signature");
  const rawBody = await req.text();

  if (!signature || !(await verifySignature(rawBody, signature, secret))) {
    return json({ ok: false, error: "Invalid signature" }, 401);
  }

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) {
    console.error("[zernio-webhook] Supabase env vars not set");
    return json({ ok: false, error: "Not configured" }, 200);
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { event, data } = body;

  if (event === "webhook.test") {
    return json({ ok: true, echo: true });
  }

  const tenantId = data?.external_user_id || body?.external_user_id;
  if (!tenantId) {
    console.error("[zernio-webhook] Missing external_user_id");
    return json({ ok: false, error: "Missing tenant id" }, 200);
  }

  switch (event) {
    case "message.received":
      return handleInboxEvent(sbUrl, sbKey, tenantId, "dm", data);
    case "comment.received":
      return handleInboxEvent(sbUrl, sbKey, tenantId, "comment", data);
    case "reaction.received":
      return handleInboxEvent(sbUrl, sbKey, tenantId, "reaction", data);
    case "review.new":
      return handleInboxEvent(sbUrl, sbKey, tenantId, "review", data);
    case "post.published":
      return handlePostStatus(sbUrl, sbKey, tenantId, "published", data);
    case "lead.received":
      return handleLeadReceived(sbUrl, sbKey, tenantId, data);
    case "post.failed":
      return handlePostStatus(sbUrl, sbKey, tenantId, "failed", data);
    default:
      console.log("[zernio-webhook] Ignored event:", event);
      return json({ ok: true, ignored: true });
  }
}
