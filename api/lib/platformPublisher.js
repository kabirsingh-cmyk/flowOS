/**
 * Shared platform-proxy factory for the five Zernio social publishers.
 *
 * Usage:
 *   import { createPlatformHandler } from "./lib/platformPublisher.js";
 *   export const config = { runtime: "edge" };
 *   export default createPlatformHandler("linkedin", { resolveAction: "resolve_author" });
 *
 * Options:
 *   resolveAction  — incoming action name that aliases to "resolve_authors" in Zernio.
 *                    e.g. "resolve_author" (LinkedIn), "resolve_pages" (Facebook),
 *                    "resolve_accounts" (Instagram). Omit if the platform has no resolve step.
 *   validate(action, body) → string | null
 *                    Platform-specific validation before forwarding. Return an error
 *                    string to reject, or null to proceed.
 *   extraActions   — { [actionName]: (body, req) => Response }
 *                    Platform-specific actions that don't forward to Zernio.
 *                    e.g. Reddit's search_subreddits stub.
 */

import { requireAuthOrCron } from "./auth.js";
import { corsHeaders, corsPreflightResponse, errResponse } from "./cors.js";

export async function forwardToZernio(req, body) {
  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/zernio`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  req.headers.get("Authorization") || req.headers.get("authorization") || "",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return new Response(JSON.stringify(data), {
    status:  res.status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export function createPlatformHandler(platform, opts = {}) {
  const { resolveAction, validate, extraActions = {} } = opts;

  // Build the supported actions list for error messages
  const supported = [
    ...Object.keys(extraActions),
    ...(resolveAction ? [resolveAction] : []),
    "publish_now",
  ];

  return async function handler(req) {
    if (req.method === "OPTIONS") return corsPreflightResponse();
    if (req.method !== "POST") return errResponse("POST required", 405);

    let body;
    try { body = await req.json(); } catch { return errResponse("Invalid JSON body", 400); }

    const { tenantId: bodyTenantId } = body;
    const auth = await requireAuthOrCron(req, bodyTenantId);
    if (auth instanceof Response) return auth;
    body = { ...body, tenantId: auth.tenantId };

    const { action } = body;

    // Extra platform-specific actions (e.g. Reddit's search_subreddits stub)
    if (extraActions[action]) {
      return extraActions[action](body, req);
    }

    // resolve_* aliases → resolve_authors
    if (resolveAction && action === resolveAction) {
      return forwardToZernio(req, { ...body, action: "resolve_authors", platform });
    }

    if (action === "publish_now") {
      if (validate) {
        const err = validate(action, body);
        if (err) return errResponse(err, 400);
      }
      return forwardToZernio(req, { ...body, platform });
    }

    return errResponse(`Unknown action: ${action}. Supported: ${supported.join(", ")}`);
  };
}
