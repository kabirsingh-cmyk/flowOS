// FlowOS — Facebook Page posting via Composio
// Mirrors the LinkedIn pattern: one endpoint with action: resolve_pages + publish_now.
//
// Actions:
//   resolve_pages → returns { authors: [{urn:pageId, name, kind:"page", extra:{igUserId?}}] }
//   publish_now   → posts to a Page (text or photo). Composio injects the Page
//                   token transparently when page_id is supplied.
//
// Image flow: FACEBOOK_CREATE_PHOTO_POST takes url= directly — no upload dance.

import { executeComposioTool } from "./lib/composio.js";

export const config = { runtime: "edge" };

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// FB post id format is "{pageId}_{postId}" — public permalink works with either.
function postUrlFromId(id) {
  if (!id) return null;
  return `https://www.facebook.com/${id}`;
}

async function resolvePages(tenantId) {
  const res = await executeComposioTool(
    "FACEBOOK_LIST_MANAGED_PAGES",
    { fields: "id,name,access_token,instagram_business_account" },
    tenantId
  );
  if (res?.error) return { error: res.error };

  // Composio wraps the Graph API response variably.
  const data = res?.data || res?.value?.data || res?.value || res;
  const pages = Array.isArray(data) ? data : (data?.data || []);

  const authors = pages
    .map(p => {
      const pageId = p.id || p.page_id;
      if (!pageId) return null;
      const igUserId = p.instagram_business_account?.id || null;
      return {
        urn:  String(pageId),
        name: p.name || String(pageId),
        kind: "page",
        extra: igUserId ? { igUserId } : undefined,
      };
    })
    .filter(Boolean);

  return { authors };
}

async function publishNow({ tenantId, pageId, text, imageUrl }) {
  const input = imageUrl
    ? { page_id: pageId, url: imageUrl, message: text || "" }
    : { page_id: pageId, message: text };
  const slug = imageUrl ? "FACEBOOK_CREATE_PHOTO_POST" : "FACEBOOK_CREATE_POST";

  const out = await executeComposioTool(slug, input, tenantId);
  if (out?.error) return { error: out.error };

  // Graph API returns { id } or { post_id }. Photo posts return { id, post_id }.
  const raw = out?.data || out?.value || out;
  const postId = raw?.post_id || raw?.id || null;

  return { postId, postUrl: postUrlFromId(postId), raw };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return reply({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); }
  catch { return reply({ error: "Invalid JSON body" }, 400); }

  const { action, tenantId } = body;
  if (!tenantId) return reply({ error: "tenantId required" }, 400);

  try {
    if (action === "resolve_pages") {
      const out = await resolvePages(tenantId);
      if (out.error) return reply({ error: out.error }, 502);
      return reply({ ok: true, authors: out.authors });
    }

    if (action === "publish_now") {
      const { pageId, text, imageUrl } = body;
      if (!pageId) return reply({ error: "pageId required" }, 400);
      if (!text && !imageUrl) return reply({ error: "text or imageUrl required" }, 400);
      if (text && text.length > 63206) return reply({ error: "text exceeds 63206 chars" }, 400);

      const out = await publishNow({ tenantId, pageId, text, imageUrl });
      if (out.error) return reply({ error: out.error }, 502);
      return reply({ ok: true, postId: out.postId, postUrl: out.postUrl, raw: out.raw });
    }

    return reply({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[FlowOS facebook]", e.message);
    return reply({ error: e.message }, 500);
  }
}
