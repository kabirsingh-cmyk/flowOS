/**
 * SPEC-02 — Asset Prompt Library
 *
 * Pure-function library that assembles AI image/video generation prompts from:
 *   1. A structured promptIntent (kind + scene context)
 *   2. Brand context (registers, voice, banned visuals)
 *   3. Product reference data (color, packaging, label hierarchy)
 *
 * Defends against:
 *   DM-01 — flat artwork used as packshot reference (PRESERVE EXACTLY anchor)
 *   DM-02 — SKU-name colour bias (explicit negation when colour word in name)
 *   DM-03 — functional cue palette bias (saturation-lock clause on trigger words)
 */

// ─── DM-02: Colour-word detection ─────────────────────────────────────────────
// When a SKU name contains any of these words the model's semantic prior may
// override the visual reference, shifting the palette toward the named colour.
export const COLOUR_WORDS =
  /\b(green|pink|black|red|crimson|saffron|honey|amber|gold|silver|blue|navy|cream|ivory|forest|emerald|onyx|ruby|chocolate|caramel|coral|peach|lavender|sand)\b/i;

// ─── DM-03: Functional / sensitivity cue detection ────────────────────────────
// When these words appear in intent text, latent colour associations push the
// model toward muted pastels — even when the reference palette is saturated.
export const FUNCTIONAL_BIAS_WORDS = [
  'sensitive', 'gentle', 'calming', 'delicate', 'soothing', 'mild', 'soft',
  'tender', 'kind', 'fragile', 'subtle', 'whisper',
];

// ─── Setting library (register × lane × product-type) ─────────────────────────
// Brand-agnostic scene strings. Brand record overrides via
// brand.registers[name].overrides[lane][skuType].
export const SETTING_LIBRARY = {
  royal: {
    cinematic: {
      bath_soap:  'freestanding marble tub inside a Mughal palace bath chamber, carved sandstone arches, latticed gold light from a jharokha',
      body_oil:   'marble vanity inside a Punjabi haveli bedroom, brass fittings, golden hour through a high arched window',
      face_serum: 'Rajput zenana courtyard at dawn, jasmine garlands, hand-beaten brass mirror, warm diffused light',
      candle:     'sandstone alcove niche in a haveli, silk drape catching amber candlelight, carved lattice shadow play',
      default:    'Mughal-era palace interior, carved marble surfaces, warm amber light, ornate brass accents',
    },
    women_cam: {
      bath_soap:  'woman in ivory silk sari stepping from a marble hammam, gold bangles, dewy skin',
      body_oil:   'woman seated at a carved brass vanity in a haveli room, applying oil, caught in golden-hour light',
      face_serum: 'close-up — woman with luminous skin holding the serum beside her cheek, palace archway softly blurred behind',
      default:    'south-Asian woman, elegant traditional dress, palace setting, soft dramatic lighting',
    },
    lifestyle: {
      bath_soap:  'flat-lay on pale marble — soap, dried rose petals, raw honey, gold-rimmed ceramic dish',
      body_oil:   'editorial tray arrangement — oil bottle, jasmine flowers, carved wooden comb, aged brass tray',
      default:    'artisanal editorial flat-lay on marble, warm tone, botanical accents',
    },
  },

  regular: {
    cinematic: {
      bath_soap:  'clean white tiled bathroom, soft morning window light, ceramic soap dish, dried botanicals',
      body_oil:   'bright minimal bathroom counter, clean linen, eucalyptus spray, indirect daylight',
      face_serum: 'glass-topped vanity, morning light haze, dropper catching light',
      candle:     'dark oak shelf, single flame, evening ambient, bokeh background',
      default:    'clean modern interior, soft neutral tones, indirect natural light',
    },
    women_cam: {
      bath_soap:  'woman in plush towel, steamy bathroom mirror, relaxed post-shower moment',
      body_oil:   'woman applying body oil in a sun-dappled bedroom, white linen, ease',
      default:    'modern woman, contemporary interior, natural light, relaxed vibe',
    },
    lifestyle: {
      bath_soap:  'flat-lay on white linen — bar soap, dried lavender, ceramic tile fragments',
      default:    'minimal flat-lay, white background, product + 2–3 botanical accents',
    },
  },

  lofi: {
    cinematic: {
      bath_soap:  'sun-drenched windowsill, cracked terracotta tile, bar soap surrounded by wildflowers',
      body_oil:   'bedside table, messy linen, oil bottle in morning sun, lazy day feel',
      default:    'grainy film look, warm afternoon light, lived-in domestic setting',
    },
    women_cam: {
      bath_soap:  'candid shot — laughing woman lathering soap in a sunny outdoor shower',
      default:    'candid, natural, laughing, warm grain, handheld feel',
    },
    lifestyle: {
      default:    'lo-fi product-only still, grain, warm tones, organic imperfection',
    },
  },
};

