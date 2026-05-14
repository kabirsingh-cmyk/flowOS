/**
 * Proactive drafts — unit tests
 *
 * Run with:  node --test tests/unit/proactive-drafts.test.js
 * Requires Node >= 18 (built-in test runner).
 *
 * Covers:
 *   - FALLBACK_DRAFTS schema completeness
 *   - buildPrompt — required brand fields are injected
 *   - buildPrompt — platform distribution block is present
 *   - buildPrompt — count param controls the count directive
 *   - buildPrompt — handles partial / empty brand gracefully
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildPrompt, FALLBACK_DRAFTS } from "../../api/proactive-drafts.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BRAND_FULL = {
  name:            "MVEDA",
  industry:        "Ayurvedic skincare",
  target_audience: "Women 25-45, wellness-oriented",
  voice:           { tone: "quiet luxury, ritual-forward" },
  values:          ["transparency", "slow beauty", "Ayurveda"],
  claims:          ["cold-pressed at source", "small batch"],
  prohibited_topics: ["clinical claims", "anti-aging"],
  summary:         "5,000 years of Ayurveda in one bottle.",
};

const BRAND_MINIMAL = { name: "TestCo" };
const BRAND_EMPTY   = {};

const VALID_PLATFORMS = ["instagram", "tiktok", "linkedin", "pinterest", "email", "x"];
const VALID_DAYS      = [0, 1, 2, 3, 4, 5, 6];

// ─── FALLBACK_DRAFTS schema ────────────────────────────────────────────────────

describe("FALLBACK_DRAFTS schema", () => {
  test("array is non-empty", () => {
    assert.ok(Array.isArray(FALLBACK_DRAFTS) && FALLBACK_DRAFTS.length > 0);
  });

  test("every draft has required string fields: platform, contentType, copy", () => {
    for (const d of FALLBACK_DRAFTS) {
      assert.ok(typeof d.platform    === "string" && d.platform.length    > 0, `platform missing on: ${JSON.stringify(d)}`);
      assert.ok(typeof d.contentType === "string" && d.contentType.length > 0, `contentType missing on: ${JSON.stringify(d)}`);
      assert.ok(typeof d.copy        === "string" && d.copy.length        > 0, `copy missing on: ${JSON.stringify(d)}`);
    }
  });

  test("every draft.platform is a recognised slug", () => {
    for (const d of FALLBACK_DRAFTS) {
      assert.ok(VALID_PLATFORMS.includes(d.platform), `unrecognised platform "${d.platform}"`);
    }
  });

  test("suggestedDay is an integer 0–6 when present", () => {
    for (const d of FALLBACK_DRAFTS) {
      if (d.suggestedDay !== null && d.suggestedDay !== undefined) {
        assert.ok(VALID_DAYS.includes(d.suggestedDay), `invalid suggestedDay ${d.suggestedDay}`);
      }
    }
  });

  test("suggestedTime matches HH:MM when present", () => {
    const TIME_RE = /^\d{2}:\d{2}$/;
    for (const d of FALLBACK_DRAFTS) {
      if (d.suggestedTime) {
        assert.match(d.suggestedTime, TIME_RE, `invalid suggestedTime "${d.suggestedTime}"`);
      }
    }
  });

  test("imagePrompt is string or null (never undefined)", () => {
    for (const d of FALLBACK_DRAFTS) {
      assert.ok(
        d.imagePrompt === null || typeof d.imagePrompt === "string",
        `imagePrompt must be string or null, got ${typeof d.imagePrompt}`
      );
    }
  });

  test("covers at least 5 distinct platforms", () => {
    const platforms = new Set(FALLBACK_DRAFTS.map(d => d.platform));
    assert.ok(platforms.size >= 5, `only ${platforms.size} distinct platforms`);
  });

  test("no two drafts share the same platform + suggestedDay combination", () => {
    const seen = new Set();
    for (const d of FALLBACK_DRAFTS) {
      if (d.suggestedDay === null || d.suggestedDay === undefined) continue;
      const key = `${d.platform}:${d.suggestedDay}`;
      assert.ok(!seen.has(key), `duplicate platform+day: ${key}`);
      seen.add(key);
    }
  });
});

// ─── buildPrompt — full brand ──────────────────────────────────────────────────

describe("buildPrompt — full brand", () => {
  const prompt = buildPrompt(BRAND_FULL, 7, 7);

  test("returns a non-empty string", () => {
    assert.ok(typeof prompt === "string" && prompt.length > 100);
  });

  test("contains brand name", () => {
    assert.ok(prompt.includes("MVEDA"), "brand name must appear in prompt");
  });

  test("contains industry", () => {
    assert.ok(prompt.includes("Ayurvedic skincare"), "industry must appear in prompt");
  });

  test("contains voice tone", () => {
    assert.ok(prompt.includes("quiet luxury"), "voice tone must appear in prompt");
  });

  test("approved claims injected", () => {
    assert.ok(
      prompt.includes("cold-pressed at source"),
      "approved claims must appear in prompt"
    );
  });

  test("prohibited topics injected", () => {
    assert.ok(
      prompt.includes("clinical claims") || prompt.includes("anti-aging"),
      "prohibited topics must appear in prompt"
    );
  });

  test("platform distribution block present", () => {
    assert.ok(
      prompt.includes("Instagram") && prompt.includes("TikTok") && prompt.includes("LinkedIn"),
      "platform distribution block must be present"
    );
  });

  test("count is embedded correctly (7)", () => {
    assert.ok(prompt.includes("exactly 7"), "count directive must be in prompt");
  });

  test("scheduling hints present", () => {
    assert.ok(
      prompt.includes("suggestedDay") || prompt.includes("suggestedTime") || prompt.includes("0=Mon"),
      "scheduling guidance must be in prompt"
    );
  });
});

// ─── buildPrompt — count variations ───────────────────────────────────────────

describe("buildPrompt — count param", () => {
  test("count=3 is reflected in the prompt", () => {
    const prompt = buildPrompt(BRAND_MINIMAL, 7, 3);
    assert.ok(prompt.includes("exactly 3"), "count 3 must appear in prompt");
  });

  test("count=14 is reflected in the prompt", () => {
    const prompt = buildPrompt(BRAND_MINIMAL, 14, 14);
    assert.ok(prompt.includes("exactly 14"), "count 14 must appear in prompt");
  });
});

// ─── buildPrompt — graceful degradation ───────────────────────────────────────

describe("buildPrompt — minimal / empty brand", () => {
  test("minimal brand (name only) still returns a string > 200 chars", () => {
    const prompt = buildPrompt(BRAND_MINIMAL, 7, 7);
    assert.ok(typeof prompt === "string" && prompt.length > 200);
  });

  test("minimal brand still contains platform distribution block", () => {
    const prompt = buildPrompt(BRAND_MINIMAL, 7, 7);
    assert.ok(prompt.includes("Instagram"), "platform block must survive missing brand fields");
  });

  test("empty brand object falls back gracefully (no throw)", () => {
    assert.doesNotThrow(() => buildPrompt(BRAND_EMPTY, 7, 7));
  });

  test("null brand falls back gracefully (no throw)", () => {
    assert.doesNotThrow(() => buildPrompt(null, 7, 7));
  });

  test("null brand still produces a prompt mentioning 'the brand'", () => {
    const prompt = buildPrompt(null, 7, 7);
    assert.ok(
      prompt.includes("the brand") || prompt.includes("undefined") === false,
      "null brand must not inject 'undefined' into the prompt"
    );
    assert.ok(!prompt.includes("undefined"), "prompt must not contain literal 'undefined'");
  });
});

// ─── buildPrompt — JSON output directive ──────────────────────────────────────

describe("buildPrompt — output format directive", () => {
  const prompt = buildPrompt(BRAND_FULL, 7, 7);

  test("instructs Claude to return only valid JSON", () => {
    assert.ok(
      prompt.toLowerCase().includes("valid json") || prompt.toLowerCase().includes("only valid json"),
      "prompt must instruct Claude to return JSON only"
    );
  });

  test("contains the required output fields as examples", () => {
    assert.ok(prompt.includes('"platform"'), "output schema must include platform field");
    assert.ok(prompt.includes('"contentType"'), "output schema must include contentType field");
    assert.ok(prompt.includes('"copy"'), "output schema must include copy field");
  });
});
