/**
 * FlowOS — Zernio platform mapping
 *
 * Single source of truth for FlowOS connector ID ↔ Zernio platform slug.
 * Both api/zernio.js and api/paid-social.js (and anything else routing through
 * Zernio) should import from this module — never redeclare these maps locally.
 *
 * Reference: https://docs.zernio.com (confirmed 2026-05-24).
 */

/**
 * FlowOS short connector IDs → Zernio platform slugs.
 * workspaces4.jsx always sends connector.id as `app`; resolve here before
 * hitting any Zernio endpoint.
 */
export const PLATFORM_ID_MAP = {
  // Organic social
  fb:        "facebook",
  ig:        "instagram",
  li:        "linkedin",
  tt:        "tiktok",
  pn:        "pinterest",
  yt:        "youtube",
  x:         "twitter",        // Zernio uses "twitter" not "x"
  gbusiness: "googlebusiness",
  // Paid social
  liads:  "linkedinads",
  ttads:  "tiktokads",
  pinads: "pinterestads",
  // metaads, xads, googleads: same in both — no entry needed
};

/**
 * Reverse map: Zernio slug → FlowOS short ID.
 * channels.platform stores FlowOS short IDs; some callers (thin platform
 * proxies, paid-social.js) pass resolved Zernio slugs — this maps them back
 * for DB lookups.
 */
export const ZERNIO_TO_FLOWOS = {
  // Organic
  facebook:       "fb",
  instagram:      "ig",
  linkedin:       "li",
  tiktok:         "tt",
  pinterest:      "pn",
  youtube:        "yt",
  twitter:        "x",
  googlebusiness: "gbusiness",
  // Paid social
  linkedinads:    "liads",
  tiktokads:      "ttads",
  pinterestads:   "pinads",
  // metaads, xads, googleads: same in both
};

/**
 * Resolved Zernio ad slug → organic platform name used in
 * GET /v1/connect/{platform}/ads.
 *
 * Same-token platforms (metaads, linkedinads, pinterestads) return
 * { alreadyConnected, accountId } immediately because Zernio copies the
 * existing organic token. Separate-token platforms (tiktokads, xads,
 * googleads) start a fresh OAuth and return { authUrl }.
 */
export const ADS_TO_ORGANIC = {
  metaads:      "facebook",
  linkedinads:  "linkedin",
  tiktokads:    "tiktok",
  xads:         "twitter",
  pinterestads: "pinterest",
  googleads:    "googleads",
};

/**
 * Paid-social platforms whose ads endpoints under /v1/ads/* accept the
 * organic platform name (e.g. "meta", "linkedin") instead of the ads-specific
 * slug ("metaads", "linkedinads"). Used by paid-social.js for ads/create,
 * ads/campaigns, ads/{id}, etc.
 */
export const ADS_TO_ORGANIC_SHORT = {
  metaads: "meta",
  liads:   "linkedin",
  ttads:   "tiktok",
  xads:    "twitter",
  pinads:  "pinterest",
};

export const SUPPORTED_PLATFORMS = new Set([
  // Organic — FlowOS short IDs
  "fb", "ig", "li", "tt", "pn", "yt", "x", "gbusiness",
  // Organic — Zernio slugs
  "facebook", "instagram", "linkedin", "tiktok", "pinterest", "youtube",
  "twitter", "reddit", "bluesky", "threads", "googlebusiness",
  "whatsapp", "telegram", "snapchat", "discord",
  // Paid social — FlowOS IDs
  "metaads", "liads", "ttads", "xads", "pinads",
  // Paid social — Zernio slugs
  "linkedinads", "tiktokads", "pinterestads",
  // Paid search
  "googleads",
]);

export const SUPPORTED_PAID_PLATFORMS = new Set([
  "metaads", "liads", "ttads", "xads", "pinads",
]);

/**
 * Resolve a FlowOS short connector ID (or pass-through Zernio slug) to the
 * Zernio platform slug used in /v1/connect/{platform}, /v1/accounts, /v1/posts,
 * and most other endpoints.
 */
export function resolvePlatform(id) {
  if (!id) return id;
  const lower = String(id).toLowerCase();
  return PLATFORM_ID_MAP[lower] || lower;
}

/**
 * Resolve a Zernio platform slug back to the FlowOS short ID used as the
 * channels.platform key in Supabase.
 */
export function flowOSId(platform) {
  if (!platform) return platform;
  const lower = String(platform).toLowerCase();
  return ZERNIO_TO_FLOWOS[lower] || lower;
}

/**
 * Resolve a FlowOS paid-social ID to the ORGANIC platform name used by
 * /v1/ads/* endpoints. Returns null if the id isn't a known paid-social ID.
 *
 * Use this in paid-social.js — Zernio's ads endpoints accept "meta" / "tiktok"
 * etc. in the `platform` field, not "metaads" / "tiktokads".
 */
export function resolveAdsPlatform(id) {
  if (!id) return null;
  const lower = String(id).toLowerCase();
  return ADS_TO_ORGANIC_SHORT[lower] || null;
}
