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

// ─── Runware adapter ──────────────────────────────────────────────────────────
//
// Runware is a synchronous task API. A single POST to /v1 with an array of
// task objects returns the result inline — no polling. We map this onto the
// router's job model by treating each taskUUID as the providerJobId and
// returning the imageURL alongside, so the caller can persist it as
// "completed" immediately.
//
// Auth: Bearer RUNWARE_API_KEY.
// Models are AIR identifiers (e.g. "runware:101@1", "civitai:101055@128078").

const RUNWARE_BASE = 'https://api.runware.ai/v1';

function runwareHeaders() {
  const key = process.env.RUNWARE_API_KEY;
  if (!key) throw new Error('RUNWARE_API_KEY env var is not set');
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type':  'application/json',
  };
}

function uuidv4() {
  // RFC4122 v4, edge-runtime friendly (no node:crypto import)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Map aspect ratio + resolution token → { width, height }
// Runware requires explicit pixel dims, multiples of 64, 512–2048.
function dimsFor(aspectRatio = '1:1', resolution = '1k') {
  const long = resolution === '2k' ? 1536 : resolution === '0.5k' ? 768 : 1024;
  const ratios = {
    '1:1':  [long, long],
    '4:5':  [Math.round(long * 4 / 5), long],
    '9:16': [Math.round(long * 9 / 16), long],
    '16:9': [long, Math.round(long * 9 / 16)],
    '3:4':  [Math.round(long * 3 / 4), long],
    '4:3':  [long, Math.round(long * 3 / 4)],
    '2:3':  [Math.round(long * 2 / 3), long],
    '3:2':  [long, Math.round(long * 2 / 3)],
  };
  const [w, h] = ratios[aspectRatio] || ratios['1:1'];
  const snap = n => Math.max(512, Math.min(2048, Math.round(n / 64) * 64));
  return { width: snap(w), height: snap(h) };
}

async function runwarePost(tasks) {
  const res = await fetch(RUNWARE_BASE, {
    method:  'POST',
    headers: runwareHeaders(),
    body:    JSON.stringify(tasks),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Runware request failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  // Runware returns { data: [...], errors?: [...] }
  if (data.errors && data.errors.length) {
    const first = data.errors[0];
    throw new Error(`Runware error: ${first.message || JSON.stringify(first)}`);
  }
  return data.data || [];
}

/**
 * Upload a reference image to Runware. Returns the imageUUID, which can be
 * passed as `referenceMediaId` to generate_image (used as seedImage / reference).
 */
async function runwareUploadReference({ bytes, contentType }) {
  // Runware imageUpload accepts a data URI in the `image` field.
  // Convert bytes → base64 → data URI.
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  const b64 = btoa(binary);
  const dataUri = `data:${contentType || 'image/jpeg'};base64,${b64}`;

  const task = {
    taskType: 'imageUpload',
    taskUUID: uuidv4(),
    image:    dataUri,
  };
  const results = await runwarePost([task]);
  const r = results[0];
  if (!r?.imageUUID) throw new Error('Runware imageUpload returned no imageUUID');
  return { mediaId: r.imageUUID, expiresAt: null };
}

/**
 * Submit a Runware image generation job. Synchronous — returns URL inline.
 *
 * @returns {{ providerJobId, status, rawUrl, thumbnailUrl }}
 */
async function runwareGenerateImage({ model, prompt, negative, aspectRatio, resolution, referenceMediaId }) {
  const { width, height } = dimsFor(aspectRatio, resolution);
  const taskUUID = uuidv4();

  const task = {
    taskType:        'imageInference',
    taskUUID,
    positivePrompt:  prompt,
    negativePrompt:  negative || '',
    model:           model || 'runware:101@1',
    width,
    height,
    numberResults:   1,
    outputFormat:    'JPEG',
    outputType:      'URL',
    includeCost:     false,
    checkNSFW:       true,
  };
  if (referenceMediaId) {
    task.seedImage = referenceMediaId;
    // When seeding from an upload, strength controls how closely the output
    // adheres to the reference. 0.7 keeps strong product fidelity while
    // letting the scene prompt drive the surroundings.
    task.strength = 0.7;
  }

  const results = await runwarePost([task]);
  const r = results[0];
  if (!r) throw new Error('Runware returned no result');

  // Treat NSFW flag as a terminal content-policy failure to mirror Higgsfield.
  if (r.NSFWContent === true) {
    return {
      providerJobId: r.taskUUID || taskUUID,
      status:        'failed_content_policy',
      rawUrl:        null,
      thumbnailUrl:  null,
    };
  }

  return {
    providerJobId: r.taskUUID || taskUUID,
    status:        'completed',
    rawUrl:        r.imageURL || null,
    thumbnailUrl:  r.imageURL || null,
  };
}

/**
 * Submit a Runware video generation job.
 *
 * Video on Runware is async for most models (Kling, Veo, Seedance, Wan, …) —
 * the initial POST returns a taskUUID and we poll via getResponse. Some short
 * jobs may come back terminal in the first response; we honour either shape.
 *
 * For image-to-video, pass a prior imageUUID (from upload_reference or a
 * completed image generation) as `startImageJobId` — we forward it in
 * `frameImages` so the model uses it as the start frame.
 *
 * @returns {{ providerJobId, status, rawUrl?, thumbnailUrl? }}
 */
async function runwareGenerateVideo({ model, prompt, negative, aspectRatio, duration, startImageJobId }) {
  // Video models often have stricter resolution rules; default to a sensible
  // base and let the model clamp. 1024 long side works across Kling / Veo.
  const { width, height } = dimsFor(aspectRatio || '9:16', '1k');
  const taskUUID = uuidv4();

  const task = {
    taskType:        'videoInference',
    taskUUID,
    positivePrompt:  prompt,
    negativePrompt:  negative || '',
    model:           model,
    width,
    height,
    duration:        duration || 5,
    numberResults:   1,
    outputFormat:    'MP4',
    outputType:      'URL',
    checkNSFW:       true,
  };
  if (startImageJobId) {
    // Runware accepts a previously-uploaded imageUUID or a public URL.
    task.frameImages = [{ inputImage: startImageJobId }];
  }

  const results = await runwarePost([task]);
  const r = results[0];
  if (!r) throw new Error('Runware returned no result');

  if (r.NSFWContent === true) {
    return {
      providerJobId: r.taskUUID || taskUUID,
      status:        'failed_content_policy',
      rawUrl:        null,
      thumbnailUrl:  null,
    };
  }

  // Terminal in the first response — short / sync model
  const url = r.videoURL || r.videoUrl || null;
  if (url) {
    return {
      providerJobId: r.taskUUID || taskUUID,
      status:        'completed',
      rawUrl:        url,
      thumbnailUrl:  r.thumbnailURL || r.thumbnailUrl || null,
    };
  }

  // Async — caller will poll via jobStatus('runware', [taskUUID])
  return {
    providerJobId: r.taskUUID || taskUUID,
    status:        'pending',
    rawUrl:        null,
    thumbnailUrl:  null,
  };
}

/**
 * Poll Runware for one or many task UUIDs via the getResponse task.
 *
 * Returns one entry per jobId with status mapped onto the router vocabulary:
 *   completed | pending | failed | failed_content_policy
 */
async function runwareJobStatus(jobIds) {
  // getResponse takes a list of taskUUIDs and returns the latest state for each.
  const task = {
    taskType:  'getResponse',
    taskUUID:  uuidv4(),
    taskUUIDs: jobIds,
  };
  let rows;
  try {
    rows = await runwarePost([task]);
  } catch (e) {
    // Fall back to per-jobId unknown rather than failing the whole batch
    return jobIds.map(jobId => ({ jobId, status: 'pending', rawUrl: null, thumbnailUrl: null, error: e.message }));
  }

  const byId = new Map();
  for (const r of rows) {
    const id = r.taskUUID;
    if (!id) continue;
    if (r.NSFWContent === true) {
      byId.set(id, { jobId: id, status: 'failed_content_policy', rawUrl: null, thumbnailUrl: null });
      continue;
    }
    const url = r.videoURL || r.videoUrl || r.imageURL || null;
    if (url) {
      byId.set(id, {
        jobId:        id,
        status:       'completed',
        rawUrl:       url,
        thumbnailUrl: r.thumbnailURL || r.thumbnailUrl || url,
      });
    } else if (r.error || r.errorMessage) {
      byId.set(id, { jobId: id, status: 'failed', rawUrl: null, thumbnailUrl: null, error: r.errorMessage || r.error });
    } else {
      byId.set(id, { jobId: id, status: 'pending', rawUrl: null, thumbnailUrl: null });
    }
  }

  return jobIds.map(id => byId.get(id) || { jobId: id, status: 'pending', rawUrl: null, thumbnailUrl: null });
}

// ─── Provider dispatch ────────────────────────────────────────────────────────

function requireAdapter(provider) {
  const supported = ['higgsfield', 'runware']; // falai, heygen — future adapters
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
  if (provider === 'runware')    return runwareUploadReference(params);
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
  if (provider === 'runware')    return runwareGenerateImage(params);
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
  if (provider === 'runware')    return runwareGenerateVideo(params);
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
  if (provider === 'runware')    return runwareJobStatus(jobIds);
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
  // Runware has no public model-list endpoint; AIR IDs are documented in
  // their model gallery. Return an empty descriptor so callers don't crash.
  if (provider === 'runware') {
    return {
      provider: 'runware',
      note:     'Runware uses AIR model identifiers (e.g. "runware:101@1"). Browse https://my.runware.ai/models for the catalog.',
      models:   [],
    };
  }
}
