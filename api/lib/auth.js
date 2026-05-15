// FlowOS — request authentication for /api/* edge handlers
//
// Two helpers, each returning either a Response (caller should `return` it as
// the failure response) or an object with the resolved identity:
//
//   requireAuth(req)        → user JWT path. Returns { tenantId, claims }
//   requireCron(req)        → cron path. Returns { ok: true }
//   requireAuthOrCron(req)  → either a valid user JWT OR a valid CRON_SECRET.
//                             For platform endpoints invoked by the cron with
//                             a server-stamped tenantId in the request body.
//
// Design notes:
//   * The cron path FAILS CLOSED — if CRON_SECRET is unset, requireCron
//     rejects every request. Earlier code's `if (cronSecret)` pattern silently
//     accepted everything when the env var was missing.
//   * Dual-auth pattern: a request from /api/cron/fire-scheduled carries
//     `Authorization: Bearer ${CRON_SECRET}` plus a body whose `tenantId` was
//     resolved server-side at /api/scheduled-posts queue time. Platform
//     handlers (linkedin/facebook/x/instagram/reddit) accept either path.
//   * HS256 is the only Supabase-supported algorithm; we hard-require it and
//     reject any other `alg` to prevent algorithm-confusion attacks.

const enc = new TextEncoder();

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function b64urlToBytes(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToString(str) {
  return new TextDecoder().decode(b64urlToBytes(str));
}

// Constant-time string compare to avoid timing oracles on the cron secret.
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// Verify an HS256 JWT and return its claims, or throw with a public-safe
// message. Does NOT allow the caller to skip alg/exp/sig checks.
export async function verifyJwtHs256(token, secret) {
  if (typeof token !== "string" || !token) throw new Error("missing token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [h, p, s] = parts;

  let header;
  try { header = JSON.parse(b64urlToString(h)); } catch { throw new Error("bad header"); }
  if (header.alg !== "HS256") throw new Error("unsupported alg");
  if (header.typ && header.typ !== "JWT") throw new Error("unsupported typ");

  const key = await importHmacKey(secret);
  const ok  = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlToBytes(s),
    enc.encode(`${h}.${p}`),
  );
  if (!ok) throw new Error("bad signature");

  let claims;
  try { claims = JSON.parse(b64urlToString(p)); } catch { throw new Error("bad payload"); }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === "number" && claims.exp < now) throw new Error("expired");
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) throw new Error("not yet valid");

  return claims;
}

// Sign an HS256 JWT. Used by the dev mint endpoint and the OAuth state HMAC
// for google-ads-auth (the latter strictly speaking just needs raw HMAC, but
// reusing this keeps the cryptographic surface small).
export async function signJwtHs256(claims, secret) {
  const header  = { alg: "HS256", typ: "JWT" };
  const enc64   = (obj) => bytesToB64url(enc.encode(JSON.stringify(obj)));
  const headerB = enc64(header);
  const payB    = enc64(claims);
  const data    = `${headerB}.${payB}`;
  const key     = await importHmacKey(secret);
  const sig     = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return `${data}.${bytesToB64url(new Uint8Array(sig))}`;
}

function bytesToB64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Public: extract bearer token from the Authorization header.
export function extractBearer(req) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

// Resolve identity from a Supabase user JWT. Returns { tenantId, claims } on
// success or a Response on failure. The caller should `return` the Response.
export async function requireAuth(req) {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    return jsonResponse(500, { ok: false, error: "SUPABASE_JWT_SECRET not configured" });
  }
  const token = extractBearer(req);
  if (!token) return jsonResponse(401, { ok: false, error: "missing bearer token" });

  let claims;
  try {
    claims = await verifyJwtHs256(token, secret);
  } catch (e) {
    return jsonResponse(401, { ok: false, error: `invalid token: ${e.message}` });
  }

  const tenantId = claims.sub;
  if (!tenantId) return jsonResponse(401, { ok: false, error: "token missing sub" });

  return { tenantId, claims };
}

// Verify a Vercel Cron / GitHub Actions trigger. Fails closed — if
// CRON_SECRET is missing the request is rejected. Returns { ok: true } on
// success or a Response on failure.
export function requireCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return jsonResponse(500, { ok: false, error: "CRON_SECRET not configured (required, fail-closed)" });
  }
  const token = extractBearer(req);
  if (!token || !timingSafeEqual(token, secret)) {
    return jsonResponse(401, { ok: false, error: "invalid cron secret" });
  }
  return { ok: true };
}

// Dual-auth: accept either a valid user JWT (returns { tenantId, claims, via:
// "user" }) OR a valid CRON_SECRET (returns { tenantId: bodyTenantId, claims:
// null, via: "cron" }). For the cron path the caller MUST pass the tenantId
// it intends to act on (read from the request body that was stamped by
// /api/scheduled-posts at queue time). This keeps the cron path from being
// usable as a generic tenant-impersonation oracle.
export async function requireAuthOrCron(req, bodyTenantId) {
  const token = extractBearer(req);
  if (!token) return jsonResponse(401, { ok: false, error: "missing bearer token" });

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && timingSafeEqual(token, cronSecret)) {
    if (!bodyTenantId) {
      return jsonResponse(400, { ok: false, error: "tenantId required on cron-authed call" });
    }
    return { tenantId: bodyTenantId, claims: null, via: "cron" };
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    return jsonResponse(500, { ok: false, error: "SUPABASE_JWT_SECRET not configured" });
  }
  let claims;
  try {
    claims = await verifyJwtHs256(token, jwtSecret);
  } catch (e) {
    return jsonResponse(401, { ok: false, error: `invalid token: ${e.message}` });
  }
  const tenantId = claims.sub;
  if (!tenantId) return jsonResponse(401, { ok: false, error: "token missing sub" });
  return { tenantId, claims, via: "user" };
}

// HMAC for OAuth state. Used by google-ads-auth.js to sign the state param so
// it can't be forged on the callback to impersonate a different tenant.
export async function signState(payload, secret) {
  const data    = enc.encode(JSON.stringify(payload));
  const dataB64 = bytesToB64url(data);
  const key     = await importHmacKey(secret);
  const sig     = await crypto.subtle.sign("HMAC", key, enc.encode(dataB64));
  return `${dataB64}.${bytesToB64url(new Uint8Array(sig))}`;
}

export async function verifyState(state, secret) {
  if (typeof state !== "string" || !state.includes(".")) throw new Error("malformed state");
  const idx = state.indexOf(".");
  const dataB64 = state.slice(0, idx);
  const sigB64  = state.slice(idx + 1);
  const key     = await importHmacKey(secret);
  const ok      = await crypto.subtle.verify(
    "HMAC", key, b64urlToBytes(sigB64), enc.encode(dataB64),
  );
  if (!ok) throw new Error("bad state signature");
  let payload;
  try { payload = JSON.parse(b64urlToString(dataB64)); } catch { throw new Error("bad state payload"); }
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("state expired");
  }
  return payload;
}
