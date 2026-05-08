# SPEC-04 — Story Bank Service

**Status:** unimplemented
**Files to create:** Supabase migration, `app/stories.jsx`, `api/lib/storySelect.js`
**Depends on:** Brand Memory schema (PATCH-03)
**Consumed by:** SPEC-06 (Stitch service for reels)

## Purpose

Reels are not motion-on-products. **Reels are mini-films with a story arc.** Without a story bank, every reel collapses into the same camera move on a different product. Production showed that the brand discipline that prevents this is **a curated portfolio of named stories with reference-film inspiration**, rotated with cooldown rules.

This service stores per-tenant story portfolios, exposes a selection algorithm, and tracks usage for cooldown.

## The story object — universal schema

Tenant-agnostic. The shape is the same for any brand; only the content differs. (For example: a B2B refrigeration brand's stories would be entirely different from a luxury skincare brand's, but the schema is identical.)

```ts
interface Story {
  id: string;                    // 'story_01_composition_pushin'
  title: string;                 // 'The Composition Push-In'
  description: string;           // one-paragraph editorial brief
  format: '1-beat' | '2-beat' | '3-beat';
  beats: Beat[];                 // 1 / 2 / 3 entries depending on format
  referenceFilm: {
    name: string;                // 'Chanel N°5 — See You at 5'
    director?: string;           // 'Luca Guadagnino'
    why: string;                 // why this is the inspiration
  };
  bestSkuTypes: string[];        // ['bath_soap', 'body_oil'] — categorical, brand-agnostic
  registerFit: ('royal'|'regular'|'lofi')[];
  mood: string[];                // ['anticipation', 'restraint', 'sovereign']
  status: 'active' | 'paused' | 'retired';
  retiredAt?: string;
  retiredReason?: string;
}

interface Beat {
  durationSeconds: number;       // 4 | 6 | 12 — must sum to (15 - endcardDuration)
  scenePrompt: string;           // the scene description fed into asset prompt assembly
  cameraMotion: string;          // 'slow continuous push-in' | 'static wide shot' | ...
  hasFadeOut: boolean;           // last beat = true
}
```

## Data model — Supabase

```sql
create table story_bank (
  id              text primary key,        -- tenant-prefixed: '<tenant>:story_01_...'
  tenant_id       text not null,
  story           jsonb not null,           -- the Story object above
  status          text not null default 'active',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index on story_bank (tenant_id, status);

create table story_usage (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  story_id    text not null references story_bank(id),
  used_at     timestamptz not null default now(),
  sku_id      text not null,
  register    text not null,
  reel_job_id uuid references generation_jobs(id)
);
create index on story_usage (tenant_id, story_id, used_at desc);
```

## Selection algorithm

`api/lib/storySelect.js` exports:

```js
export async function selectStory({ tenantId, skuType, register, cooldownDays = 28 }) { ... }
```

Selection rules (apply in order, first matching wins):

1. Stories where `status === 'active'` AND
2. `skuType in story.bestSkuTypes` AND
3. `register in story.registerFit` AND
4. NOT used in `story_usage` within the last `cooldownDays`
5. Among matches, pick the one with **oldest `last_used`** (or never-used) — rotate broadly
6. If no match under (4), relax: drop cooldown, pick oldest-used among matching skuType+register
7. If still no match, fallback to the brand's `defaultStoryId` (set in brand record)

After successful reel generation, write a row to `story_usage`.

## UI — `app/stories.jsx`

A Studio page where the tenant operator can:
- View their story bank (cards: title · format · reference film · last used · status)
- Edit a story (modal with all schema fields)
- Add a new story (form scaffold — empty Story object)
- Retire / reactivate stories
- View usage analytics (which stories are used most, performance correlation if reel metrics are wired)

Style: matches existing `app/studio.jsx` conventions (`SHead`, `StatusBadge`, etc.).

## Onboarding flow integration

When a tenant onboards, the onboarding flow should ask:
- "Reference films your brand admires" → free-text field that LLM-suggests 3-5 candidate stories, operator approves
- Approved stories seed `story_bank` for the new tenant

For tenants without explicit input, seed with **5 universal scaffolds** (Composition push-in, The Hand Ritual, Texture macro, Light reveal, Lookbook film) — these work for nearly any brand and serve as starting points. Tenant edits/adds/replaces over time.

## Cooldown semantics

- Default 28 days. A story used Mon May 1 is eligible again Mon May 29.
- Configurable per-tenant via `brand.storyBankConfig.cooldownDays`
- Operators can bypass cooldown manually (UI: "Force this story" — logged with reason)

## Edge cases

1. **No matching story for an SKU+register combo** — fallback chain above. If even the default doesn't fit (rare), surface to operator with manual story-pick prompt.
2. **Story edited mid-week** — generation jobs already created continue with the snapshot; new selections use the edit.
3. **Story retired** — never appears in selection. Past `story_usage` rows preserved.
4. **Tenant has < 5 active stories** — selection works but variety is limited; surface a UI nudge to add more.

## Test strategy

`tests/integration/story-bank.test.js`:
- Seed `story_bank` with a fixture portfolio of ≥10 stories spanning all 3 formats (1/2/3-beat) and all `bestSkuTypes` × `registerFit` combinations the platform supports
- Run 4 weeks of selection (5 SKUs/week × 4 weeks = 20 selections, ~12 reels)
- Assert no story used twice within cooldown window
- Assert all selections satisfy `bestSkuTypes` + `registerFit` matches
- Verify cooldown bypass logs reason
