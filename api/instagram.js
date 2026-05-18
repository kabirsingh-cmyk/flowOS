// FlowOS — Instagram posting via Composio
//
// Actions:
//   resolve_accounts → returns { authors: [{urn:igUserId, name, kind:"ig_business", extra}] }
//                      Internally calls the FACEBOOK toolkit — IG Business accounts
//                      are reachable only via their linked Facebook Pages.
//   publish_now      → two-step Graph API flow:
//                      1) INSTAGRAM_POST_IG_USER_MEDIA  (create container w/ image_url)
//                      2) INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH (publish container)
//
// Constraints:
//   - Personal IG accounts cannot post via API — must be Business or Creator
//     and linked to a managed FB Page.
//   - Image is REQUIRED (the Graph API rejects empty media containers).
//   - Caption ≤2200 chars.

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

// IG post permalink isn't returned by the Graph publish call — we can build a
// best-effort link from the media id once the post lands; for now return null
// and let the user follow up via the linked FB Page or IG app.
function postUrlFromId(_id) { return null; }

async function resolveAccounts(tenantId) {
  const res = await executeComposioTool(
    "FACEBOOK_LIST_MANAGED_PAGES",
    { fields: "id,name,instagram_business_account{id,username}" },
    tenantId
  );
  if (res?.error) return { error: res.error };

  const data = res?.data || res?.value?.data || res?.value || res;
  const pages = Array.isArray(data) ? data : (data?.data || []);

  const authors = pages
    .map(p => {
      const ig = p.instagram_business_account;
      if (!ig?.id) return null;
      return {
        urn:   String(ig.id),
        name:  ig.username ? `@${ig.username}` : (p.name ? `${p.name} · IG` : String(ig.id)),
        kind:  "ig_business",
        extra: { parentPageId: String(p.id || "") },
      };
    })
    .filter(Boolean);

  return { authors };
}

async function publishNow({ tenantId, igUserId, caption, imageUrl }) {
  // Step 1 — create media container
  const create = await executeComposioTool(
    "INSTAGRAM_POST_IG_USER_MEDIA",
    { ig_user_id: igUserId, image_url: imageUrl, caption: caption || "" },
    tenantId
  );
  if (create?.error) return { error: `create container: ${create.error}` };

  const createRaw = create?.data || create?.value || create;
  const creationId = createRaw?.id || createRaw?.creation_id;
  if (!creationId) return { error: "container create returned no id" };

  // Step 2 — publish
  const pub = await executeComposioTool(
    "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
    { ig_user_id: igUserId, creation_id: String(creationId) },
    tenantId
  );
  if (pub?.error) return { error: `publish: ${pub.error}` };

  const pubRaw = pub?.data || pub?.value || pub;
  const postId = pubRaw?.id || null;

  return {
    creationId: String(creationId),
    postId,
    postUrl: postUrlFromId(postId),
    raw: pubRaw,
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
    if (action === "resolve_accounts") {
      const out = await resolveAccounts(tenantId);
      if (out.error) return reply({ error: out.error }, 502);
      return reply({ ok: true, authors: out.authors });
    }

    if (action === "publish_now") {
      const { igUserId, caption, imageUrl } = body;
      if (!igUserId) return reply({ error: "igUserId required" }, 400);
      if (!imageUrl) return reply({ error: "Instagram requires an image — imageUrl missing" }, 400);
      if (caption && caption.length > 2200) return reply({ error: "caption exceeds 2200 chars" }, 400);

      const out = await publishNow({ tenantId, igUserId, caption, imageUrl });
      if (out.error) return reply({ error: out.error }, 502);
      return reply({
        ok: true,
        postId:     out.postId,
        postUrl:    out.postUrl,
        creationId: out.creationId,
        raw:        out.raw,
      });
    }

    return reply({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[FlowOS instagram]", e.message);
    return reply({ error: e.message }, 500);
  }
}
