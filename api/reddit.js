// FlowOS — Reddit posting via Composio
//
// Actions:
//   search_subreddits → keyword search (Composio exposes no mine/* listing,
//                       so the drawer uses a free-text input + optional typeahead)
//   publish_now       → submit a self (text) or link post
//
// Image limitation: Composio does NOT expose kind:"image" submission. When an
// imageUrl is supplied we fall back to kind:"link" with the hosted image URL
// as the submission target, and surface { imageAsLink: true } so the drawer
// can show a warn toast. Body text is dropped for link posts (Reddit doesn't
// attach a selftext to link submissions).

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

function postUrlFromResult(raw, subreddit) {
  // Reddit /api/submit returns { json: { data: { url, id, name } } }
  const data = raw?.json?.data || raw?.data || raw;
  if (data?.url) return data.url;
  const id = data?.id || data?.name;
  if (id && subreddit) {
    const bare = String(id).replace(/^t3_/, "");
    return `https://www.reddit.com/r/${subreddit}/comments/${bare}/`;
  }
  return null;
}

function extractPostId(raw) {
  const data = raw?.json?.data || raw?.data || raw;
  const id = data?.id || data?.name;
  return id ? String(id).replace(/^t3_/, "") : null;
}

async function searchSubreddits(tenantId, query) {
  const out = await executeComposioTool(
    "REDDIT_GET_SUBREDDITS_SEARCH",
    { q: query, limit: 10 },
    tenantId
  );
  if (out?.error) return { error: out.error };

  const raw = out?.data || out?.value || out;
  const children = raw?.data?.children || raw?.children || [];
  const subs = children
    .map(c => c?.data?.display_name || c?.display_name)
    .filter(Boolean);

  return { subreddits: subs };
}

async function publishNow({ tenantId, subreddit, title, text, imageUrl }) {
  const sub = String(subreddit).replace(/^\/?r\//, "").trim();
  if (!sub) return { error: "subreddit required" };
  if (!title || !title.trim()) return { error: "title required" };

  const imageAsLink = !!imageUrl;
  const input = imageAsLink
    ? { subreddit: sub, title: title.trim(), kind: "link", url: imageUrl }
    : { subreddit: sub, title: title.trim(), kind: "self", text: text || "" };

  const out = await executeComposioTool("REDDIT_CREATE_REDDIT_POST", input, tenantId);
  if (out?.error) return { error: out.error };

  const raw = out?.data || out?.value || out;
  return {
    postId:  extractPostId(raw),
    postUrl: postUrlFromResult(raw, sub),
    imageAsLink,
    raw,
  };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return reply({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); }
  catch { return reply({ error: "Invalid JSON body" }, 400); }

  const { tenantId: bodyTenantId } = body;
  const auth = await requireAuthOrCron(req, bodyTenantId);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;
  const { action } = body;

  try {
    if (action === "search_subreddits") {
      const { query } = body;
      if (!query) return reply({ error: "query required" }, 400);
      const out = await searchSubreddits(tenantId, query);
      if (out.error) return reply({ error: out.error }, 502);
      return reply({ ok: true, subreddits: out.subreddits });
    }

    if (action === "publish_now") {
      const { subreddit, title, text, imageUrl } = body;
      if (!subreddit) return reply({ error: "subreddit required" }, 400);
      if (!title)     return reply({ error: "title required" }, 400);
      if (title.length > 300) return reply({ error: "title exceeds 300 chars" }, 400);
      if (text && text.length > 40000) return reply({ error: "text exceeds 40000 chars" }, 400);

      const out = await publishNow({ tenantId, subreddit, title, text, imageUrl });
      if (out.error) return reply({ error: out.error }, 502);
      return reply({
        ok: true,
        postId: out.postId,
        postUrl: out.postUrl,
        imageAsLink: out.imageAsLink,
        raw: out.raw,
      });
    }

    return reply({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[FlowOS reddit]", e.message);
    return reply({ error: e.message }, 500);
  }
}
