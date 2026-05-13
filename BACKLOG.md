# Flow — Feature Backlog

Items here are scoped, parked for future development, and not yet prioritised into a sprint.

---

## Programmatic Creative (Variant Testing)

**Status:** Parked — revisit when chat-to-create + edit-in-Flow are shipped  
**Priority:** Medium  
**Inspired by:** InstaAgent (YC S26) — $1M ARR in 10 months on this concept alone

### What it is
Generate N variants of a single ad or post (targeting different hooks, headlines, visuals, or audience angles), publish them, collect performance data, extrapolate the winner, and auto-scale or kill the rest — without waiting for statistically significant sample sizes.

### Flow's version (lighter)
- **N = 5–10 variants** (not 50 — extrapolate from smaller sample, lower spend risk)
- User writes or approves a base brief → Flow generates variants automatically
- Variants differ on: headline, hook, visual style, CTA, tone angle
- Published as a Meta / TikTok ad set (via existing ads connectors)
- After 48–72h: Flow reads performance data back (CTR, CPC, ROAS via connector)
- Decision engine: auto-pause underperformers below threshold, flag winner for budget scaling
- User approves the scale decision or overrides in the Publishing Queue

### Why build it
- Paid social creative testing is manual and slow today — this automates the loop
- Flow already has the pieces: brand voice layer, Runware for image variants, Claude for copy variants, ads connectors for distribution and data read-back
- Defensible because it's tied to Flow's brand memory — variants stay on-voice, not generic

### Open questions
- Extrapolation model: simple threshold (winner has >2× CTR of median) or Bayesian?
- Minimum viable spend per variant to get signal (likely $10–25/variant)
- How many platforms at launch — Meta only first, or Meta + TikTok simultaneously?
- Where does the user set budget caps — per variant or total pool?

---