// ─── Format / aspect-ratio metadata ───────────────────────────────────────────
const FORMAT_CONTEXTS = {
  feed_hero:              'Luxury beauty editorial, 4:5 vertical.',
  story:                  'Instagram Story, 9:16 vertical, full-bleed.',
  carousel_1:             'Carousel opener — hero lifestyle, 4:5.',
  carousel_2_ingredient:  'Carousel slide 2 — ingredient close-up, 4:5.',
  carousel_3_texture:     'Carousel slide 3 — texture / lather / finish, 4:5.',
  pin_2x3:                'Pinterest 2:3 vertical, search-friendly product editorial.',
  reel_beat:              'Cinematic reel beat frame, 9:16 vertical.',
  reel_beat_1_frame:      'Reel beat 1 — establishing scene, 9:16 vertical.',
  reel_beat_2_frame:      'Reel beat 2 — product reveal, 9:16 vertical.',
  reel_beat_3_frame:      'Reel beat 3 — close-up texture / result, 9:16 vertical.',
  reel_beat_4_frame:      'Reel beat 4 — lifestyle moment, 9:16 vertical.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detect the colour-word bias present in a SKU name (DM-02). Returns matched word or null. */
function detectColourWord(skuName = '') {
  const m = skuName.match(COLOUR_WORDS);
  return m ? m[0].toLowerCase() : null;
}

/** Detect functional/sensitivity words in an intent description (DM-03). */
function detectFunctionalBias(text = '') {
  const lower = text.toLowerCase();
  return FUNCTIONAL_BIAS_WORDS.filter(w => lower.includes(w));
}

/** Resolve a setting string from the library, with brand override support. */
function resolveScene(intent, brand, product) {
  // Caller-supplied scene wins outright — e.g. chat-to-create drafts where the
  // user (or drafter LLM) wrote a complete visual description.
  if (intent.scene) return intent.scene;
  if (intent.extra?.scene) return intent.extra.scene;

  const register  = intent.register || 'regular';
  const lane      = intent.lane     || 'cinematic';
  const skuType   = product?.skuType || 'default';

  // Brand override wins
  const override = brand?.registers?.[register]?.overrides?.[lane]?.[skuType];
  if (override) return override;

  // Library lookup with fallback chain: skuType → 'default'
  const byRegister = SETTING_LIBRARY[register] || SETTING_LIBRARY.regular;
  const byLane     = byRegister?.[lane] || byRegister?.cinematic || {};
  return byLane[skuType] || byLane.default || 'elegant interior, soft warm light';
}

// ─── Preservation Block (SPEC-02 §"The Preservation Block") ──────────────────

/**
 * Build the PRESERVE EXACTLY anchor block for a product.
 * Goes at the TOP of any prompt that includes the product in frame.
 * Encodes DM-02 colour-word negation and DM-03 saturation-lock.
 *
 * @param {Object} product — { name, packaging, barColor?, boxColor?,
 *                             labelHierarchy?, commonDriftModes?,
 *                             skuName?, productColors? }
 * @param {Object} options — { colourBiasWord?, functionalBiasWords? }
 * @returns {string}
 */
export function preservationBlock(product, options = {}) {
  const {
    name         = 'the product',
    packaging    = '',
    barColor     = '',
    boxColor     = '',
    labelHierarchy = '',
    commonDriftModes = [],
    productColors = {},
  } = product || {};

  const { colourBiasWord = null, functionalBiasWords = [] } = options;

  const primaryColour   = productColors.primary   || barColor  || 'as shown in reference';
  const secondaryColour = productColors.secondary  || boxColor  || 'as shown in reference';

  // Base preservation paragraph
  let block = `PRESERVE THE PRODUCT EXACTLY AS SHOWN IN THE REFERENCE IMAGE: ${packaging || name}.`;

  if (primaryColour && secondaryColour) {
    block += ` Match the ${primaryColour} primary colour, the ${secondaryColour} secondary colour, every label element EXACTLY.`;
  } else {
    block += ` Match the silhouette, every colour, every label element EXACTLY.`;
  }

  if (labelHierarchy) {
    block += ` Label hierarchy: ${labelHierarchy}.`;
  }

  // DM-02 — SKU name colour-word explicit negation
  if (colourBiasWord && primaryColour) {
    const nameColour = colourBiasWord.toUpperCase();
    block += `\nDo NOT make the product ${nameColour}.`;
    if (productColors.primary) {
      block += ` The primary component is ${productColors.primary} (NOT ${nameColour}).`;
    }
    if (productColors.secondary) {
      block += ` The secondary component is ${productColors.secondary} (NOT ${nameColour}).`;
    }
  }

  // DM-03 — Functional cue saturation-lock
  if (functionalBiasWords.length > 0 && secondaryColour) {
    block += `\nThe packaging colour is ${secondaryColour}, fully saturated. Do not pastel-shift. Do not desaturate.`;
    block += ` The signature palette is bold and stays bold regardless of the brand's "${functionalBiasWords[0]}" positioning.`;
    if (secondaryColour !== 'as shown in reference') {
      block += ` NEGATIVE: the box must remain ${secondaryColour}, do not drift to pale cream, do not drift to ivory, do not soften the saturation.`;
    }
  }

  // Per-SKU drift mode negations (from product.commonDriftModes)
  for (const drift of commonDriftModes) {
    block += `\nDo NOT ${drift}.`;
  }

  // Signature palette summary
  if (primaryColour && secondaryColour &&
      primaryColour !== 'as shown in reference' &&
      secondaryColour !== 'as shown in reference') {
    block += `\nSignature palette is ${secondaryColour.toUpperCase()} and ${primaryColour.toUpperCase()}.`;
  }

  return block;
}

// ─── Negative Prompt Builder ───────────────────────────────────────────────────

/**
 * Build the combined negative prompt string.
 * Includes: brand banned visuals + universal negatives + intent-specific extras.
 *
 * @param {Object} brand          — full brand record
 * @param {string[]} intentExtras — additional negative terms from intent/drift detection
 * @returns {string}              — comma-separated negative prompt
 */
export function buildNegative(brand = {}, intentExtras = []) {
  const universal = [
    'no text overlays',
    'no watermark',
    'no deformed hands',
    'no extra fingers',
    'no caricature',
    'no illustration style',
    'no cartoon',
    'no 2D graphic',
    'no flat artwork',       // DM-01 defence
    'no packaging mock-up',  // DM-01 defence
    'no CGI render look',
    'no stock-photo vibe',
    'blurry',
    'overexposed',
    'plastic skin',
  ];

  const brandBanned = Array.isArray(brand.bannedVisuals) ? brand.bannedVisuals : [];

  // Deduplicate across all three sources
  const seen  = new Set();
  const parts = [];
  for (const term of [...universal, ...brandBanned, ...intentExtras]) {
    const key = term.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      parts.push(term.trim());
    }
  }

  return parts.join(', ');
}

