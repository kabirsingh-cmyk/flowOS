# DM-02 — SKU-Name Colour Bias

**Severity:** Critical — wrong palette propagates across all assets in a coherent set
**Class:** Semantic prior overrides visual reference

## Symptom

When a SKU name contains a **colour word** (Green, Pink, Black, Crimson, Saffron, Honey, etc.), the generation model semantically associates the entire visual with that colour — even when the actual product uses a different palette. Common manifestations:

- A "Green Tea & Oud" soap rendered with a forest-green box when the actual box is gold/mustard
- A "Black Cherry" candle rendered in onyx packaging when the actual jar is amber glass with red wax
- A "Pink Salt" scrub bar rendered in pastel-pink packaging when the actual product is white

The drift is **internally consistent** — every asset in the set shifts the same wrong direction. This makes it the most dangerous drift class: the result looks correct (the colours match each other) until you compare against the actual product.

Cascading failure: when the wrong palette propagates to associated visuals (woman's wardrobe in a reel, silk drape colour, environment tones), regenerating just the product still leaves the rest of the frame off. The platform must catch this before that cascade compounds.

## Root cause

Image-to-image models combine two priors when generating:

1. **Visual prior** from the reference image (pixels)
2. **Semantic prior** from the prompt text (latent associations)

When prompt text contains the SKU name verbatim — and that name contains a colour word — the semantic prior weights heavily. If the reference image's palette is subtle or low-contrast in the relevant region, the semantic prior can override visual signal entirely.

This is amplified by:
- Reference images that crop tightly on the product (less surrounding context to ground "this is a brown product, not a green one")
- Brand voice that leans on the colour word ("Green Tea & Oud — the bar that holds the green of a forest...")
- SKU names where the colour describes an ingredient that would naturally be that colour (green tea is green; the bar made from it might or might not be)

## Detection

### Pre-flight (during prompt assembly — SPEC-02)
The asset prompt library, when building a prompt for a SKU, checks if the SKU name matches a `colourWordRegex`:

```js
const COLOUR_WORDS = /\b(green|pink|black|red|crimson|saffron|honey|amber|gold|silver|blue|navy|cream|ivory|forest|emerald|onyx|ruby|chocolate|caramel|coral|peach|lavender|rose|sand)\b/i;
```

If matched, the prompt-builder requires a `productColors` field on the SKU record (set during onboarding from the canonical packshot vision-classification). The PRESERVE EXACTLY block then includes explicit negation language:

```
The bar is {actualPrimaryColour} (NOT {sku_colour_word_in_name}).
The box is {actualSecondaryColour} (NOT {sku_colour_word_in_name}).
```

### Post-flight (quality gates — SPEC-01)
After generation, sample dominant hex from product region (segmentation mask + median hue), compare against expected `productColors`. If divergence is > threshold (in OKLCH ΔE space, threshold ~0.08), flag for auto-regen with stronger negation language.

## Prevention

1. **`productColors` field is mandatory** for any SKU whose name matches `COLOUR_WORDS` regex. The onboarding flow should refuse to mark such a SKU as ready-to-generate until the operator confirms the actual primary + secondary colours from a real photograph.
2. **The PRESERVE EXACTLY anchor (SPEC-02) emits explicit negation** when the SKU name colour word doesn't match `productColors`. Pattern: *"...the {component} is {actualColour}, NOT {nameColour}..."*
3. **Per-SKU `skuDriftModes` array** in the brand record (operator-flaggable) auto-injects into NEGATIVE lists.
4. **Wardrobe/silk/environment colours derived AFTER product colours are confirmed.** The pipeline generates the product hero first, vision-validates, then derives associated palette colours. Avoids cascading the wrong palette to derivative assets.

## Test strategy

`tests/unit/assetPrompts.test.js`:
- Build a fixture SKU `TEST-002` with name "Green Tea & Oud", `productColors: { primary: 'deep oud-brown', secondary: 'gold/mustard' }`
- Call `buildPrompt(intent: feed_hero, sku: TEST-002)`
- Assert the returned prompt contains both:
  - `"deep oud-brown"` and `"gold/mustard"` in PRESERVE block
  - `"NOT GREEN"` (or equivalent negation of the SKU name's colour word) in PRESERVE or NEGATIVE block

`tests/integration/quality-gates.test.js`:
- Mock the generation engine to return an image where dominant product-region hue is forest-green
- For SKU `TEST-002` with `productColors.primary = 'deep oud-brown'`, expect quality gate to flag the asset
- Assert auto-retry runs with stronger negation language (verify `prompt_used` field on the retry)

## Real-world example

Documented during an early production run. A "Green Tea & Oud" bar soap had a real product photograph as reference (deep oud-brown bar + gold/mustard box, jaali screen behind). Initial generations returned forest-green box + emerald green bar across all 7 stills + 2 reel beat frames. The wardrobe in the reel beat (a velvet sari) drifted to emerald velvet to "match," compounding the failure.

The fix was a complete regen with explicit colour callouts: *"deep oud-brown (almost black-brown, NOT GREEN)"* and *"gold/mustard-yellow (NOT forest-green)"* repeated in every prompt, plus negative-list entries *"no emerald wardrobe, no green sari."* All 9 outputs corrected on first regen.

The lesson generalised: **SKU names are unreliable colour authorities; the only authoritative colour source is a vision-classified real product photograph or operator-confirmed colour fields**.
