/**
 * SPEC-01 — Generation Engine: Integration Tests
 *
 * Run with:  node --test tests/integration/generation-engine.test.js
 * Requires Node >= 18 (built-in test runner + global fetch).
 *
 * Strategy: mock Higgsfield endpoints + Supabase REST with canned fixtures.
 * Verifies:
 *   - upload_reference → generate_image → prompt_used correctness
 *   - UNWORKABLE_MODELS rejection (seedance_2_0, veo3, kling2_6)
 *   - nsfw status surfaces as failed_content_policy (no auto-retry)
 *   - aspect-ratio mismatch caught pre-submission
 *   - job_status polling maps completed/nsfw/failed correctly
 */

import { test, describe, before, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  UNWORKABLE_MODELS,
  validateAspectRatio,
  uploadReference,
  generateImage,
  generateVideo,
  jobStatus,
} from '../../api/lib/providerRouter.js';

import { buildPrompt } from '../../api/lib/assetPrompts.js';

// ─── Global fetch mock setup ──────────────────────────────────────────────────
//
// We intercept global fetch and route by URL prefix.

const HIGGSFIELD_BASE = 'https://api.higgsfield.ai';
const SUPABASE_BASE   = 'https://fake-project.supabase.co';

// Response registry: url-pattern → handler
const fetchHandlers = new Map();

function registerHandler(pattern, handler) {
  fetchHandlers.set(pattern, handler);
}

function makeMockFetch() {
  return async function mockFetch(url, opts = {}) {
    const urlStr = typeof url === 'string' ? url : url.toString();

    for (const [pattern, handler] of fetchHandlers) {
      if (urlStr.includes(pattern)) {
        const result = await handler(urlStr, opts);
        return result;
      }
    }
    // Unregistered URL — throw so tests catch unintended calls
    throw new Error(`Unregistered fetch mock for: ${urlStr}`);
  };
}