// ─── Caption Builder ──────────────────────────────────────────────────────────

/**
 * Build a brand-aware caption for a content format.
 * Validates against brand.voice.bannedPhrases before returning.
 *
 * @param {Object} args
 * @param {string} args.format  — 'feed' | 'story' | 'carousel' | 'reel' | 'pin'
 * @param {Object} args.brand   — full brand record
 * @param {Object} args.intent  — promptIntent
 * @param {Object} args.asset   — generated asset metadata
 * @returns {{ caption: string, bannedPhrasesFound: string[] }}
 */
export function buildCaption({ format, brand = {}, intent = {}, asset = {} }) {
  const voice      = brand.voice      || {};
  const register   = intent.register  || 'regular';
  const regRecord  = brand.registers?.[register] || {};
  const styleSummary = regRecord.styleSummary || '';

  // Format-specific length guidance
  const lengthGuide = {
    feed:     'Write 2–3 sentences.',
    story:    'Write 1–2 sentences. Short, punchy.',
    carousel: 'Write a 3-part arc: opening hook, product fact, CTA.',
    reel:     'Write 1–2 lines. Rhythmic, scroll-stopping.',
    pin:      'Write search-friendly copy: product name + key benefit + call to action.',
  }[format] || 'Write 2 sentences.';

  // Voice direction from brand record
  const voiceNotes = [
    voice.tone          ? `Tone: ${voice.tone}.`          : '',
    voice.signatureLines?.length ? `Signature lines to consider: ${voice.signatureLines.join(' / ')}.` : '',
    styleSummary        ? `Register style: ${styleSummary}.` : '',
  ].filter(Boolean).join(' ');

  // Compose the "caption" placeholder
  // In production this would call the LLM; here we return a structured directive
  // that the Generation Engine (SPEC-01) can pass to its caption model call.
  const directive = `[CAPTION PROMPT — ${format.toUpperCase()}] ${lengthGuide} ${voiceNotes}`.trim();

  // Banned-phrase validation
  const bannedPhrases = Array.isArray(voice.bannedPhrases) ? voice.bannedPhrases : [];
  const bannedPhrasesFound = bannedPhrases.filter(phrase =>
    directive.toLowerCase().includes(phrase.toLowerCase())
  );

  return { caption: directive, bannedPhrasesFound };
}

