/**
 * SPEC-01 — Generation Engine
 *
 * POST /api/generate — Vercel Edge Function
 *
 * Single endpoint that orchestrates AI image and video generation across providers.
 * The frontend never talks to provider APIs directly.
 *
 * Supported actions:
 *   upload_reference   — upload reference media to provider, return media_id
 *   generate_image     — assemble prompt + submit image job
 *   generate_video     — assemble prompt + submit video job
 *   job_status         — poll one or many job IDs
 *   models_explore     — provider model discovery pass-through
 */

import { buildPrompt }                     from './lib/assetPrompts.js';
import {
  UNWORKABLE_MODELS,
  uploadReference,
  generateImage,
  generateVideo,
  jobStatus,
  modelsExplore,
}                                          from './lib/providerRouter.js';
import { requireAuth }                     from './lib/auth.js';
import { loadCredential }                  from './lib/directCredentials.js';

export const config = { runtime: 'edge' };

// ─── CORS headers (mirrors api/social.js pattern) ─────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(message, status = 400, extra = {}) {
  return json({ ok: false, error: message, ...extra }, status);
}

// ─── Supabase REST helper ─────────────────────────────────────────────────────

function supabaseHeaders() {
  return {
    'apikey':        process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };
}

async function supabaseInsert(table, row) {
  const base = process.env.SUPABASE_URL;
  if (!base) throw new Error('SUPABASE_URL env var not set');

  const res = await fetch(`${base}/rest/v1/${table}`, {
    method:  'POST',
    headers: supabaseHeaders(),
    body:    JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert into ${table} failed (${res.status}): ${text}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function supabaseUpdate(table, id, patch) {
  const base = process.env.SUPABASE_URL;
  const res = await fetch(`${base}/rest/v1/${table}?id=eq.${id}`, {
    method:  'PATCH',
    headers: supabaseHeaders(),
    body:    JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase update ${table}(${id}) failed (${res.status}): ${text}`);
  }
}

async function supabaseSelect(table, filters = {}) {
  const base  = process.env.SUPABASE_URL;
  const qs    = Object.entries(filters)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
    .join('&');
  const res = await fetch(`${base}/rest/v1/${table}?${qs}`, {
    headers: { ...supabaseHeaders(), 'Prefer': 'return=representation' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase select ${table} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ─── Cost estimates per provider (USD per job, rough) ────────────────────────
const COST_MAP = {
  runware:    0.0008,  // ~$0.0008/image at FLUX Schnell pricing
  replicate:  0.0030,  // varies by model; $0.003 is a conservative estimate
  heygen:     0.0500,  // avatar video ~$0.05 per render
  higgsfield: 0.0200,  // cinematic video
  luma:       0.0150,
  elevenlabs: 0.0030,
  audiostack: 0.0100,
};

async function logGenerationUsage({ tenantId, provider, model, jobType, jobId, status = "completed" }) {
  const base = process.env.SUPABASE_URL;
  if (!base) return; // best-effort — don't fail generation if tracking fails
  try {
    await fetch(`${base}/rest/v1/generation_usage`, {
      method:  "POST",
      headers: { ...supabaseHeaders(), "Prefer": "return=minimal" },
      body:    JSON.stringify({
        tenant_id:     tenantId,
        provider,
        model:         model || null,
        job_type:      jobType,
        job_id:        jobId  || null,
        cost_estimate: COST_MAP[provider] ?? null,
        status,
      }),
    });
  } catch (_) { /* non-blocking */ }
}

/**
 * rehost — download a provider CDN asset and upload to Supabase Storage.
 * Returns the durable Supabase Storage URL, or rawUrl on any failure.
 *
 * @param {string} rawUrl       Provider CDN URL
 * @param {string} tenantId
 * @param {string} jobId        generation_jobs row id (or provider_job_id as fallback)
 * @param {string} assetType    "image" | "video"
 * @param {string} provider
 * @returns {Promise<string>}   Durable URL
 */
async function rehost(rawUrl, tenantId, jobId, assetType = 'image', provider = 'unknown') {
  const base = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key || !rawUrl) return rawUrl;
  try {
    const urlPath = rawUrl.split('?')[0];
    const ext = urlPath.match(/\.(mp4|webm|mov|png|jpg|jpeg|webp|gif)$/i)?.[1]
      || (assetType === 'video' ? 'mp4' : 'jpg');
    const storagePath = `${tenantId}/${jobId}.${ext}`;

    const fetchRes = await fetch(rawUrl);
    if (!fetchRes.ok) throw new Error(`Fetch failed: ${fetchRes.status}`);
    const buffer      = await fetchRes.arrayBuffer();
    const contentType = fetchRes.headers.get('content-type')
      || (assetType === 'video' ? 'video/mp4' : 'image/jpeg');

    const uploadUrl = `${base}/storage/v1/object/tenant-media/${storagePath}`;
    const uploadRes = await fetch(uploadUrl, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  contentType,
        'x-upsert':      'true',
      },
      body: buffer,
    });
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Storage upload failed (${uploadRes.status}): ${text}`);
    }

    const durableUrl = `${base}/storage/v1/object/public/tenant-media/${storagePath}`;

    // Fire-and-forget registry insert.
    fetch(`${base}/rest/v1/media_assets`, {
      method:  'POST',
      headers: { ...supabaseHeaders(), 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
      body:    JSON.stringify({
        tenant_id:    tenantId,
        job_id:       jobId,
        storage_path: storagePath,
        storage_url:  durableUrl,
        provider,
        asset_type:   assetType,
      }),
    }).catch(() => {});

    return durableUrl;
  } catch (e) {
    console.warn('[rehost] falling back to rawUrl:', e.message);
    return rawUrl;
  }
}

// Resolve Replicate API key: per-tenant key in connector_credentials takes
// precedence over the global REPLICATE_API_KEY env var.
async function resolveReplicateKey(tenantId) {
  const perTenant = await loadCredential({ tenantId, platform: "replicate" }).catch(() => null);
  return perTenant || process.env.REPLICATE_API_KEY || null;
}

// ─── Brand + Product context fetch ───────────────────────────────────────────

async function fetchBrand(tenantId) {
  const rows = await supabaseSelect('brands', { tenant_id: tenantId });
  return rows?.[0] || null;
}

async function fetchProduct(skuId) {
  if (!skuId) return null;
  const rows = await supabaseSelect('products', { sku_id: skuId });
  return rows?.[0] || null;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

/**
 * upload_reference
 * Upload a reference asset (packshot etc.) to the provider.
 * Returns mediaId to use in subsequent generate calls.
 */
async function handleUploadReference(body) {
  const { tenantId, provider, filename, fileBytesBase64, fileUrl } = body;
  if (!tenantId)  return err('tenantId required');
  if (!provider)  return err('provider required');
  if (!filename)  return err('filename required');
  if (!fileBytesBase64 && !fileUrl) return err('fileBytesBase64 or fileUrl required');

  let bytes, contentType;

  if (fileBytesBase64) {
    // Decode base64 → binary
    const raw   = atob(fileBytesBase64);
    bytes       = Uint8Array.from(raw, c => c.charCodeAt(0));
    contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
  } else {
    // Fetch from public URL
    const fetchRes = await fetch(fileUrl);
    if (!fetchRes.ok) return err(`Could not fetch fileUrl: HTTP ${fetchRes.status}`);
    bytes       = new Uint8Array(await fetchRes.arrayBuffer());
    contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
  }

  const { mediaId, expiresAt } = await uploadReference(provider, { filename, bytes, contentType });

  // Persist to media_uploads
  await supabaseInsert('media_uploads', {
    tenant_id:   tenantId,
    provider,
    provider_id: mediaId,
    source_path: fileUrl || filename,
    expires_at:  expiresAt,
  });

  return json({ ok: true, mediaId, provider, expiresAt });
}

/**
 * generate_image
 * Assemble prompt from intent + brand context, submit image job, persist row.
 */
async function handleGenerateImage(body) {
  let { tenantId, provider, model, aspectRatio, resolution, promptIntent, referenceMediaId } = body;
  if (!tenantId)     return err('tenantId required');
  if (!promptIntent) return err('promptIntent required');

  // Provider selection: if caller doesn't specify a provider, or specifies
  // "replicate", check whether this tenant has a Replicate key and use it.
  // Otherwise fall back to the request-supplied provider (typically "runware").
  if (!provider || provider === 'replicate') {
    const replicateKey = await resolveReplicateKey(tenantId);
    if (replicateKey) {
      provider = 'replicate';
      model = model || 'black-forest-labs/flux-schnell';
    } else if (!provider) {
      return err('provider required — no Replicate key found for this tenant');
    }
  }
  if (!model) return err('model required');

  // Reject unworkable models early
  if (UNWORKABLE_MODELS.has(model)) {
    return err(`Model "${model}" is not workable on this account.`, 422, {
      code: 'UNWORKABLE_MODEL', suggestedAlternative: 'nano_banana_2',
    });
  }

  // Fetch brand + product context
  const [brand, product] = await Promise.all([
    fetchBrand(tenantId),
    fetchProduct(promptIntent.skuId),
  ]);

  // Assemble prompt via SPEC-02
  const { prompt, negative } = buildPrompt({
    intent:  promptIntent,
    brand:   brand  || {},
    product: product || { name: promptIntent.skuId, ...(promptIntent.extra || {}) },
  });

  // Submit to provider
  let providerJobId, immediateStatus, rawUrl, thumbnailUrl;
  try {
    const result = await generateImage(provider, {
      model, prompt, negative, aspectRatio, resolution, referenceMediaId,
    });
    providerJobId   = result.providerJobId;
    immediateStatus = result.status       || null;  // synchronous providers (Runware) set this
    rawUrl          = result.rawUrl       || null;
    thumbnailUrl    = result.thumbnailUrl || null;
  } catch (e) {
    if (e?.code === 'UNWORKABLE_MODEL') {
      return err(e.message, 422, { code: e.code, suggestedAlternative: e.suggestedAlternative });
    }
    return err(`Provider error: ${e.message}`, 502);
  }

  // Persist generation_jobs row. Synchronous providers (Runware) land as
  // 'completed' (or 'failed_content_policy') with the URL on first write.
  const isTerminal = immediateStatus === 'completed' || immediateStatus === 'failed_content_policy';
  const row = await supabaseInsert('generation_jobs', {
    tenant_id:       tenantId,
    provider,
    provider_job_id: providerJobId,
    type:            'image',
    intent_kind:     promptIntent.kind   || 'feed_hero',
    sku_id:          promptIntent.skuId  || null,
    story_id:        promptIntent.story  || null,
    beat:            promptIntent.beat   || null,
    status:          immediateStatus || 'pending',
    prompt_used:     prompt,
    prompt_intent:   promptIntent,
    raw_url:         rawUrl,
    thumbnail_url:   thumbnailUrl,
    completed_at:    isTerminal ? new Date().toISOString() : null,
  });

  // Re-host to Supabase Storage so the URL is durable (won't expire like provider CDNs).
  // Falls back to rawUrl if storage is unavailable.
  if (rawUrl) {
    rawUrl = await rehost(rawUrl, tenantId, row?.id || providerJobId, 'image', provider);
    if (row?.id) {
      supabaseUpdate('generation_jobs', row.id, { raw_url: rawUrl }).catch(() => {});
    }
  }

  // Fire-and-forget usage tracking.
  logGenerationUsage({ tenantId, provider, model, jobType: 'image', jobId: row?.id || providerJobId, status: immediateStatus || 'pending' });

  return json({
    ok:       true,
    jobId:    row?.id || providerJobId,
    status:   immediateStatus || 'pending',
    provider,
    rawUrl,
    thumbnailUrl,
  });
}

/**
 * generate_video
 * Assemble prompt, validate aspect ratio, submit video job, persist row.
 */
async function handleGenerateVideo(body) {
  let {
    tenantId, provider, model, aspectRatio, duration,
    startImageJobId, startImageAspectRatio, promptIntent,
  } = body;
  if (!tenantId)     return err('tenantId required');
  if (!promptIntent) return err('promptIntent required');

  // Provider selection: same Replicate fallback as handleGenerateImage.
  if (!provider || provider === 'replicate') {
    const replicateKey = await resolveReplicateKey(tenantId);
    if (replicateKey) {
      provider = 'replicate';
      model = model || 'minimax/video-01';
    } else if (!provider) {
      return err('provider required — no Replicate key found for this tenant');
    }
  }
  if (!model) return err('model required');

  // Reject unworkable models early
  if (UNWORKABLE_MODELS.has(model)) {
    return err(`Model "${model}" is not workable on this account.`, 422, {
      code: 'UNWORKABLE_MODEL', suggestedAlternative: 'cinematic_studio_3_0',
    });
  }

  // Reference image as first frame — if [REF_FRAME] prefix found in scene hint,
  // extract the URL and use it directly instead of a generated start image.
  let startImageUrl = null;
  const videoSceneHint = promptIntent?.extra?.scene || '';
  if (videoSceneHint.startsWith('[REF_FRAME]')) {
    const refUrl = videoSceneHint.replace('[REF_FRAME]', '').trim();
    if (refUrl && !startImageJobId) {
      startImageUrl = refUrl;
      promptIntent  = { ...promptIntent, extra: { ...(promptIntent.extra || {}), scene: '' } };
    }
  }

  // Fetch brand + product context
  const [brand, product] = await Promise.all([
    fetchBrand(tenantId),
    fetchProduct(promptIntent.skuId),
  ]);

  const { prompt, negative } = buildPrompt({
    intent:  promptIntent,
    brand:   brand  || {},
    product: product || {},
  });

  // Submit — aspect-ratio check happens inside providerRouter.generateVideo
  let providerJobId, immediateStatus, rawUrl, thumbnailUrl;
  try {
    const result = await generateVideo(provider, {
      model, prompt, negative, aspectRatio, duration,
      startImageJobId, startImageAspectRatio, startImageUrl,
    });
    providerJobId   = result.providerJobId;
    immediateStatus = result.status       || null;
    rawUrl          = result.rawUrl       || null;
    thumbnailUrl    = result.thumbnailUrl || null;
  } catch (e) {
    if (e?.code === 'UNWORKABLE_MODEL') {
      return err(e.message, 422, { code: e.code, suggestedAlternative: e.suggestedAlternative });
    }
    // Aspect-ratio mismatch — bubble up as a clear 422
    if (e.message?.includes('requires matching')) {
      return err(e.message, 422, { code: 'ASPECT_MISMATCH' });
    }
    return err(`Provider error: ${e.message}`, 502);
  }

  const isTerminal = immediateStatus === 'completed' || immediateStatus === 'failed_content_policy';
  const row = await supabaseInsert('generation_jobs', {
    tenant_id:       tenantId,
    provider,
    provider_job_id: providerJobId,
    type:            'video',
    intent_kind:     promptIntent.kind  || 'reel_beat',
    sku_id:          promptIntent.skuId || null,
    story_id:        promptIntent.story || null,
    beat:            promptIntent.beat  || null,
    status:          immediateStatus || 'pending',
    prompt_used:     prompt,
    prompt_intent:   promptIntent,
    raw_url:         rawUrl,
    thumbnail_url:   thumbnailUrl,
    completed_at:    isTerminal ? new Date().toISOString() : null,
  });

  // Fire-and-forget usage tracking.
  logGenerationUsage({ tenantId, provider, model, jobType: 'video', jobId: row?.id || providerJobId, status: immediateStatus || 'pending' });

  return json({
    ok:       true,
    jobId:    row?.id || providerJobId,
    status:   immediateStatus || 'pending',
    provider,
    rawUrl,
    thumbnailUrl,
  });
}

/**
 * job_status
 * Poll one or many jobs. Updates completed/failed rows in Supabase.
 */
async function handleJobStatus(body) {
  const { jobIds, provider = 'higgsfield' } = body;
  if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
    return err('jobIds must be a non-empty array');
  }

  // For each jobId we need the provider_job_id — look up from generation_jobs
  // For simplicity, if the caller passes the internal DB uuid we resolve it;
  // otherwise we treat the value as a provider_job_id directly.
  //
  // In a full implementation this would join against generation_jobs.
  // Here we call jobStatus with the IDs as-is (provider-side polling).
  let results;
  try {
    results = await jobStatus(provider, jobIds);
  } catch (e) {
    return err(`Provider polling error: ${e.message}`, 502);
  }

  // Rehost any newly-completed rawUrls to durable storage, then persist status.
  // Awaited so the response carries the durable URL (not the expiring CDN URL).
  const rehostPromises = results.map(async r => {
    if ((r.status === 'completed' || r.status === 'failed_content_policy') && r.rawUrl) {
      try {
        const rows  = await supabaseSelect('generation_jobs', { provider_job_id: r.jobId });
        const dbRow = rows?.[0];
        if (dbRow) {
          const assetType  = dbRow.type || 'image';
          const durableUrl = await rehost(r.rawUrl, dbRow.tenant_id, dbRow.id, assetType, dbRow.provider);
          r.rawUrl = durableUrl;
          await supabaseUpdate('generation_jobs', dbRow.id, {
            status:        r.status,
            raw_url:       durableUrl,
            thumbnail_url: r.thumbnailUrl || null,
            completed_at:  new Date().toISOString(),
          });
        }
      } catch (_) { /* non-blocking */ }
    }
  });
  await Promise.allSettled(rehostPromises);

  return json({ ok: true, results });
}

/**
 * models_explore
 * Pass-through to provider model discovery.
 */
async function handleModelsExplore(body) {
  const { provider = 'higgsfield', subAction = 'list', query, modelId } = body;
  try {
    const data = await modelsExplore(provider, { subAction, query, modelId });
    return json({ ok: true, provider, data });
  } catch (e) {
    return err(`models_explore error: ${e.message}`, 502);
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return err('POST required', 405);
  }

  // job_status and models_explore don't touch tenant data — keep them
  // available to authenticated callers but skip the tenantId requirement.
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body;
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON body', 400);
  }

  // Server-trusted tenantId — overrides anything the client sent.
  body = { ...body, tenantId: auth.tenantId };
  const { action } = body;

  try {
    switch (action) {
      case 'upload_reference':  return handleUploadReference(body);
      case 'generate_image':    return handleGenerateImage(body);
      case 'generate_video':    return handleGenerateVideo(body);
      case 'job_status':        return handleJobStatus(body);
      case 'models_explore':    return handleModelsExplore(body);
      default:
        return err(`Unknown action "${action}". Supported: upload_reference, generate_image, generate_video, job_status, models_explore`, 400);
    }
  } catch (e) {
    console.error('[generate] unhandled error:', e);
    return err(`Internal error: ${e.message}`, 500);
  }
}
