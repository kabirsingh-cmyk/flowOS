/**
 * FlowOS — CORS helper for /api/* edge handlers
 *
 * Restricts the Access-Control-Allow-Origin header to the APP_ORIGIN env var.
 * If APP_ORIGIN is not set the header is omitted entirely — no wildcard fallback.
 * Set APP_ORIGIN=* explicitly in .env.local if you need permissive CORS in dev.
 *
 * Usage:
 *   import { corsHeaders, corsPreflightResponse, withCors } from "./lib/cors.js";
 *
 *   export default function handler(req) {
 *     if (req.method === "OPTIONS") return corsPreflightResponse();
 *     const body = ...;
 *     return new Response(JSON.stringify(body), {
 *       headers: { "Content-Type": "application/json", ...corsHeaders() },
 *     });
 *   }
 */

export function corsHeaders() {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age":       "86400",
  };
  const origin = process.env.APP_ORIGIN;
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function corsPreflightResponse() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export function errResponse(message, status = 400) {
  return jsonResponse({ ok: false, error: message }, status);
}
