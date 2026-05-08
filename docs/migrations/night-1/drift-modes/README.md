# Drift Modes — Generalised Lessons

These are **tenant-agnostic failure-mode case studies** observed when running an asset generation pipeline against real product imagery. Each one documents a class of failure — root cause, prevention pattern, regression-test strategy — that the platform's services (SPEC-01 through SPEC-07) must defend against.

Treat these as universal: any luxury / DTC / commerce tenant generating product imagery via image-to-image with a packshot reference will hit one or more of these. They are not theoretical — each is an observed failure from production.

## Index

| # | Drift mode | One-line summary |
|---|---|---|
| **DM-01** | [Flat graphic vs 3D product reference](DM-01-flat-graphic-vs-3d-product.md) | Filename names a "packshot" but file content is a 2D label artwork; model invents the 3D form |
| **DM-02** | [SKU-name colour bias](DM-02-sku-name-colour-bias.md) | SKU contains a colour word ("Green Tea & Oud") that semantically biases the model away from the actual product palette |
| **DM-03** | [Functional-cue overrides reference](DM-03-functional-cue-overrides-reference.md) | Copy descriptors ("sensitive skin", "gentle") biases the model toward pastel/soft palettes even when the reference shows bold colours |

## Where these are referenced

- **SPEC-02** (Asset Prompt Library) — the "PRESERVE EXACTLY" anchor block was designed to prevent DM-01 and DM-02
- **SPEC-05** (Source Index / Asset Library) — the 3D-vs-flat-artwork classifier is the pre-flight defence against DM-01
- **SPEC-01** (Generation Engine) — quality gates that detect dominant-colour mismatch (vision query against expected `productColors`) are the post-flight defence against DM-02 and DM-03

## How to add a new drift mode

When the platform observes a new failure pattern in production, add an `DM-NN-<short-name>.md` here following the existing template (Symptom · Root cause · Detection · Prevention · Test). Update this index. Cross-reference from any spec that prevents or detects it.
