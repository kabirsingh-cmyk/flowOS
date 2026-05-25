/**
 * REMOVED — 410 Gone tombstone
 *
 * Pipedream Connect has been removed from FlowOS as of 2026-05-24.
 *
 * Migration:
 *   - Pinterest (pn, pinads) → /api/zernio  (provider: "zernio")
 *   - Runware                → /api/runware  (provider: "direct")
 *
 * Env vars that are no longer read:
 *   PIPEDREAM_PROJECT_ID, PIPEDREAM_CLIENT_ID,
 *   PIPEDREAM_CLIENT_SECRET, PIPEDREAM_ENVIRONMENT
 */

export const config = { runtime: "edge" };

export default function handler() {
  return new Response(
    JSON.stringify({
      error: "Pipedream Connect has been removed from FlowOS. Social platforms now use /api/zernio.",
      code:  "GONE_USE_ZERNIO",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  );
}
