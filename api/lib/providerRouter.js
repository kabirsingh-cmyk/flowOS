/**
 * SPEC-01 — Provider Router
 *
 * Provider-agnostic abstraction layer for AI image and video generation.
 * Currently implements the Higgsfield adapter.
 *
 * Exports:
 *   UNWORKABLE_MODELS   — Set of model IDs to reject before submission
 *   uploadReference     — upload reference media, return provider media_id
 *   generateImage       — submit image generation job
 *   generateVideo       — submit video generation job
 *   jobStatus           — poll one or many job IDs
 *   modelsExplore       — pass-through model discovery
 */

// ─── Known-bad model router ───────────────────────────────────────────────────
//
// Tested against Higgsfield creator-tier during platform R&D.
// Drop entries when tier or account changes unlock the model.
//
// Working alternatives:
//   Video → cinematic_studio_3_0 (SOTA) or kling3_0
//   Stills → nano_banana_2
//
export const UNWORKABLE_MODELS = new Set([
  'veo3',          // Account-level block on creator-tier — all calls return generic error
  'veo3_1',        // Same gated block
  'seedance_2_0',  // Content filter false-positives on luxury/sensual register (NSFW rejections)
  'kling2_6',      // Generic error on every call; kling3_0 works fine — model-specific issue
]);

// ─── Aspect-ratio compatibility (LEARNED) ─────────────────────────────────────
//
// Some video models reject a 1:1 start frame when output is 9:16.
// Validate before submission so the caller gets a clear actionable error.
//
const ASPECT_STRICT_MODELS = new Set([
  'kling3_0',
  // cinematic_studio_3_0 is more permissive — does not require strict match
]);

/**
 * Validate that a start image's aspect ratio is compatible with a video model.
 * @param {string} modelId        — e.g. 'kling3_0'
 * @param {string} startImageAR   — aspect ratio of the start image, e.g. '1:1', '9:16'
 * @param {string} outputAR       — requested output aspect ratio, e.g. '9:16'
 * @throws {Error}                — descriptive error if incompatible
 */
export function validateAspectRatio(modelId, startImageAR, outputAR) {
  if (!ASPECT_STRICT_MODELS.has(modelId)) return; // permissive model — skip check
  if (!startImageAR) return;                       // no start image — skip check
  if (startImageAR === outputAR) return;           // match — all good

  throw new Error(
    `start_image is ${startImageAR}; ${modelId} requires matching ${outputAR} source. ` +
    `Regenerate the start frame at ${outputAR} before submitting video.`
  );
}

// ─── Higgsfield adapter ───────────────────────────────────────────────────────

const HIGGSFIELD_BASE = 'https://api.higgsfield.ai';

/** Build auth headers for Higgsfield. API key from env. */
function higgsfieldHeaders(extra = {}) {
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!key) throw new Error('HIGGSFIELD_API_KEY env var is not set');
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type':  'application/json',
    ...extra,
  };
}

/**
 * Upload reference media to Higgsfield.
 *
 * Higgsfield upload is a 3-step dance:
 *   1. POST /media_upload     → { upload_url (presigned S3), media_id }
 *   2. PUT {upload_url} bytes → 200 (raw PUT, no auth headers)
 *   3. POST /media_confirm    → { media_id, status: "ready" }
 *
 * @param {{ filename: string, bytes: Uint8Array|ArrayBuffer, contentType: string }} params
 * @returns {{ mediaId: string, expiresAt: string|null }}
 */
