# SPEC-02 — Asset Prompt Library

**Status:** unimplemented
**Files to create:** `api/lib/assetPrompts.js`
**Depends on:** Brand Memory schema (PATCH-03 demonstrates it)
**Consumed by:** SPEC-01 (Generation Engine)

## Purpose

A pure-function library that assembles AI image/video generation prompts from:
1. A structured `promptIntent` (kind + scene context)
2. Brand context (registers, voice, banned visuals)
3. Optional product reference data (color, packaging, label hierarchy)

**Why a library, not inline strings:** Production runs revealed three drift modes (flat-graphic-as-bottle, color drift, bicolor partial drift) all caused by under-specified prompts. The library encodes the **"PRESERVE EXACTLY" anchor pattern** that fixed them, plus the **9-block prompt architecture**, and applies them consistently.

## Public API

```js
// api/lib/assetPrompts.js

/**
 * Build the final prompt string for a generation request.
 * @param {Object} args
 * @param {Object} args.intent       — { kind, skuId, register, lane, story, beat, extra }
 * @param {Object} args.brand        — full brand record (registers, banned visuals, voice)
 * @param {Object} args.product      — { name, packaging, barColor?, boxColor?, labelHierarchy? }
 * @returns {{ prompt: string, negative: string }}
 */
export function buildPrompt({ intent, brand, product });

/**
 * Build the bottle/product-preservation anchor block.
 * The block goes at the TOP of any prompt that includes the product.
 * @returns {string}
 */
export function preservationBlock(product);

/**
 * Build the negative prompt from brand banned-visuals + intent-specific additions.
 * Returns a single comma-separated string, ready to append to the prompt.
 */
export function buildNegative(brand, intentExtras = []);
```

## The 9-block prompt architecture (LOCKED)

Every prompt assembled by this library follows the same block order:

1. **FORMAT CONTEXT** — e.g. "Luxury beauty editorial, 9:16 vertical."
2. **PRESERVATION ANCHOR** — the "PRESERVE THE PRODUCT EXACTLY..." block (only when a product is in frame)
3. **SCENE / SETTING** — derived from `register` + `lane` lookup tables
4. **WOMAN / SUBJECT** (optional, only if `lane` includes a person)
5. **PRODUCT PLACEMENT** — explicit position, label legibility instruction
6. **LIGHTING**
7. **CAMERA / AESTHETIC** — e.g. "35mm film grain, shallow DOF, handheld feel"
8. **BRAND REGISTER** — pulled from `brand.registers[register].styleSummary`
9. **NEGATIVE LIST** — combined banned visuals + intent-specific exclusions

## The Preservation Block (the critical one — LEARNED)

This is the block that prevents "model invents the product from a hallucinated mental model." It must be:

- Verbose and specific (not "preserve the product" but a full description)
- Use the word "EXACTLY" (uppercase) at least twice
- Explicitly negate the most common drift mode for this product
- Reference the input image as authority

Template:

```
PRESERVE THE PRODUCT EXACTLY AS SHOWN IN THE REFERENCE IMAGE: {productDescription}.
Match the {silhouette}, the {primaryColor}, the {secondaryColor}, every label element EXACTLY.
Do NOT {drift_negation_1}.
Do NOT {drift_negation_2}.
The signature palette is {primary} and {secondary}.
```

Concrete example (drawn from the DM-02 case study — see `drift-modes/DM-02-sku-name-colour-bias.md`). For a hypothetical SKU named "Green Tea & Oud" whose actual packaging is gold/mustard with a deep oud-brown bar:

```
PRESERVE THE PRODUCT EXACTLY AS SHOWN IN THE REFERENCE IMAGE: a deep oud-brown rectangular bar
(almost black-brown, the color of aged agarwood resin, NOT GREEN) paired with its
gold/mustard-yellow cardboard box featuring a cream-yellow ornate filigree border, circular gold
{brand} monogram at top, gold {brand} wordmark, cream-gold inset panel reading
'AYURVEDIC BAR SOAP / Green Tea & Oud / 100g | 3.52 fl oz'. Match the deep oud-brown bar color,
the gold/mustard box color, the cream-yellow filigree border, every label element EXACTLY.
Do NOT make the bar green.
Do NOT make the box forest-green.
Signature palette is GOLD and DEEP OUD-BROWN.
```

The drift negations are populated from the product record's `commonDriftModes` array (per-SKU field, set during onboarding/audit when a tenant uploads packshots).

## Setting library — register × lane lookup

`api/lib/assetPrompts.js` exports `SETTING_LIBRARY`:

```js
export const SETTING_LIBRARY = {
  // Settings live per register × lane × product-type. Brand-agnostic strings;
  // the brand record's "registers" object overrides anything brand-specific.
  royal: {
    cinematic: {
      bath_soap: "freestanding marble tub inside a Mughal palace bath chamber, carved sandstone arches, latticed gold light from a jharokha",
      body_oil:  "marble vanity inside a Punjabi haveli bedroom, brass fittings, golden hour through a high arched window",
      // ...
    },
    women_cam: { /* same SKU keys */ },
    lifestyle: { /* same */ },
  },
  regular: { /* same lane keys */ },
  lofi:    { /* same lane keys */ },
};
```

The brand record can override any cell via `brand.registers[name].overrides[lane][skuType]`.

## Voice / negative integration

The negative prompt always includes:
1. `brand.bannedVisuals` (per-tenant — populated during onboarding from the brand's "always out" list)
2. Universal: `no text overlays, no deformed hands, no caricature`
3. Intent-specific drift negations from the product record's `commonDriftModes`

These are joined with commas and appended after the prompt body.

## Soft-guardrail vs hard-reject (LEARNED)

The original brand spec had banned visuals as hard rejects. Production showed this was too brittle — incidental marigold petals in an otherwise-strong palace cinematic shouldn't auto-reject.

The library distinguishes:
- **Banned in negative prompt:** every banned visual (steers the model away)
- **Hard-reject post-generation:** only when the banned element DOMINATES the frame (per SPEC-05's quality gate vision check)

## Brand-aware caption assembly (bonus)

The same library should expose `buildCaption({ format, brand, content })` for caption generation. The format-specific templates (FEED 2-3 sentences, STORY 1-2 sentences, CAROUSEL 3-slide arc, REEL 1-2 lines, PIN search-friendly) are universal; the **voice rules** (banned phrases, signature lines, em-dash conventions) come from `brand.voice`.

```js
export function buildCaption({ format, brand, intent, asset });
```

Validation runs banned-phrase regex against the output before returning. If a phrase is matched, the caller (SPEC-01) regenerates with a stricter prompt.

## Test strategy

`tests/unit/assetPrompts.test.js`:
- Snapshot test: `buildPrompt({ intent: feed_hero, sku: <fixture-sku-with-commonDriftModes>, brand: <fixture-brand> })` should produce a prompt where (a) the PRESERVE block is present at the top, (b) every entry in `commonDriftModes` appears as an explicit negation, (c) all `brand.bannedVisuals` appear in the negative list
- Banned-phrase regex catches every phrase in `brand.voice.bannedPhrases`
- Negative list dedupes across brand bans + intent-specific extras
