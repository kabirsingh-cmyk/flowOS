# DM-01 — Flat Graphic vs 3D Product Reference

**Severity:** High — entire generation set drifts coherently because the model has no anchor
**Class:** Reference content mismatch

## Symptom

When a tenant uploads a "packshot" file whose **filename suggests a product photograph** but whose **content is actually a 2D label artwork** (a flat printed surface with no bottle, box, or 3D form), every generation referencing that file produces a hallucinated product. Common manifestations:

- Bottles in invented shapes (tall amber glass when actual is short clear cylinder, etc.)
- Cap colours that change between generations (model improvises differently each call)
- Label hierarchies invented (text fields placed in wrong order, wrong typography)
- Cross-asset inconsistency — every still drifts a different wrong direction because there's no shared visual anchor

The set looks superficially "branded" because the colour fields and rough composition match — but the actual product silhouette is wrong everywhere.

## Root cause

Image-to-image models extract their geometric and material priors from the reference image's pixel content, NOT from filename or metadata. A flat label artwork file:

1. Has no 3D form to extract — model fills in geometry from generic priors
2. Has no material cues (glass / cardboard / gold foil) — model picks plausible defaults
3. Often has the brand's colour palette, which makes the result look "right" at a glance

Filename conventions (`_packshot_a`, `_hero`, `_packshot_b`) are advisory only. They do not guarantee the file depicts a 3D physical product.

## Detection

Two-layer detection in the platform:

### Pre-flight (during asset upload — SPEC-05)
For any file claiming `asset_kind = 'packshot'` or matching `_packshot_*` / `_hero` filename patterns, run a secondary vision classifier:

```
"Is this image a photograph of a 3D physical product, or a flat 2D label/artwork
file? Respond ONLY with: 3d_product | flat_artwork | ambiguous."
```

Files classified as `flat_artwork` are demoted to `asset_kind = 'label_artwork'` and **must never be picked as generation references.** They remain useful for design/print contexts.

### Post-flight (after generation — SPEC-01 quality gates)
Vision query on the generated result: *"Describe the product silhouette in this image in one sentence."* Compare against the tenant's `productSilhouette` field (set during onboarding from the canonical packshot). Significant divergence flags the asset for regen with stronger preservation language.

## Prevention

Three layers, listed by leverage:

1. **The "PRESERVE EXACTLY" anchor block** in every prompt that includes the product (SPEC-02). The block is verbose and specific — describes silhouette, primary colour, secondary colour, label layout, materials. Goes at the TOP of the prompt body, before scene description.
2. **Per-SKU `commonDriftModes` array** in the brand record. When a tenant has flagged a drift mode for a SKU (operator UI: "this SKU's reference is misleading"), the platform auto-injects negation language into the NEGATIVE list for every generation involving that SKU.
3. **Packshot fallback chain that prefers verified 3D photography.** When resolving a packshot for generation, the engine prioritises `asset_kind = 'packshot_3d_product'` files over `_hero` or `_packshot_a` files that haven't been verified.

## Test strategy

`tests/integration/source-index.test.js`:
- Seed with a tenant fixture containing 2 files for one SKU: a flat-artwork file named `<sku>_packshot_a.png` and a real bottle photograph named `<sku>_packshot_c.png`
- Run the source-index classifier
- Assert `_packshot_a` is classified as `label_artwork`, `_packshot_c` as `packshot_3d_product`
- Assert the generation engine, asked for a packshot reference for that SKU, returns `_packshot_c`

`tests/integration/generation-engine.test.js`:
- Force the engine to use a `flat_artwork` file as reference (override the chain)
- Assert it returns a structured warning: *"reference is flat_artwork; results may drift; consider regenerating after operator approves a 3D product reference"*

## Real-world example

Documented during an early production run. A skincare tenant's body-oil SKU had a `_hero` file that was the printed label design (saffron-yellow rectangle with M monogram, wordmark, line-drawing of a seated woman, "BODY OIL / Honey & Vanilla / 100ml"). No bottle was visible. Five generations referencing that file produced five different bottles — tall amber glass, short clear cylinder, dropper-style tincture, frosted square — all wrong. The fix was to upload a `_c_roll` file showing the actual bottle photographically and prepend the prompt with an explicit silhouette description.

The lesson generalised: **never trust filename to determine reference content**.