async function higgsfieldUploadReference({ filename, bytes, contentType }) {
  // Step 1 — request presigned URL
  const initRes = await fetch(`${HIGGSFIELD_BASE}/media_upload`, {
    method:  'POST',
    headers: higgsfieldHeaders(),
    body:    JSON.stringify({ filename, content_type: contentType }),
  });
  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`Higgsfield media_upload init failed (${initRes.status}): ${err}`);
  }
  const { upload_url: uploadUrl, media_id: mediaId, expires_at: expiresAt } = await initRes.json();

  // Step 2 — PUT bytes to presigned S3 URL (no auth headers, raw binary)
  const putRes = await fetch(uploadUrl, {
    method:  'PUT',
    headers: { 'Content-Type': contentType },
    body:    bytes,
  });
  if (!putRes.ok) {
    throw new Error(`Higgsfield presigned PUT failed (${putRes.status})`);
  }

  // Step 3 — confirm upload with media type
  const confirmRes = await fetch(`${HIGGSFIELD_BASE}/media_confirm`, {
    method:  'POST',
    headers: higgsfieldHeaders(),
    body:    JSON.stringify({ media_id: mediaId, type: 'image' }),
  });
  if (!confirmRes.ok) {
    const err = await confirmRes.text();
    throw new Error(`Higgsfield media_confirm failed (${confirmRes.status}): ${err}`);
  }

  return { mediaId, expiresAt: expiresAt || null };
}

/**
 * Submit a Higgsfield image generation job.
 *
 * @param {{ model, prompt, negative, aspectRatio, resolution, referenceMediaId }} params
 * @returns {{ providerJobId: string }}
 */
