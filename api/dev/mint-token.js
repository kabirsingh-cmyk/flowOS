// FlowOS — dev-only JWT minting for the ?seed=mveda / ?seed=erickson bypass.
//
// Returns a short-lived (1h) Supabase-shaped JWT signed with SUPABASE_JWT_SECRET
// so the seed bypass path can call /api/* endpoints that require user auth.
//
// Hard-gated on VERCEL_ENV !== "production". The endpoint 404s in prod even
// if accidentally deployed, so it can't be used as a tenant-impersonation
// oracle on the live stack.

import { signJwtHs256 } from "../lib/auth.js";

export const config = { runtime: "edge" };

const ALLOWED_SEEDS = new Set(["mveda", "erickson"]);

// Deterministic UUIDs for the dev seed bypass. Supabase's auth.uid() casts
// the JWT sub to uuid; if it isn't a valid uuid the cast fails and every
// RLS policy errors. So dev tokens carry a stable uuid sub per seed and we
// surface a friendly id (`dev-mveda` etc.) on the response only for log
// readability.
const SEED_TO_UUID = {
  mveda:    "00000000-0000-4000-8000-000000000001",
  erickson: "00000000-0000-4000-8000-000000000002",
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req) {
  if (process.env.VERCEL_ENV === "production") {
    return new Response("Not Found", { status: 404 });
  }

  const url  = new URL(req.url);
  const seed = url.searchParams.get("seed") || "";
  if (!ALLOWED_SEEDS.has(seed)) {
    return json(400, { ok: false, error: "seed must be 'mveda' or 'erickson'" });
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    return json(500, { ok: false, error: "SUPABASE_JWT_SECRET not configured" });
  }

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub:   SEED_TO_UUID[seed],
    email: `${seed}@dev.local`,
    role:  "authenticated",
    aud:   "authenticated",
    iat:   now,
    exp:   now + 60 * 60,
    dev:   true,
    dev_seed: seed,
  };
  const token = await signJwtHs256(claims, secret);
  return json(200, { ok: true, accessToken: token, tenantId: claims.sub, devLabel: `dev-${seed}` });
}
