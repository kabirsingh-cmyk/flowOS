/**
 * FlowOS Reach — SendGrid connector REMOVED
 * Connector removed from catalog. Route kept as 410 tombstone.
 * Marketing email: Klaviyo. Transactional: not wired.
 */
export const config = { runtime: "edge" };
export default function handler() {
  return new Response(JSON.stringify({ error: "SendGrid connector removed. Use Klaviyo for email.", code: "GONE" }), {
    status: 410, headers: { "Content-Type": "application/json" },
  });
}
