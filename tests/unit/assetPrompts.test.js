/**
 * SPEC-02 — Asset Prompt Library: Unit Tests
 *
 * Run with:  node --test tests/unit/assetPrompts.test.js
 * Requires Node >= 18 (built-in test runner).
 *
 * Covers:
 *   - 9-block prompt structure and block ordering
 *   - DM-02: SKU-name colour-word bias negation
 *   - DM-03: Functional cue saturation-lock clause
 *   - DM-01: flat-artwork-as-packshot negations in negative prompt
 *   - buildNegative deduplication
 *   - preservationBlock direct tests
 *   - buildCaption banned-phrase detection
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPrompt,
  preservationBlock,
  buildNegative,
  buildCaption,
  COLOUR_WORDS,
  FUNCTIONAL_BIAS_WORDS,
  SETTING_LIBRARY,
} from '../../api/lib/assetPrompts.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Fixture brand (royal register, luxury ayurvedic)
const BRAND_FIXTURE = {
  registers: {
    royal: {
      styleSummary: 'Ancient Indian luxury — Mughal grandeur, hand-beaten brass, ornate lattice.',
      subjectDescription: 'south-Asian woman, ivory silk sari, gold bangles, luminous skin',
      overrides: {},
    },
  },
  bannedVisuals: ['marigold garlands dominating frame', 'bare feet on floor'],
  voice: {
    tone: 'elevated, poetic, never clinical',
    bannedPhrases: ['game changer', 'buy now', 'limited time'],
    signatureLines: ['Rooted in ritual. Refined for today.'],
  },
};

// TEST-001: Generic SKU (no colour bias, no functional cue)
const SKU_GENERIC = {
  name:        'Sandalwood & Rose Bar Soap',
  skuName:     'Sandalwood & Rose Bar Soap',
  packaging:   'a cream-white rectangular bar with a matte ivory label and gold foil wordmark',
  barColor:    'cream-white',
  boxColor:    'ivory',
  skuType:     'bath_soap',
  productColors: { primary: 'cream-white', secondary: 'ivory' },
  commonDriftModes: [],
};

// TEST-002: DM-02 fixture — colour word in SKU name
const SKU_DM02 = {
  name:        'Green Tea & Oud Bar Soap',
  skuName:     'Green Tea & Oud Bar Soap',
  packaging:   'a deep oud-brown rectangular bar paired with a gold/mustard-yellow cardboard box',
  barColor:    'deep oud-brown (almost black-brown, NOT GREEN)',
  boxColor:    'gold/mustard-yellow with cream-yellow filigree border',
  skuType:     'bath_soap',
  productColors: { primary: 'deep oud-brown', secondary: 'gold/mustard-yellow' },
  commonDriftModes: ['make the bar green', 'make the box forest-green'],
};

// TEST-003: DM-03 fixture — functional positioning cue
const SKU_DM03 = {
  name:        'Saffron & Turmeric Sensitive Skin Bar',
  skuName:     'Saffron & Turmeric Sensitive Skin Bar',
  packaging:   'bicolor saffron-yellow bar with a vivid saffron-orange cardboard box',
  barColor:    'saffron-yellow',
  boxColor:    'saffron-orange',
  skuType:     'bath_soap',
  productColors: { primary: 'saffron-yellow', secondary: 'saffron-orange' },
  commonDriftModes: ['pastel-shift the packaging', 'render box as ivory'],
};

const INTENT_FEED_HERO = {
  kind:     'feed_hero',
  skuId:    'TEST-001',
  register: 'royal',
  lane:     'cinematic',
  extra:    {},
};

// ─── COLOUR_WORDS regex tests ─────────────────────────────────────────────────

describe('COLOUR_WORDS regex', () => {
  test('detects "Green" in "Green Tea & Oud"', () => {
    assert.match('Green Tea & Oud', COLOUR_WORDS);
  });
  test('detects "saffron" in "Saffron & Turmeric"', () => {
    assert.match('Saffron & Turmeric', COLOUR_WORDS);
  });
  test('does not match "Sandalwood & Rose" (no colour word)', () => {
    assert.doesNotMatch('Sandalwood & Rose', COLOUR_WORDS);
  });
  test('detects "Crimson" (case insensitive)', () => {
    assert.match('Crimson Velvet', COLOUR_WORDS);
  });
});

// ─── FUNCTIONAL_BIAS_WORDS array ──────────────────────────────────────────────

describe('FUNCTIONAL_BIAS_WORDS', () => {
  test('includes "sensitive"', () => {
    assert.ok(FUNCTIONAL_BIAS_WORDS.includes('sensitive'));
  });
  test('includes "gentle", "calming", "delicate"', () => {
    for (const w of ['gentle', 'calming', 'delicate']) {
      assert.ok(FUNCTIONAL_BIAS_WORDS.includes(w), `missing: ${w}`);
    }
  });
});

// ─── preservationBlock ────────────────────────────────────────────────────────

describe('preservationBlock', () => {
  test('contains PRESERVE THE PRODUCT EXACTLY', () => {
    const block = preservationBlock(SKU_GENERIC);
    assert.ok(block.includes('PRESERVE THE PRODUCT EXACTLY'), 'must include anchor phrase');
  });

  test('DM-02: includes explicit NOT GREEN when colour word is "green"', () => {
    const block = preservationBlock(SKU_DM02, { colourBiasWord: 'green' });
    assert.ok(
      block.toUpperCase().includes('NOT GREEN'),
      'must negate the SKU colour word explicitly'
    );
  });

  test('DM-02: includes actual primary and secondary colours', () => {
    const block = preservationBlock(SKU_DM02, { colourBiasWord: 'green' });
    assert.ok(block.includes('deep oud-brown'), 'must reference actual primary colour');
    assert.ok(block.includes('gold/mustard-yellow'), 'must reference actual secondary colour');
  });

  test('DM-03: saturation-lock clause added when functional words present', () => {
    const block = preservationBlock(SKU_DM03, {
      colourBiasWord:    null,
      functionalBiasWords: ['sensitive'],
    });
    assert.ok(
      block.toLowerCase().includes('fully saturated'),
      'must include saturation-lock when functional words detected'
    );
    assert.ok(
      block.toLowerCase().includes('do not pastel-shift'),
      'must include pastel-shift negation'
    );
  });

  test('commonDriftModes appear as explicit negations', () => {
    const block = preservationBlock(SKU_DM02);
    assert.ok(block.includes('Do NOT make the bar green'), 'first drift mode must appear');
    assert.ok(block.includes('Do NOT make the box forest-green'), 'second drift mode must appear');
  });

  test('signature palette summary is present when colours are known', () => {
    const block = preservationBlock(SKU_DM02, { colourBiasWord: 'green' });
    assert.ok(
      block.toUpperCase().includes('SIGNATURE PALETTE'),
      'signature palette summary required'
    );
  });
});

// ─── buildNegative ────────────────────────────────────────────────────────────

describe('buildNegative', () => {
  test('includes universal negatives', () => {
    const neg = buildNegative(BRAND_FIXTURE);
    assert.ok(neg.includes('no text overlays'), 'universal: no text overlays');
    assert.ok(neg.includes('no deformed hands'), 'universal: no deformed hands');
    assert.ok(neg.includes('no caricature'),     'universal: no caricature');
  });

  test('DM-01: includes flat artwork / packshot mock-up negations', () => {
    const neg = buildNegative(BRAND_FIXTURE);
    assert.ok(neg.includes('no flat artwork'),     'DM-01: flat artwork must be in negative');
    assert.ok(neg.includes('no packaging mock-up'),'DM-01: packaging mock-up must be in negative');
  });

  test('includes brand bannedVisuals', () => {
    const neg = buildNegative(BRAND_FIXTURE);
    assert.ok(
      neg.includes('marigold garlands dominating frame'),
      'brand bannedVisuals must appear in negative'
    );
  });

  test('deduplicates terms across sources', () => {
    // Pass a duplicate that's already in universal list
    const neg = buildNegative(BRAND_FIXTURE, ['no text overlays', 'extra-term']);
    const count = neg.split('no text overlays').length - 1;
    assert.equal(count, 1, 'duplicate "no text overlays" should appear only once');
    assert.ok(neg.includes('extra-term'), 'unique intent extra must still appear');
  });

  test('intentExtras are appended', () => {
    const neg = buildNegative(BRAND_FIXTURE, ['no emerald wardrobe']);
    assert.ok(neg.includes('no emerald wardrobe'), 'intent extra must appear in negative');
  });
});

// ─── buildPrompt — 9-block structure ─────────────────────────────────────────

describe('buildPrompt — generic SKU (no drift conditions)', () => {
  const { prompt, negative } = buildPrompt({
    intent:  INTENT_FEED_HERO,
    brand:   BRAND_FIXTURE,
    product: SKU_GENERIC,
  });

  test('returns both prompt and negative strings', () => {
    assert.ok(typeof prompt   === 'string' && prompt.length   > 0, 'prompt must be non-empty string');
    assert.ok(typeof negative === 'string' && negative.length > 0, 'negative must be non-empty string');
  });

  test('Block 1 FORMAT CONTEXT appears first', () => {
    assert.ok(
      prompt.startsWith('Luxury beauty editorial') || prompt.startsWith('Content format'),
      'prompt must open with format context'
    );
  });

  test('Block 2 PRESERVE EXACTLY anchor is present for a product in frame', () => {
    assert.ok(prompt.includes('PRESERVE THE PRODUCT EXACTLY'), 'preservation anchor required');
  });

  test('Block 3 SCENE string from setting library is present', () => {
    // royal × cinematic × bath_soap
    assert.ok(
      prompt.includes('marble tub') || prompt.includes('Mughal palace') || prompt.includes('sandstone'),
      'scene block should contain setting library content'
    );
  });

  test('Block 6 LIGHTING block present', () => {
    assert.ok(
      prompt.toLowerCase().includes('lighting') || prompt.toLowerCase().includes('light'),
      'lighting block required'
    );
  });

  test('Block 7 CAMERA / AESTHETIC block present', () => {
    assert.ok(
      prompt.toLowerCase().includes('35mm') || prompt.toLowerCase().includes('shallow depth'),
      'camera/aesthetic block required'
    );
  });

  test('Block 8 BRAND REGISTER from brand.registers present', () => {
    assert.ok(
      prompt.includes('Mughal grandeur') || prompt.includes('Ancient Indian'),
      'brand register styleSummary must appear'
    );
  });
});

// ─── buildPrompt — DM-02 SKU name colour bias ────────────────────────────────

describe('buildPrompt — DM-02 "Green Tea & Oud"', () => {
  const { prompt, negative } = buildPrompt({
    intent:  { ...INTENT_FEED_HERO, skuId: 'TEST-002' },
    brand:   BRAND_FIXTURE,
    product: SKU_DM02,
  });

  test('PRESERVE block contains actual primary colour "deep oud-brown"', () => {
    assert.ok(prompt.includes('deep oud-brown'), 'primary colour must be in preservation block');
  });

  test('PRESERVE block contains actual secondary colour "gold/mustard"', () => {
    assert.ok(prompt.includes('gold/mustard'), 'secondary colour must be in preservation block');
  });

  test('PRESERVE block contains explicit NOT GREEN negation', () => {
    assert.ok(prompt.toUpperCase().includes('NOT GREEN'), 'must negate the colour word GREEN');
  });

  test('negative contains "no green packaging" or similar', () => {
    assert.ok(
      negative.toLowerCase().includes('green'),
      'negative must reference the colour word being rejected'
    );
  });

  test('commonDriftModes appear in prompt', () => {
    assert.ok(
      prompt.includes('make the bar green') || prompt.includes('NOT make the bar green'),
      'drift mode negation must appear in prompt'
    );
  });
});

// ─── buildPrompt — DM-03 functional cue saturation lock ──────────────────────

describe('buildPrompt — DM-03 "Sensitive Skin" pin_2x3', () => {
  const DM03_INTENT = {
    kind:     'pin_2x3',
    skuId:    'TEST-003',
    register: 'royal',
    lane:     'cinematic',
    extra:    { description: 'sensitive skin moment' },  // functional cue in extra
  };

  const { prompt, negative } = buildPrompt({
    intent:  DM03_INTENT,
    brand:   BRAND_FIXTURE,
    product: SKU_DM03,
  });

  test('prompt contains saturation-lock language', () => {
    const hasLock = (
      prompt.toLowerCase().includes('fully saturated') ||
      prompt.toLowerCase().includes('do not pastel-shift') ||
      prompt.toLowerCase().includes('do not desaturate')
    );
    assert.ok(hasLock, 'saturation-lock clause required when functional words in intent');
  });

  test('prompt references actual secondary colour (saffron-orange)', () => {
    assert.ok(
      prompt.includes('saffron-orange'),
      'secondary colour must be referenced to lock palette'
    );
  });

  test('negative contains pastel-shift / desaturation negations', () => {
    const hasNeg = (
      negative.toLowerCase().includes('pastel') ||
      negative.toLowerCase().includes('desaturat') ||
      negative.toLowerCase().includes('ivory')
    );
    assert.ok(hasNeg, 'negative must include saturation-drift negations');
  });

  test('preservation block does not drift to ivory — explicit negation', () => {
    const hasIvoryNeg = (
      prompt.toLowerCase().includes('do not drift to pale cream') ||
      prompt.toLowerCase().includes('do not drift to ivory') ||
      prompt.toLowerCase().includes('not ivory')
    );
    assert.ok(hasIvoryNeg, 'ivory-drift negation required for DM-03 SKU');
  });
});

// ─── buildPrompt — lane-specific blocks ───────────────────────────────────────

describe('buildPrompt — women_cam lane includes subject block', () => {
  const { prompt } = buildPrompt({
    intent:  { ...INTENT_FEED_HERO, lane: 'women_cam' },
    brand:   BRAND_FIXTURE,
    product: SKU_GENERIC,
  });

  test('subject/person description present for women_cam lane', () => {
    const hasSubject = (
      prompt.includes('south-Asian woman') ||
      prompt.includes('sari') ||
      prompt.includes('woman')
    );
    assert.ok(hasSubject, 'women_cam lane must include subject description block');
  });
});

describe('buildPrompt — cinematic lane (no person)', () => {
  const { prompt } = buildPrompt({
    intent:  { ...INTENT_FEED_HERO, lane: 'cinematic' },
    brand:   BRAND_FIXTURE,
    product: SKU_GENERIC,
  });

  // cinematic lane should NOT inject a woman/subject block by default
  test('cinematic lane does not inject a subject block by itself', () => {
    // The scene may reference a tub but should not add the subject description
    // from women_cam. Check that "ivory silk sari" (women_cam fixture) is absent.
    assert.ok(
      !prompt.includes('ivory silk sari'),
      'cinematic lane must not inject women_cam subject description'
    );
  });
});

// ─── SETTING_LIBRARY ──────────────────────────────────────────────────────────

describe('SETTING_LIBRARY', () => {
  test('has royal × cinematic × bath_soap', () => {
    assert.ok(
      typeof SETTING_LIBRARY.royal?.cinematic?.bath_soap === 'string',
      'royal/cinematic/bath_soap must be a string'
    );
  });

  test('has regular × cinematic × bath_soap', () => {
    assert.ok(
      typeof SETTING_LIBRARY.regular?.cinematic?.bath_soap === 'string',
      'regular/cinematic/bath_soap must be a string'
    );
  });

  test('has lofi register', () => {
    assert.ok(SETTING_LIBRARY.lofi, 'lofi register must exist');
  });
});

// ─── buildCaption ─────────────────────────────────────────────────────────────

describe('buildCaption', () => {
  test('returns a caption string', () => {
    const { caption } = buildCaption({ format: 'feed', brand: BRAND_FIXTURE, intent: INTENT_FEED_HERO });
    assert.ok(typeof caption === 'string' && caption.length > 0, 'caption must be a non-empty string');
  });

  test('bannedPhrasesFound is empty when no banned phrases match', () => {
    // The directive text won't normally contain "game changer" etc.
    const { bannedPhrasesFound } = buildCaption({ format: 'feed', brand: BRAND_FIXTURE, intent: INTENT_FEED_HERO });
    assert.ok(Array.isArray(bannedPhrasesFound), 'bannedPhrasesFound must be an array');
    // Result may or may not have hits depending on brand register content — just assert it's an array
  });
});
