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
  const { tenantId, provider, model, aspectRatio, resolution, promptIntent, referenceMediaId } = body;
  if (!tenantId)     return err('tenantId required');
  if (!provider)     return err('provider required');
  if (!model)        return err('model required');
  if (!promptIntent) return err('promptIntent required');

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
  const {
    tenantId, provider, model, aspectRatio, duration,
    startImageJobId, startImageAspectRatio, promptIntent,
  } = body;
  if (!tenantId)     return err('tenantId required');
  if (!provider)     return err('provider required');
  if (!model)        return err('model required');
  if (!promptIntent) return err('promptIntent required');

  // Reject unworkable models early
  if (UNWORKABLE_MODELS.has(model)) {
    return err(`Model "${model}" is not workable on this account.`, 422, {
      code: 'UNWORKABLE_MODEL', suggestedAlternative: 'cinematic_studio_3_0',
    });
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
      startImageJobId, startImageAspectRatio,
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

  // Persist status updates back to generation_jobs (fire-and-forget; don't block response)
  const updatePromises = results.map(async r => {
    if (r.status === 'completed' || r.status === 'failed' || r.status === 'failed_content_policy') {
      try {
        // Find the row by provider_job_id
        const rows = await supabaseSelect('generation_jobs', { provider_job_id: r.jobId });
        if (rows?.[0]?.id) {
          await supabaseUpdate('generation_jobs', rows[0].id, {
            status:        r.status,
            raw_url:       r.rawUrl       || null,
            thumbnail_url: r.thumbnailUrl || null,
            completed_at:  new Date().toISOString(),
          });
        }
      } catch (_) { /* non-blocking */ }
    }
  });
  // Don't await — return immediately
  Promise.allSettled(updatePromises);

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

  let body;
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON body', 400);
  }

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
