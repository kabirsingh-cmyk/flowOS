// FlowOS — LinkedIn posting via Composio
// Replaces the deleted /api/social (Publer). Direct Composio toolkit calls.
//
// Actions:
//   resolve_author  → returns { authors: [{urn, name, kind}] } for the tenant
//                     kind ∈ "person" | "organization"
//   publish_now     → posts to LinkedIn (person or organization) with optional image
//
// Image flow (when imageUrl provided):
//   1) LINKEDIN_INITIALIZE_IMAGE_UPLOAD with owner URN → { uploadUrl, image (asset URN) }
//   2) fetch imageUrl bytes, PUT to uploadUrl
//   3) LINKEDIN_CREATE_LINKED_IN_POST with author + commentary + images:[assetUrn]
//
// Scheduling is intentionally not implemented here — see /BACKLOG.md.

import { executeComposioTool } from "./lib/composio.js";
import { requireAuthOrCron }   from "./lib/auth.js";

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

// LinkedIn share URN → public feed URL
// Composio returns shapes like { id: "urn:li:share:7..." } or { id: "7..." }.
function postUrlFromId(id) {
  if (!id) return null;
  const urn = id.startsWith("urn:li:") ? id : `urn:li:share:${id}`;
  return `https://www.linkedin.com/feed/update/${urn}/`;
}

function pickPersonUrn(info) {
  // LINKEDIN_GET_MY_INFO returns OpenID-shaped data — `sub` is the person id.
  if (!info) return null;
  if (info.author) return info.author;
  if (info.urn)    return info.urn;
  if (info.sub)    return `urn:li:person:${info.sub}`;
  if (info.id)     return info.id.startsWith("urn:li:") ? info.id : `urn:li:person:${info.id}`;
  return null;
}

function pickOrgUrns(companyInfo) {
  if (!companyInfo) return [];
  const elements = companyInfo.elements || companyInfo.items || companyInfo.data || [];
  return elements
    .map(el => {
      const orgId = el?.organization || el?.organizationalTarget || el?.id;
      if (!orgId) return null;
      const urn = String(orgId).startsWith("urn:li:") ? orgId : `urn:li:organization:${orgId}`;
      return { urn, name: el?.organizationName || el?.name || null };
    })
    .filter(Boolean);
}

async function resolveAuthor(tenantId) {
  const info = await executeComposioTool("LINKEDIN_GET_MY_INFO", {}, tenantId);
  if (info?.error) return { error: info.error };

  const personUrn = pickPersonUrn(info);

  // Try to list managed organizations. If the tool 404s or the scope isn't
  // granted, we still return the person URN — page posting just won't be available.
  const companyInfo = await executeComposioTool(
    "LINKEDIN_GET_COMPANY_INFO",
    { role: "ADMINISTRATOR", state: "APPROVED" },
    tenantId,
    { onError: "null" }
  );
  const orgUrns = pickOrgUrns(companyInfo);

  // Normalized authors[] — page authors first so the drawer's pickDefault
  // selects an organization over the person profile when both exist.
  const authors = [];
  orgUrns.forEach(o => authors.push({ urn: o.urn, name: o.name, kind: "organization" }));
  if (personUrn) {
    const personName = info?.name || info?.given_name || "Personal profile";
    authors.push({ urn: personUrn, name: personName, kind: "person" });
  }

  return { authors };
}

async function uploadImage({ tenantId, ownerUrn, imageUrl }) {
  // 1) Initialize upload
  const init = await executeComposioTool(
    "LINKEDIN_INITIALIZE_IMAGE_UPLOAD",
    { owner: ownerUrn },
    tenantId
  );
  if (init?.error) return { error: `init upload: ${init.error}` };

  // Composio wraps the response variably — value.uploadUrl is the canonical path.
  const uploadUrl =
    init?.value?.uploadUrl ||
    init?.uploadUrl ||
    init?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
  const assetUrn =
    init?.value?.image ||
    init?.image ||
    init?.asset;

  if (!uploadUrl || !assetUrn) {
    return { error: "upload init returned no uploadUrl/asset" };
  }

  // 2) Fetch source bytes
  const srcRes = await fetch(imageUrl);
  if (!srcRes.ok) return { error: `fetch image ${srcRes.status}` };
  const bytes = await srcRes.arrayBuffer();
  const contentType = srcRes.headers.get("content-type") || "image/jpeg";

  // 3) PUT bytes to LinkedIn-provided upload URL
  const put = await fetch(uploadUrl, {
    method:  "PUT",
    headers: { "Content-Type": contentType },
    body:    bytes,
  });
  if (!put.ok) {
    const text = await put.text().catch(() => "");
    return { error: `upload PUT ${put.status} ${text.slice(0, 200)}` };
  }

  return { assetUrn };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return reply({ error: "Method not allowed" }, 405);
  }

  let body;
  try { body = await req.json(); }
  catch { return reply({ error: "Invalid JSON body" }, 400); }

  // Dual-auth: user JWT (publish from drawer) OR cron secret (scheduled
  // post being fired by /api/cron/fire-scheduled with the tenant id we
  // stamped onto the row at queue time).
  const { tenantId: bodyTenantId } = body;
  const auth = await requireAuthOrCron(req, bodyTenantId);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;
  const { action } = body;

  try {
    if (action === "resolve_author") {
      const out = await resolveAuthor(tenantId);
      if (out.error) return reply({ error: out.error }, 502);
      return reply({ ok: true, authors: out.authors });
    }

    if (action === "publish_now") {
      const { authorUrn, text, imageUrl, visibility = "PUBLIC" } = body;
      if (!authorUrn) return reply({ error: "authorUrn required" }, 400);
      if (!text)      return reply({ error: "text required" }, 400);
      if (text.length > 3000) return reply({ error: "text exceeds 3000 chars" }, 400);

      let images;
      if (imageUrl) {
        const up = await uploadImage({ tenantId, ownerUrn: authorUrn, imageUrl });
        if (up.error) return reply({ error: up.error }, 502);
        images = [up.assetUrn];
      }

      const input = {
        author:         authorUrn,
        commentary:     text,
        visibility,
        lifecycleState: "PUBLISHED",
      };
      if (images) input.images = images;

      const post = await executeComposioTool("LINKEDIN_CREATE_LINKED_IN_POST", input, tenantId);
      if (post?.error) return reply({ error: post.error }, 502);

      const postId =
        post?.id ||
        post?.value?.id ||
        post?.data?.id ||
        post?.headers?.["x-restli-id"] ||
        null;

      return reply({
        ok:      true,
        postId,
        postUrl: postUrlFromId(postId),
        raw:     post,
      });
    }

    return reply({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[FlowOS linkedin]", e.message);
    return reply({ error: e.message }, 500);
  }
}
