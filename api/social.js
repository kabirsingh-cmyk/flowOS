// FlowOS — Social / Composio v3 proxy
// Handles: OAuth connection initiation, status check, post publishing
// Composio v3 API: https://backend.composio.dev/api/v3

export const config = { runtime: "edge" };

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";

// Composio toolkit slugs (used to look up auth_config_id automatically)
const PLATFORM_TOOLKIT = {
  instagram: "instagram",
  tiktok:    "tiktok",
  pinterest: "pinterest",
  youtube:   "youtube",
};

// Composio v3 action names for creating posts
// Full list: composio.dev/app → Tools → filter by toolkit
const PLATFORM_POST_ACTION = {
  instagram: "INSTAGRAM_CREATE_MEDIA_CONTAINER",
  tiktok:    "TIKTOK_CREATE_VIDEO_POST",
  pinterest: "PINTEREST_CREATE_PIN",
  youtube:   "YOUTUBE_UPLOAD_VIDEO",
};

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function composioFetch(path, options = {}) {
  const key = process.env.COMPOSIO_API_KEY;
  if (!key) throw new Error("COMPOSIO_API_KEY not set in Vercel environment variables");

  const res = await fetch(`${COMPOSIO_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    throw new Error(json?.message || json?.error || `Composio ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

// Fetch the auth_config_id for a given toolkit slug (e.g. "instagram")
// Composio v3 requires an auth_config_id when creating connection links.
async function getAuthConfigId(toolkitSlug) {
  const data = await composioFetch(`/auth_configs?toolkit_slugs=${toolkitSlug}&limit=1`);
  const item = data?.items?.[0];
  if (!item?.id) {
    throw new Error(
      `No auth config found for ${toolkitSlug}. ` +
      `Set one up at app.composio.dev → Auth Configs → New → select ${toolkitSlug}.`
    );
  }
  return item.id;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const reply = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const { action } = body;

    // ── 1. Initiate OAuth connection (v3) ───────────────────────────────────
    if (action === "initiate_connect") {
      const { platform, userId, redirectUri } = body;
      const toolkit = PLATFORM_TOOLKIT[platform];
      if (!toolkit) return reply({ error: `Unknown platform: ${platform}` }, 400);

      // v3 requires an auth_config_id — look it up by toolkit slug
      const authConfigId = await getAuthConfigId(toolkit);

      const data = await composioFetch("/connected_accounts/link", {
        method: "POST",
        body: JSON.stringify({
          auth_config_id: authConfigId,
          user_id:        `flowos_${userId}`,
          callback_url:   redirectUri || "https://flow-os-v2.vercel.app",
        }),
      });

      return reply({
        redirectUrl:  data.redirect_url,
        connectionId: data.connected_account_id,
        status:       data.status || "INITIATED",
      });
    }

    // ── 2. Check connection status (v3) ─────────────────────────────────────
    if (action === "connection_status") {
      const { connectionId } = body;
      if (!connectionId) return reply({ error: "connectionId required" }, 400);

      // v3: GET /connected_accounts?connected_account_ids=...
      const data = await composioFetch(
        `/connected_accounts?connected_account_ids=${encodeURIComponent(connectionId)}&limit=1`
      );
      const item = data?.items?.[0];

      return reply({
        status:            item?.status || "UNKNOWN",
        handle:            item?.display_name || item?.user_id || null,
        followers:         item?.meta?.followers_count || null,
        platformAccountId: item?.meta?.id || null,
      });
    }

    // ── 3. List connections for a user (v3) ─────────────────────────────────
    if (action === "list_connections") {
      const { userId } = body;
      const data = await composioFetch(
        `/connected_accounts?user_ids=${encodeURIComponent(`flowos_${userId}`)}&statuses=ACTIVE`
      );
      return reply({ connections: data?.items || [] });
    }

    // ── 4. Publish a post (v3) ──────────────────────────────────────────────
    if (action === "publish_post") {
      const { platform, connectionId, caption, mediaUrls, postType } = body;
      const actionName = PLATFORM_POST_ACTION[platform];
      if (!actionName) return reply({ error: `No post action for platform: ${platform}` }, 400);

      // Build platform-specific arguments (v3 uses "arguments" not "input")
      let args = {};
      if (platform === "instagram") {
        args = {
          caption,
          image_url:  mediaUrls?.[0] || null,
          media_type: postType === "Reel" ? "REELS" : "IMAGE",
        };
      } else if (platform === "tiktok") {
        args = { video_url: mediaUrls?.[0] || null, title: caption?.slice(0, 150) || "" };
      } else if (platform === "pinterest") {
        args = {
          title:       caption?.slice(0, 100) || "",
          description: caption || "",
          image_url:   mediaUrls?.[0] || null,
        };
      } else if (platform === "youtube") {
        args = {
          title:       caption?.slice(0, 100) || "New video",
          description: caption || "",
          video_url:   mediaUrls?.[0] || null,
        };
      }

      // v3: POST /tools/execute/:action
      const data = await composioFetch(`/tools/execute/${actionName}`, {
        method: "POST",
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: args,
        }),
      });

      return reply({
        success:        data?.status === "success" || data?.data != null,
        platformPostId: data?.data?.id || data?.data?.media_id || data?.data?.pin_id || null,
        raw:            data,
      });
    }

    return reply({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error("[FlowOS social]", err.message);
    return reply({ error: err.message }, 500);
  }
}
