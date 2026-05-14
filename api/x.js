// FlowOS — X (Twitter) posting via Composio
// Single authenticated user — no author picker.
//
// Actions:
//   publish_now → posts a tweet, optionally attaching one image.
//
// Image flow:
//   1) Fetch source image bytes
//   2) TWITTER_UPLOAD_MEDIA with base64 → { media_id_string }
//   3) TWITTER_CREATION_OF_A_POST with text + media_media_ids:[id]

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

function postUrlFromId(id) {
  if (!id) return null;
  return `https://x.com/i/web/status/${id}`;
}

async function uploadMedia({ tenantId, imageUrl }) {
  const srcRes = await fetch(imageUrl);
  if (!srcRes.ok) return { error: `fetch image ${srcRes.status}` };
  const bytes = await srcRes.arrayBuffer();

  // Convert to base64 in chunks to avoid stack overflow on large buffers
  const u8 = new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);

  const out = await executeComposioTool(
    "TWITTER_UPLOAD_MEDIA",
    { media_data: b64 },
    tenantId
  );
  if (out?.error) return { error: `upload: ${out.error}` };

  const raw = out?.data || out?.value || out;
  const mediaId = raw?.media_id_string || raw?.media_id || raw?.id;
  if (!mediaId) return { error: "upload returned no media_id" };
  return { mediaId: String(mediaId) };
}

async function publishNow({ tenantId, text, imageUrl }) {
  let mediaIds;
  if (imageUrl) {
    const up = await uploadMedia({ tenantId, imageUrl });
    if (up.error) return { error: up.error };
    mediaIds = [up.mediaId];
  }

  const input = { text };
  if (mediaIds) input.media_media_ids = mediaIds;

  const out = await executeComposioTool("TWITTER_CREATION_OF_A_POST", input, tenantId);
  if (out?.error) return { error: out.error };

  const raw = out?.data || out?.value || out;
  const postId = raw?.id || raw?.data?.id || null;
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
    if (action === "publish_now") {
      const { text, imageUrl } = body;
      if (!text) return reply({ error: "text required" }, 400);
      if (text.length > 280) return reply({ error: "text exceeds 280 chars" }, 400);

      const out = await publishNow({ tenantId, text, imageUrl });
      if (out.error) return reply({ error: out.error }, 502);
      return reply({ ok: true, postId: out.postId, postUrl: out.postUrl, raw: out.raw });
    }

    return reply({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[FlowOS x]", e.message);
    return reply({ error: e.message }, 500);
  }
}
