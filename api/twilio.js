/**
 * FlowOS — Twilio connector REMOVED
 * Connector removed from catalog. Route kept as 410 tombstone.
 * SMS: Klaviyo SMS.
 */
export const config = { runtime: "edge" };
export default function handler() {
  return new Response(JSON.stringify({ error: "Twilio connector removed. Use Klaviyo SMS.", code: "GONE" }), {
    status: 410, headers: { "Content-Type": "application/json" },
  });
}
