// FlowOS — Social / Composio proxy
// Handles: OAuth connection initiation, connection status, post publishing
// Keeps COMPOSIO_API_KEY server-side. All calls go through this edge function.

export const config = { runtime: "edge" };

const COMPOSIO_BASE = "https://backend.composio.dev/api/v1";

// Composio integration slugs — verify at composio.dev/app/connections
const PLATFORM_INTEGRATION = {
  instagram: "instagram",
  tiktok:    "tiktok",
  pinterest: "pinterest",
  youtube:   "youtube",
};

// Composio action names for creating a post on each platform
// Full list: composio.dev/app/actions — filter by platform
const PLATFORM_POST_ACTION = {
  instagram: "INSTAGRAM_CREATE_PHOTO_MEDIA_OBJECT",
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
    throw new Error(json?.message || json?.error || `Composio ${res.status}: ${text.slice(0, 200)}`);
  }
  return json;
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
  catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: CORS }); }

  const reply = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const { action } = body;

    // ── 1. Initiate OAuth connection ────────────────────────────────────────
    // Returns a redirectUrl to open in a new window for the user to authorize.
    if (action === "initiate_connect") {
      const { platform, userId, redirectUri } = body;
      const integrationId = PLATFORM_INTEGRATION[platform];
      if (!integrationId) return reply({ error: `Unknown platform: ${platform}` }, 400);

      const data = await composioFetch("/connectedAccounts", {
        method: "POST",
        body: JSON.stringify({
          integrationId,
          entityId: `flowos_${userId}`,  // unique per user
          redirectUri: redirectUri || "https://flow-os-v2.vercel.app",
        }),
      });

      return reply({
        redirectUrl:  data.redirectUrl,
        connectionId: data.connectedAccountId,
        status:       data.connectionStatus,
      });
    }

    // ── 2. Check connection status ──────────────────────────────────────────
    // Call after the user completes OAuth to confirm it went through.
    if (action === "connection_status") {
      const { connectionId } = body;
      if (!connectionId) return reply({ error: "connectionId required" }, 400);

      const data = await composioFetch(`/connectedAccounts/${connectionId}`);
      return reply({
        status:            data.status,                           // "ACTIVE" | "INITIATED" | ...
        handle:            data.accountMeta?.username
                        || data.accountMeta?.handle
                        || data.displayName
                        || null,
        followers:         data.accountMeta?.followers_count || null,
        platformAccountId: data.accountMeta?.id || data.entityId || null,
      });
    }

    // ── 3. List connected accounts for a user ───────────────────────────────
    if (action === "list_connections") {
      const { userId } = body;
      const data = await composioFetch(`/connectedAccounts?entityId=flowos_${userId}`);
      return reply({ connections: data.items || data.connectedAccounts || [] });
    }

    // ── 4. Publish a post ───────────────────────────────────────────────────
    // Calls the platform-specific Composio action to create the post.
    if (action === "publish_post") {
      const { platform, connectionId, caption, mediaUrls, postType } = body;

      const actionName = PLATFORM_POST_ACTION[platform];
      if (!actionName) return reply({ error: `No post action for platform: ${platform}` }, 400);

      // Build platform-specific input payload
      let input = {};
      if (platform === "instagram") {
        input = {
          image_url:  mediaUrls?.[0] || null,
          caption,
          media_type: postType === "Reel" ? "REELS" : "IMAGE",
        };
      } else if (platform === "tiktok") {
        input = {
          video_url: mediaUrls?.[0] || null,
          title:     caption?.slice(0, 150) || "",
        };
      } else if (platform === "pinterest") {
        input = {
          title:       caption?.slice(0, 100) || "",
          description: caption || "",
          image_url:   mediaUrls?.[0] || null,
        };
      } else if (platform === "youtube") {
        input = {
          title:       caption?.slice(0, 100) || "New video",
          description: caption || "",
          video_url:   mediaUrls?.[0] || null,
        };
      }

      const data = await composioFetch(`/actions/${actionName}/execute`, {
        method: "POST",
        body: JSON.stringify({
          connectedAccountId: connectionId,
          input,
        }),
      });

      return reply({
        success:        data.successfull ?? data.success ?? true,
        platformPostId: data.data?.id || data.data?.media_id || data.data?.pin_id || null,
        raw:            data,
      });
    }

    return reply({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error("[FlowOS social]", err.message);
    return reply({ error: err.message }, 500);
  }
}
