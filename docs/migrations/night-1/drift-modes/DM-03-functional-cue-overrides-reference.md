# DM-03 — Functional Cue Overrides Reference

**Severity:** Medium — usually affects single assets within a set, not the whole set
**Class:** Cross-modal contamination from caption / intent text into visual generation

## Symptom

When the prompt includes **functional or sensitivity descriptors** ("sensitive skin", "gentle", "calming", "delicate", "fragile"), the model nudges the visual palette toward soft pastels and cream/ivory tones — even when the reference image shows a bold, saturated palette.

Common manifestations:

- A bold saffron-orange box rendered in pale ivory because the SKU is positioned for "sensitive skin"
- A vivid red liquid rendered as muted dusty rose because the copy describes it as "gentle"
- High-contrast packaging softened to low-contrast neutrals because the brief mentions "calming"

Distinguishing feature from DM-02 (SKU-name colour bias): in DM-03 the SKU name doesn't necessarily contain a colour word. The drift is driven by **functional adjectives** that have latent colour associations in the model's training data (the visual vocabulary of "sensitive" = soft pastel; "calming" = muted; "gentle" = pale).

Often only ONE asset in a set drifts (the one whose intent description happened to include the trigger word in a particular way), making this a silent failure unless the platform runs per-asset colour validation.

## Root cause

Cross-modal contamination. The prompt assembly often pulls intent description text from the brand's marketing copy or the SKU's category. For SKUs in "sensitive skin" / "calming" / "gentle" lines, that copy carries the trigger words even when describing the visual.

The model's text encoder doesn't separate "what to show" from "how the user feels about it" — adjectives describing the experience contaminate the adjectives describing the look.

## Detection

### Pre-flight (during prompt assembly — SPEC-02)
The asset prompt library checks if intent text contains words from `FUNCTIONAL_BIAS_WORDS`:

```js
const FUNCTIONAL_BIAS_WORDS = [
  'sensitive', 'gentle', 'calming', 'delicate', 'soothing', 'mild', 'soft',
  'tender', 'kind', 'fragile', 'subtle', 'whisper'
];
```

If any are present AND the SKU has `productColors` set, the prompt-builder appends a colour-locking clause:

```
NEGATIVE: the box must remain {actualSecondaryColour}, do not drift to pale cream,
do not drift to ivory, do not soften the saturation. The signature palette is bold
and stays bold regardless of the brand's "sensitive" / "gentle" positioning.
```

### Post-flight (quality gates — SPEC-01)
Per-asset colour sample (same mechanism as DM-02 detection). Per-asset, not just per-set — DM-03 often only affects one of seven assets, so set-level checks miss it.

## Prevention

1. **The PRESERVE EXACTLY block in SPEC-02 includes a saturation-lock clause** when functional cue words are detected in the intent. Pattern: *"The packaging colour is {actualColour}, fully saturated. Do not pastel-shift. Do not desaturate."*
2. **Intent text sanitisation** — the prompt-builder splits intent descriptions into "visual intent" (what the camera sees) and "experience intent" (how the user feels). Functional words go into the experience portion, which DOESN'T enter the image generation prompt — it only flavours the caption generation.
3. **Per-asset (not just per-set) quality gate** — every asset in a set is independently colour-validated against `productColors`.

## Test strategy

`tests/unit/assetPrompts.test.js`:
- Build a fixture SKU `TEST-003` with functional positioning "Sensitive Skin" and `productColors.secondary = 'saffron-orange'`
- Call `buildPrompt(intent: pin_2x3, sku: TEST-003)` with intent description containing "sensitive skin"
- Assert prompt contains explicit saturation lock — language like `"saffron-orange... do not drift to pale cream, do not drift to ivory"`

`tests/integration/quality-gates.test.js`:
- Mock generation returning desaturated/pastel-shifted output for a single asset (e.g. PIN format)
- Assert per-asset colour gate flags it even when the rest of the set passes
- Assert the regen prompt includes additional saturation-lock language

## Real-world example

Documented during an early production run. A "Saffron & Turmeric Sensitive Skin" bar soap had 7 generated assets. Six were correct (bicolor saffron-yellow + cream-white bar; saffron-orange box). The seventh (a Pinterest 2:3 pin) drifted: bar correct, but box rendered as pale ivory with subtle gold trim instead of vivid saffron-orange.

Investigation: the PIN intent description included "sensitive skin moment" verbatim, which the other intent descriptions had phrased differently. The pastel-shift was specific to that one prompt's wording.

Fix was a single-asset regen with explicit saturation lock: *"...the box colour is a vivid warm saffron-orange, NOT pale cream, NOT ivory..."* Other six assets weren't touched.

The lesson generalised: **per-asset validation matters; intent text contaminates visuals; saturation locks belong in any prompt whose intent contains functional/sensitivity language**.
