// FlowOS — Google Ads OAuth endpoint (REMOVED)
// Tombstone left in place to give stale browser bookmarks and any in-flight
// OAuth redirects a clear signal instead of a generic 404.
//
// Google Ads now connects through Composio managed OAuth via the unified
// /api/composio initiate flow. Users with an existing direct-API connection
// must reconnect; their old refresh_token in google_ads_tokens is no longer
// read by the runtime. The google_ads_tokens table can be dropped once the
// hard-cutover window has passed and no tenant is mid-reconnect.

export const config = { runtime: "edge" };

export default async function handler() {
  return new Response(JSON.stringify({
    ok:    false,
    error: "Google Ads OAuth has moved to Composio. Reconnect from Settings → Connections.",
    code:  "GONE_USE_COMPOSIO",
  }), {
    status:  410,
    headers: { "Content-Type": "application/json" },
  });
}