// ─── Core Prompt Builder (9-block architecture) ───────────────────────────────

/**
 * Build the final prompt string (and negative) for a generation request.
 *
 * Block order (LOCKED):
 *   1. FORMAT CONTEXT
 *   2. PRESERVATION ANCHOR     (only when product in frame)
 *   3. SCENE / SETTING
 *   4. WOMAN / SUBJECT         (only when lane includes a person)
 *   5. PRODUCT PLACEMENT
 *   6. LIGHTING
 *   7. CAMERA / AESTHETIC
 *   8. BRAND REGISTER
 *   9. NEGATIVE LIST
 *
 * @param {Object} args
 * @param {Object} args.intent   — { kind, skuId, register, lane, story, beat, extra }
 * @param {Object} args.brand    — full brand record
 * @param {Object} args.product  — { name, packaging, barColor, boxColor,
 *                                   labelHierarchy, commonDriftModes,
 *                                   skuName, productColors, skuType }
 * @returns {{ prompt: string, negative: string }}
 */
export function buildPrompt({ intent = {}, brand = {}, product = {} }) {
  const {
    kind       = 'feed_hero',
    register   = 'regular',
    lane       = 'cinematic',
    extra      = {},
  } = intent;

  const skuName = product.skuName || product.name || '';

  // ── DM-02: detect colour word in SKU name ──────────────────────────────────
  const colourBiasWord = detectColourWord(skuName);
  // Merge any extra colour hints from intent.extra into product for preservation block
  const enrichedProduct = {
    ...product,
    barColor: extra.barColor || product.barColor || '',
    boxColor: extra.boxColor || product.boxColor || '',
  };

  // ── DM-03: detect functional bias words ───────────────────────────────────
  const intentText        = [kind, JSON.stringify(extra)].join(' ');
  const functionalBiasWords = detectFunctionalBias(intentText);

  // ── Block 1: FORMAT CONTEXT ────────────────────────────────────────────────
  const formatContext = FORMAT_CONTEXTS[kind] || `Content format: ${kind}.`;

  // ── Block 2: PRESERVATION ANCHOR ──────────────────────────────────────────
  // Always included when product data is provided
  const hasProduct = !!(product.name || product.packaging);
  const preservation = hasProduct
    ? preservationBlock(enrichedProduct, { colourBiasWord, functionalBiasWords })
    : null;

  // ── Block 3: SCENE / SETTING ───────────────────────────────────────────────
  const scene = resolveScene(intent, brand, product);

  // ── Block 4: WOMAN / SUBJECT ───────────────────────────────────────────────
  // Only for lanes that include a human subject
  const personLanes  = new Set(['women_cam']);
  const subjectBlock = personLanes.has(lane)
    ? (brand.registers?.[register]?.subjectDescription ||
       SETTING_LIBRARY[register]?.women_cam?.default ||
       'south-Asian woman, elegant traditional dress, soft dramatic lighting')
    : null;

  // ── Block 5: PRODUCT PLACEMENT ─────────────────────────────────────────────
  const productPlacement = hasProduct
    ? `Product placement: ${product.name || 'the product'} prominently in frame. Label fully legible, not obscured.`
    : null;

  // ── Block 6: LIGHTING ─────────────────────────────────────────────────────
  const lightingByRegister = {
    royal:   'Warm Rembrandt lighting — single key from a high-arched window, gold-amber fill, deep background shadows. Chiaroscuro depth.',
    regular: 'Soft diffused window light, subtle shadow gradients, flattering and clean.',
    lofi:    'Honest daylight, high ambient, minimal studio feel — golden hour or overcast. Grainy film stop.',
  };
  const lighting = lightingByRegister[register] || lightingByRegister.regular;

  // ── Block 7: CAMERA / AESTHETIC ───────────────────────────────────────────
  const cameraByLane = {
    cinematic:   '35mm film grain, shallow depth of field, anamorphic lens character, subtle lens flare on highlight edges.',
    women_cam:   '50mm portrait lens, f/1.8 shallow DOF, skin-toned colour grading, editorial magazine finish.',
    lifestyle:   'Medium format editorial, f/8 deeper DOF for product sharpness, natural colour science.',
  };
  const camera = cameraByLane[lane] || cameraByLane.cinematic;

  // ── Block 8: BRAND REGISTER ────────────────────────────────────────────────
  const regRecord    = brand.registers?.[register] || {};
  const brandRegister = regRecord.styleSummary
    ? `Brand register — ${regRecord.styleSummary}`
    : null;

  // ── Block 9: NEGATIVE LIST ─────────────────────────────────────────────────
  // Collect intent-specific extras: per-SKU drift modes + DM-02/03 negations
  const negExtras = [];

  // DM-02 negations if colour word detected
  if (colourBiasWord) {
    negExtras.push(`no ${colourBiasWord} packaging`);
    negExtras.push(`no ${colourBiasWord} product colour`);
  }

  // DM-03 negations if functional words detected and colours known
  if (functionalBiasWords.length > 0 && product.productColors?.secondary) {
    negExtras.push('no pastel shift');
    negExtras.push('no desaturation');
    negExtras.push('no ivory drift');
    negExtras.push('no pale cream packaging');
  }

  // From product.commonDriftModes (stored per-SKU after onboarding audit)
  const driftNegations = (product.commonDriftModes || []).map(d => `no ${d}`);

  const negative = buildNegative(brand, [...driftNegations, ...negExtras]);

  // ── Assemble all blocks ────────────────────────────────────────────────────
  const blocks = [
    formatContext,
    preservation,
    scene,
    subjectBlock,
    productPlacement,
    lighting,
    camera,
    brandRegister,
  ].filter(Boolean);

  const prompt = blocks.join('\n\n');

  return { prompt, negative };
}
