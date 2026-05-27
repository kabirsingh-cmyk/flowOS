/**
 * FlowOS Reach — Replicate connector (Direct API, per-tenant API key)
 * Vercel Edge Function: POST /api/replicate
 *
 * Actions:
 *   initiate_connection — validate API key via GET /v1/account, persist to
 *                         connector_credentials, flip channels to connected
 *   disconnect          — drop credential + flip channels to disconnected
 *   generate_image      — run a Replicate image model; returns { jobId, status, rawUrl? }
 *   generate_video      — run a Replicate video model; returns { jobId, status }
 *
 * For generate_*, the route reads the per-tenant key first (connector_credentials),
 * then falls back to the global REPLICATE_API_KEY env var. This lets the platform
 * key serve as a default while tenants can override with their own keys.
 *
 * Polling for async generations is via /api/generate action=job_status with
 * provider="replicate".
 */

import { saveCredential, deleteCredential, loadCredential, json, err, CORS } from "./lib/directCredentials.js";
import { requireAuth } from "./lib/auth.js";

export const config = { runtime: "edge" };

const REPLICATE_BASE = "https://api.replicate.com/v1";

// Default image model — FLUX Schnell is fast and broadly available.
const DEFAULT_IMAGE_MODEL = "black-forest-labs/flux-schnell";
// Default video model — MiniMax Video-01.
const DEFAULT_VIDEO_MODEL  = "minimax/video-01";

async function replicateFetch(path, options, apiKey) {
  const res = await fetch(`${REPLICATE_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `Replicate ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  return data;
}

async function resolveApiKey(tenantId) {
  const perTenant = await loadCredential({ tenantId, platform: "replicate" });
  if (perTenant) return perTenant;
  const envKey = process.env.REPLICATE_API_KEY;
  if (!envKey) throw new Error("No Replicate API key — connect Replicate in Settings or set REPLICATE_API_KEY env var.");
  return envKey;
}

async function validateKey(apiKey) {
  const res = await fetch(`${REPLICATE_BASE}/account`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Replicate rejected the API key (401/403). Check it at replicate.com/account/api-tokens.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicate validation failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const account = await res.json();
  return account?.username || account?.name || "Replicate account";
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function handleInitiate({ tenantId, apiKey }) {
  if (!tenantId) return err("tenantId required");
  if (!apiKey)   return err("apiKey required");

  let accountName;
  try { accountName = await validateKey(apiKey); } catch (e) { return err(e.message, 400); }

  await saveCredential({ tenantId, platform: "replicate", apiKey, note: `connected as ${accountName}` });
  return json({ ok: true, mode: "api_key", account: accountName });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "replicate" });
  return json({ ok: true });
}

/**
 * generate_image
 * Submits an image generation prediction to Replicate.
 * Returns immediately with jobId + status ("starting") for async polling,
 * or resolves synchronously if the model completes quickly.
 *
 * Body params:
 *   model         — Replicate model ID (owner/name or owner/name:version)
 *   prompt        — text prompt
 *   negativePrompt — optional negative prompt
 *   aspectRatio   — "1:1" | "16:9" | "9:16" | "4:3" etc.
 *   width / height — pixels (alternative to aspectRatio)
 */
async function handleGenerateImage({ tenantId, model, prompt, negativePrompt, aspectRatio, width, height }) {
  if (!tenantId) return err("tenantId required");
  if (!prompt)   return err("prompt required");

  const apiKey = await resolveApiKey(tenantId);
  const modelId = model || DEFAULT_IMAGE_MODEL;

  // Resolve dimensions from aspectRatio if width/height not supplied.
  let imgWidth = width, imgHeight = height;
  if (!imgWidth && aspectRatio) {
    const [w, h] = aspectRatio.split(":").map(Number);
    const base = 1024;
    imgWidth  = base;
    imgHeight = Math.round(base * (h / w));
  }

  const input = {
    prompt,
    ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
    ...(imgWidth  ? { width:  imgWidth  } : {}),
    ...(imgHeight ? { height: imgHeight } : {}),
  };

  const prediction = await replicateFetch("/predictions", {
    method: "POST",
    body:   JSON.stringify({ version: modelId.includes(":") ? modelId.split(":")[1] : undefined, model: modelId.includes(":") ? undefined : modelId, input }),
  }, apiKey);

  const rawUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

  return json({
    ok:       true,
    jobId:    prediction.id,
    status:   prediction.status || "starting",
    provider: "replicate",
    rawUrl:   rawUrl || null,
  });
}

/**
 * generate_video
 * Submits a video generation prediction to Replicate.
 */
async function handleGenerateVideo({ tenantId, model, prompt, negativePrompt, aspectRatio, duration }) {
  if (!tenantId) return err("tenantId required");
  if (!prompt)   return err("prompt required");

  const apiKey = await resolveApiKey(tenantId);
  const modelId = model || DEFAULT_VIDEO_MODEL;

  const input = {
    prompt,
    ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
    ...(aspectRatio    ? { aspect_ratio: aspectRatio }       : {}),
    ...(duration       ? { duration }                         : {}),
  };

  const prediction = await replicateFetch("/predictions", {
    method: "POST",
    body:   JSON.stringify({ model: modelId, input }),
  }, apiKey);

  return json({
    ok:       true,
    jobId:    prediction.id,
    status:   prediction.status || "starting",
    provider: "replicate",
    rawUrl:   prediction.output || null,
  });
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return err("POST required", 405);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await req.json(); } catch { return err("Invalid JSON body", 400); }
  body = { ...body, tenantId: auth.tenantId };

  try {
    switch (body.action) {
      case "initiate_connection": return handleInitiate(body);
      case "disconnect":          return handleDisconnect(body);
      case "generate_image":      return handleGenerateImage(body);
      case "generate_video":      return handleGenerateVideo(body);
      default:
        return err(`Unknown action "${body.action}". Supported: initiate_connection, disconnect, generate_image, generate_video`);
    }
  } catch (e) {
    console.error("[replicate]", e);
    return err(`Replicate error: ${e.message}`, 502);
  }
}