async function higgsfieldGenerateImage({ model, prompt, negative, aspectRatio, resolution, referenceMediaId }) {
  const body = {
    prompt,
    negative_prompt: negative || '',
    aspect_ratio:    aspectRatio || '9:16',
    resolution:      resolution  || '2k',
    medias: referenceMediaId
      ? [{ value: referenceMediaId, role: 'image' }]
      : [],
  };

  const res = await fetch(`${HIGGSFIELD_BASE}/models/${model}/generate`, {
    method:  'POST',
    headers: higgsfieldHeaders(),
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Higgsfield generate_image failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return { providerJobId: data.job_id || data.id };
}

/**
 * Submit a Higgsfield video generation job.
 *
 * Note: `startImageJobId` can be either a media_id (from upload_reference) OR
 * a prior job_id (from generate_image) — Higgsfield accepts both.
 *
 * @param {{ model, prompt, negative, aspectRatio, duration, startImageJobId }} params
 * @returns {{ providerJobId: string }}
 */
async function higgsfieldGenerateVideo({ model, prompt, negative, aspectRatio, duration, startImageJobId }) {
  const body = {
    prompt,
    negative_prompt: negative || '',
    aspect_ratio:    aspectRatio || '9:16',
    duration:        duration    || 6,
    medias: startImageJobId
      ? [{ value: startImageJobId, role: 'start_image' }]
      : [],
  };

  const res = await fetch(`${HIGGSFIELD_BASE}/models/${model}/generate`, {
    method:  'POST',
    headers: higgsfieldHeaders(),
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Higgsfield generate_video failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return { providerJobId: data.job_id || data.id };
}

/**
 * Poll Higgsfield job status for one or many job IDs.
 *
 * Status values from Higgsfield: pending | queued | in_progress | completed | nsfw | failed
 * "nsfw" is a TERMINAL status — content policy rejection, not a transient error.
 *
 * @param {string[]} jobIds
 * @returns {Array<{ jobId, status, rawUrl?, thumbnailUrl? }>}
 */
async function higgsfieldJobStatus(jobIds) {
  const results = await Promise.all(jobIds.map(async jobId => {
    const res = await fetch(`${HIGGSFIELD_BASE}/jobs/${jobId}`, {
      headers: higgsfieldHeaders(),
    });
    if (!res.ok) {
      return { jobId, status: 'failed', error: `HTTP ${res.status}` };
    }
    const data = await res.json();

    // Map NSFW to failed_content_policy — terminal, do NOT auto-retry
    if (data.status === 'nsfw') {
      return { jobId, status: 'failed_content_policy', rawUrl: null, thumbnailUrl: null };
    }

    return {
      jobId,
      status:       data.status,
      rawUrl:       data.results?.rawUrl       || data.results?.raw_url       || null,
      thumbnailUrl: data.results?.thumbnailUrl || data.results?.thumbnail_url || null,
    };
  }));
  return results;
}

/**
 * Higgsfield model discovery pass-through.
 *
 * @param {{ subAction: 'search'|'get'|'list', query?, modelId? }} params
 * @returns {Object} — provider-specific metadata
 */
async function higgsfieldModelsExplore({ subAction, query, modelId }) {
  let url;
  if (subAction === 'list') {
    url = `${HIGGSFIELD_BASE}/models`;
  } else if (subAction === 'get' && modelId) {
    url = `${HIGGSFIELD_BASE}/models/${modelId}`;
  } else if (subAction === 'search' && query) {
    url = `${HIGGSFIELD_BASE}/models?q=${encodeURIComponent(query)}`;
  } else {
    url = `${HIGGSFIELD_BASE}/models`;
  }

  const res = await fetch(url, { headers: higgsfieldHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Higgsfield models_explore failed (${res.status}): ${err}`);
  }
  return res.json();
}

// ─── Provider dispatch ────────────────────────────────────────────────────────

function requireAdapter(provider) {
  const supported = ['higgsfield']; // runware, falai, heygen — future adapters
  if (!supported.includes(provider)) {
    throw new Error(`Unknown provider "${provider}". Supported: ${supported.join(', ')}`);
  }
}

/**
 * Upload a reference media asset to the specified provider.
 *
 * @param {string} provider
 * @param {{ filename: string, bytes: Uint8Array|ArrayBuffer, contentType: string }} params
 * @returns {{ mediaId: string, expiresAt: string|null }}
 */
export async function uploadReference(provider, params) {
  requireAdapter(provider);
  if (provider === 'higgsfield') return higgsfieldUploadReference(params);
}

/**
 * Submit an image generation job to the specified provider.
 * Rejects UNWORKABLE_MODELS before making any network call.
 *
 * @param {string} provider
 * @param {{ model, prompt, negative, aspectRatio, resolution, referenceMediaId }} params
 * @returns {{ providerJobId: string }}
 */
export async function generateImage(provider, params) {
  requireAdapter(provider);

  if (UNWORKABLE_MODELS.has(params.model)) {
    // eslint-disable-next-line no-throw-literal
    throw {
      code:                'UNWORKABLE_MODEL',
      message:             `Model "${params.model}" is not workable on this account. Use nano_banana_2 for stills.`,
      suggestedAlternative: 'nano_banana_2',
    };
  }

  if (provider === 'higgsfield') return higgsfieldGenerateImage(params);
}

/**
 * Submit a video generation job to the specified provider.
 * Rejects UNWORKABLE_MODELS and validates aspect-ratio compatibility.
 *
 * @param {string} provider
 * @param {{ model, prompt, negative, aspectRatio, duration,
 *           startImageJobId, startImageAspectRatio? }} params
 * @returns {{ providerJobId: string }}
 */
export async function generateVideo(provider, params) {
  requireAdapter(provider);

  if (UNWORKABLE_MODELS.has(params.model)) {
    // eslint-disable-next-line no-throw-literal
    throw {
      code:                'UNWORKABLE_MODEL',
      message:             `Model "${params.model}" is not workable on this account. Use cinematic_studio_3_0 or kling3_0 for video.`,
      suggestedAlternative: 'cinematic_studio_3_0',
    };
  }

  // Aspect-ratio guard (LEARNED)
  if (params.startImageAspectRatio) {
    validateAspectRatio(params.model, params.startImageAspectRatio, params.aspectRatio || '9:16');
  }

  if (provider === 'higgsfield') return higgsfieldGenerateVideo(params);
}

/**
 * Poll job status for one or many job IDs.
 *
 * @param {string} provider
 * @param {string[]} jobIds
 * @returns {Array<{ jobId, status, rawUrl?, thumbnailUrl? }>}
 */
export async function jobStatus(provider, jobIds) {
  requireAdapter(provider);
  if (provider === 'higgsfield') return higgsfieldJobStatus(jobIds);
}

/**
 * List or inspect provider model capabilities.
 *
 * @param {string} provider
 * @param {{ subAction: string, query?: string, modelId?: string }} params
 * @returns {Object} — provider-specific response
 */
export async function modelsExplore(provider, params) {
  requireAdapter(provider);
  if (provider === 'higgsfield') return higgsfieldModelsExplore(params);
}