// Simple response builder
function mockResponse(body, status = 200) {
  return {
    ok:     status >= 200 && status < 300,
    status,
    json:   async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text:   async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    headers: { get: () => 'application/json' },
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const MEDIA_ID   = 'a43608ea-mock-media-id';
const JOB_ID_IMG = 'edd88b1d-mock-image-job';
const JOB_ID_VID = 'f9c1a007-mock-video-job';

const BRAND_FIXTURE = {
  registers: {
    royal: {
      styleSummary: 'Ancient Indian luxury — Mughal grandeur, hand-beaten brass, ornate lattice.',
    },
  },
  bannedVisuals: ['marigold garlands dominating frame'],
  voice: { bannedPhrases: ['game changer'] },
};

const SKU_DM02 = {
  name:        'Green Tea & Oud Bar Soap',
  skuName:     'Green Tea & Oud Bar Soap',
  packaging:   'a deep oud-brown rectangular bar with gold/mustard box',
  barColor:    'deep oud-brown (NOT GREEN)',
  boxColor:    'gold/mustard-yellow',
  skuType:     'bath_soap',
  productColors: { primary: 'deep oud-brown', secondary: 'gold/mustard-yellow' },
  commonDriftModes: ['make the bar green', 'make the box forest-green'],
};

// ─── Suites ───────────────────────────────────────────────────────────────────

describe('UNWORKABLE_MODELS set', () => {
  test('seedance_2_0 is in UNWORKABLE_MODELS', () => {
    assert.ok(UNWORKABLE_MODELS.has('seedance_2_0'), 'seedance_2_0 must be blocked');
  });
  test('veo3 is in UNWORKABLE_MODELS', () => {
    assert.ok(UNWORKABLE_MODELS.has('veo3'), 'veo3 must be blocked');
  });
  test('veo3_1 is in UNWORKABLE_MODELS', () => {
    assert.ok(UNWORKABLE_MODELS.has('veo3_1'), 'veo3_1 must be blocked');
  });
  test('kling2_6 is in UNWORKABLE_MODELS', () => {
    assert.ok(UNWORKABLE_MODELS.has('kling2_6'), 'kling2_6 must be blocked');
  });
  test('nano_banana_2 is NOT in UNWORKABLE_MODELS (working model)', () => {
    assert.ok(!UNWORKABLE_MODELS.has('nano_banana_2'), 'nano_banana_2 must be allowed');
  });
  test('cinematic_studio_3_0 is NOT in UNWORKABLE_MODELS (working model)', () => {
    assert.ok(!UNWORKABLE_MODELS.has('cinematic_studio_3_0'), 'cinematic_studio_3_0 must be allowed');
  });
  test('kling3_0 is NOT in UNWORKABLE_MODELS (working model)', () => {
    assert.ok(!UNWORKABLE_MODELS.has('kling3_0'), 'kling3_0 must be allowed');
  });
});

// ─── validateAspectRatio ──────────────────────────────────────────────────────

describe('validateAspectRatio', () => {
  test('passes silently when model is permissive (cinematic_studio_3_0)', () => {
    assert.doesNotThrow(() => {
      validateAspectRatio('cinematic_studio_3_0', '1:1', '9:16');
    });
  });

  test('passes when start image aspect matches output (kling3_0 9:16 → 9:16)', () => {
    assert.doesNotThrow(() => {
      validateAspectRatio('kling3_0', '9:16', '9:16');
    });
  });

  test('throws descriptive error when kling3_0 gets 1:1 start image for 9:16 output', () => {
    assert.throws(
      () => validateAspectRatio('kling3_0', '1:1', '9:16'),
      (e) => {
        assert.ok(e.message.includes('1:1'), 'error must mention source aspect');
        assert.ok(e.message.includes('9:16'), 'error must mention required aspect');
        assert.ok(e.message.includes('kling3_0'), 'error must name the model');
        return true;
      }
    );
  });

  test('passes when no startImageAspectRatio provided (no start image)', () => {
    assert.doesNotThrow(() => {
      validateAspectRatio('kling3_0', undefined, '9:16');
    });
  });
});

// ─── generateImage — unworkable model rejection ───────────────────────────────

describe('generateImage — unworkable model rejection', () => {
  test('seedance_2_0 throws with UNWORKABLE_MODEL code', async () => {
    // Set env key so adapter doesn't fail on missing key first
    process.env.HIGGSFIELD_API_KEY = 'test-key';

    await assert.rejects(
      () => generateImage('higgsfield', {
        model:        'seedance_2_0',
        prompt:       'test prompt',
        aspectRatio:  '9:16',
      }),
      (e) => {
        assert.ok(e.code === 'UNWORKABLE_MODEL', 'must throw with UNWORKABLE_MODEL code');
        assert.ok(e.message.includes('seedance_2_0'), 'error must name the model');
        assert.equal(e.suggestedAlternative, 'nano_banana_2', 'must suggest nano_banana_2');
        return true;
      }
    );
  });

  test('veo3 throws with UNWORKABLE_MODEL code', async () => {
    await assert.rejects(
      () => generateImage('higgsfield', { model: 'veo3', prompt: 'test' }),
      (e) => {
        assert.ok(e.code === 'UNWORKABLE_MODEL');
        return true;
      }
    );
  });
});

// ─── generateVideo — unworkable model rejection ───────────────────────────────

describe('generateVideo — unworkable model rejection', () => {
  test('kling2_6 throws with UNWORKABLE_MODEL code and suggests cinematic_studio_3_0', async () => {
    await assert.rejects(
      () => generateVideo('higgsfield', { model: 'kling2_6', prompt: 'test', aspectRatio: '9:16' }),
      (e) => {
        assert.ok(e.code === 'UNWORKABLE_MODEL');
        assert.equal(e.suggestedAlternative, 'cinematic_studio_3_0');
        return true;
      }
    );
  });
});

// ─── upload_reference → generate_image flow (mocked Higgsfield) ──────────────

describe('upload_reference → generate_image flow', () => {
  before(() => {
    process.env.HIGGSFIELD_API_KEY = 'test-api-key';

    // Mocked Higgsfield media_upload (step 1)
    registerHandler('/media_upload', async (url, opts) => {
      if (opts.method === 'POST') {
        return mockResponse({
          upload_url: 'https://s3.amazonaws.com/fake-bucket/presigned?sig=abc',
          media_id:   MEDIA_ID,
          expires_at: '2026-05-08T00:00:00Z',
        });
      }
    });

    // Mocked S3 presigned PUT (step 2)
    registerHandler('s3.amazonaws.com', async () => mockResponse('', 200));

    // Mocked Higgsfield media_confirm (step 3)
    registerHandler('/media_confirm', async () =>
      mockResponse({ media_id: MEDIA_ID, status: 'ready' })
    );

    // Mocked Higgsfield generate (nano_banana_2)
    registerHandler('/models/nano_banana_2/generate', async () =>
      mockResponse({ job_id: JOB_ID_IMG, status: 'pending' })
    );

    // Mocked Higgsfield jobs/{id} — successful completion
    registerHandler(`/jobs/${JOB_ID_IMG}`, async () =>
      mockResponse({
        status:  'completed',
        results: { rawUrl: 'https://cdn.higgsfield.ai/raw/result.png', thumbnailUrl: 'https://cdn.higgsfield.ai/thumb/result.jpg' },
      })
    );

    // Replace global fetch
    globalThis.fetch = makeMockFetch();
  });

  test('upload_reference returns mediaId from Higgsfield', async () => {
    const result = await uploadReference('higgsfield', {
      filename:    'AYS-002_packshot_b.png',
      bytes:       new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
    });
    assert.equal(result.mediaId, MEDIA_ID, 'mediaId must match Higgsfield mock');
    assert.ok(result.expiresAt, 'expiresAt must be present');
  });

  test('generateImage returns providerJobId for nano_banana_2', async () => {
    const result = await generateImage('higgsfield', {
      model:           'nano_banana_2',
      prompt:          'Luxury beauty editorial, 9:16 vertical. PRESERVE THE PRODUCT EXACTLY...',
      negative:        'no text overlays, no flat artwork',
      aspectRatio:     '9:16',
      resolution:      '2k',
      referenceMediaId: MEDIA_ID,
    });
    assert.equal(result.providerJobId, JOB_ID_IMG, 'providerJobId must match mock');
  });

  test('prompt_used for DM-02 SKU contains explicit NOT GREEN', () => {
    const { prompt } = buildPrompt({
      intent:  { kind: 'feed_hero', skuId: 'AYS-002', register: 'royal', lane: 'cinematic', extra: {} },
      brand:   BRAND_FIXTURE,
      product: SKU_DM02,
    });
    assert.ok(prompt.toUpperCase().includes('NOT GREEN'), 'prompt_used must contain NOT GREEN for DM-02 SKU');
    assert.ok(prompt.includes('deep oud-brown'), 'prompt_used must include actual primary colour');
    assert.ok(prompt.includes('gold/mustard-yellow'), 'prompt_used must include actual secondary colour');
  });
});

// ─── jobStatus — NSFW handling ────────────────────────────────────────────────

describe('jobStatus — nsfw terminal status', () => {
  before(() => {
    process.env.HIGGSFIELD_API_KEY = 'test-api-key';
    // Register NSFW job response
    registerHandler('/jobs/nsfw-job-id', async () =>
      mockResponse({ status: 'nsfw', results: null })
    );
    globalThis.fetch = makeMockFetch();
  });

  test('nsfw status maps to failed_content_policy (not re-queued)', async () => {
    const results = await jobStatus('higgsfield', ['nsfw-job-id']);
    assert.equal(results.length, 1);
    const r = results[0];
    assert.equal(r.status, 'failed_content_policy',
      'nsfw must surface as failed_content_policy — do NOT auto-retry');
    assert.equal(r.rawUrl,       null, 'rawUrl must be null for nsfw');
    assert.equal(r.thumbnailUrl, null, 'thumbnailUrl must be null for nsfw');
  });
});

// ─── jobStatus — completed and failed ────────────────────────────────────────

describe('jobStatus — completed and failed statuses', () => {
  before(() => {
    process.env.HIGGSFIELD_API_KEY = 'test-api-key';

    registerHandler('/jobs/completed-job', async () =>
      mockResponse({
        status:  'completed',
        results: { rawUrl: 'https://cdn.hf.ai/raw.png', thumbnailUrl: 'https://cdn.hf.ai/thumb.jpg' },
      })
    );
    registerHandler('/jobs/failed-job', async () =>
      mockResponse({ status: 'failed', results: null })
    );
    registerHandler('/jobs/in-progress-job', async () =>
      mockResponse({ status: 'in_progress', results: null })
    );

    globalThis.fetch = makeMockFetch();
  });

  test('completed job returns rawUrl and thumbnailUrl', async () => {
    const [r] = await jobStatus('higgsfield', ['completed-job']);
    assert.equal(r.status, 'completed');
    assert.ok(r.rawUrl.includes('cdn.hf.ai'), 'rawUrl must be populated on completed');
    assert.ok(r.thumbnailUrl.includes('thumb'), 'thumbnailUrl must be populated on completed');
  });

  test('failed job returns failed status with null URLs', async () => {
    const [r] = await jobStatus('higgsfield', ['failed-job']);
    assert.equal(r.status, 'failed');
    assert.equal(r.rawUrl, null);
    assert.equal(r.thumbnailUrl, null);
  });

  test('in_progress job returns in_progress status', async () => {
    const [r] = await jobStatus('higgsfield', ['in-progress-job']);
    assert.equal(r.status, 'in_progress');
  });

  test('batch poll returns one result per jobId', async () => {
    const results = await jobStatus('higgsfield', ['completed-job', 'failed-job']);
    assert.equal(results.length, 2);
  });
});

// ─── generateVideo — aspect-ratio pre-submission guard ────────────────────────

describe('generateVideo — aspect-ratio mismatch guard', () => {
  test('kling3_0 with 1:1 start image + 9:16 output throws before submission', async () => {
    process.env.HIGGSFIELD_API_KEY = 'test-api-key';

    await assert.rejects(
      () => generateVideo('higgsfield', {
        model:                'kling3_0',
        prompt:               'test',
        aspectRatio:          '9:16',
        duration:             6,
        startImageJobId:      JOB_ID_IMG,
        startImageAspectRatio: '1:1',  // mismatch!
      }),
      (e) => {
        assert.ok(e.message.includes('1:1'),      'error must mention source aspect ratio');
        assert.ok(e.message.includes('9:16'),      'error must mention required aspect ratio');
        assert.ok(e.message.includes('kling3_0'), 'error must name the model');
        return true;
      }
    );
  });

  test('cinematic_studio_3_0 tolerates mismatched aspect ratios (permissive model)', async () => {
    // Register a mock response for cinematic_studio_3_0
    registerHandler('/models/cinematic_studio_3_0/generate', async () =>
      mockResponse({ job_id: JOB_ID_VID })
    );
    globalThis.fetch = makeMockFetch();

    // Should NOT throw — cinematic_studio_3_0 is permissive
    const result = await generateVideo('higgsfield', {
      model:                'cinematic_studio_3_0',
      prompt:               'test',
      aspectRatio:          '9:16',
      duration:             6,
      startImageJobId:      JOB_ID_IMG,
      startImageAspectRatio: '1:1',  // permissive model ignores mismatch
    });
    assert.equal(result.providerJobId, JOB_ID_VID);
  });
});

// ─── Provider validation ──────────────────────────────────────────────────────

describe('Unknown provider rejection', () => {
  test('generateImage with unknown provider throws', async () => {
    await assert.rejects(
      () => generateImage('fakeProvider', { model: 'nano_banana_2', prompt: 'test' }),
      /Unknown provider/
    );
  });

  test('jobStatus with unknown provider throws', async () => {
    await assert.rejects(
      () => jobStatus('fakeProvider', ['some-job']),
      /Unknown provider/
    );
  });
});
