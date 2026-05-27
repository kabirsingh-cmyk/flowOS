/**
 * FlowOS Reach — Health check endpoint
 * Vercel Edge Function: GET /api/health
 *
 * Returns 200 with service status, or 503 if critical dependencies are down.
 */

import { corsHeaders } from "./lib/cors.js";

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const checks = {
    supabase: false,
    anthropic: false,
    time: new Date().toISOString(),
  };

  let status = 200;

  // Supabase connectivity check
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_KEY;
  if (supaUrl && supaKey) {
    try {
      const res = await fetch(`${supaUrl}/rest/v1/`, {
        headers: {
          apikey: supaKey,
          Authorization: `Bearer ${supaKey}`,
        },
      });
      checks.supabase = res.ok;
      if (!res.ok) status = 503;
    } catch {
      status = 503;
    }
  } else {
    status = 503;
  }

  // Anthropic key presence (not a live call — avoids cost on health pings)
  checks.anthropic = !!process.env.ANTHROPIC_API_KEY;
  if (!checks.anthropic) status = 503;

  const body = {
    ok: status === 200,
    status: status === 200 ? "healthy" : "degraded",
    checks,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
