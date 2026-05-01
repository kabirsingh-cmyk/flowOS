// FlowOS — Social / Publer proxy
// Handles: API key verification + profile fetch, post publishing
// Publer API docs: https://app.publer.io/api/v1

export const config = { runtime: "edge" };

const PUBLER_BASE = "https://app.publer.io/api/v1";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function publerFetch(path, apiKey, options = {}) {
  if (!apiKey) throw new Error("Publer API key is required");

  const res = await fetch(`${PUBLER_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    throw new Error(
      json?.message || json?.error || `Publer ${res.status}: ${text.slice(0, 300)}`
    );
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

    // ── 1. Verify Publer API key + return connected social profiles ──────────
    if (action === "verify_and_connect") {
      const { publerKey } = body;
      if (!publerKey) return reply({ error: "publerKey required" }, 400);

      const data = await publerFetch("/profiles", publerKey);
      const profiles = data?.profiles || [];

      // Map Publer profiles to our internal format
      const SUPPORTED = new Set(["instagram", "tiktok", "pinterest", "youtube", "facebook", "linkedin", "twitter"]);
      const connected = profiles
        .filter(p => SUPPORTED.has(p.social_network))
        .map(p => ({
          profileId: p.id,
          platform:  p.social_network,
          handle:    p.username || p.name || null,
          followers: p.followers ?? null,
          name:      p.name || null,
        }));

      return reply({ connected, total: profiles.length });
    }

    // ── 2. Publish a post via Publer ─────────────────────────────────────────
    if (action === "publish_post") {
      const { publerKey, profileId, platform, caption, mediaUrls, scheduledAt } = body;
      if (!publerKey)  return reply({ error: "publerKey required" }, 400);
      if (!profileId)  return reply({ error: "profileId required" }, 400);

      // Infer post type from media and platform
      let postType = "text";
      if (mediaUrls?.length > 0) {
        const url = mediaUrls[0] || "";
        const isVideo = platform === "tiktok" || platform === "youtube" ||
          url.match(/\.(mp4|mov|webm)$/i);
        postType = isVideo ? "video" : "photo";
      }

      const postBody = {
        profiles:  [profileId],
        text:      caption || "",
        post_type: postType,
      };

      // Optional: schedule
      if (scheduledAt) {
        postBody.publish_at = new Date(scheduledAt).toISOString();
      }

      // Attach media
      if (mediaUrls?.length > 0) {
        postBody.medias = mediaUrls.map(src => ({ src }));
      }

      const data = await publerFetch("/post", publerKey, {
        method: "POST",
        body: JSON.stringify(postBody),
      });

      return reply({
        success:        true,
        platformPostId: data?.post?.id || data?.id || null,
        raw:            data,
      });
    }

    // ── 3. List profiles for a validated key (lightweight refresh) ───────────
    if (action === "get_profiles") {
      const { publerKey } = body;
      if (!publerKey) return reply({ error: "publerKey required" }, 400);

      const data = await publerFetch("/profiles", publerKey);
      return reply({ profiles: data?.profiles || [] });
    }

    return reply({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error("[FlowOS social/publer]", err.message);
    return reply({ error: err.message }, 500);
  }
}
