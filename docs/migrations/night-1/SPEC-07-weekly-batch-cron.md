# SPEC-07 — Weekly Batch Cron

**Status:** unimplemented
**Files to create:** edit `vercel.json`, new `api/cron-weekly-batch.js`, new `api/lib/calendar.js`
**Depends on:** SPEC-01, SPEC-04, SPEC-05, SPEC-06 — orchestrates all four
**Consumed by:** Studios (UI surfaces a "next batch run" indicator)

## Purpose

Each tenant has a publishing cadence (e.g. Wed–Sun, 5 days/week). Generating those 5 days' content needs to happen **once per week, in one supervised batch**, so the operator can review the full week before any of it goes live.

Daily-cron-per-day was tried and failed: a daily 8 PM cron firing for the next morning's 9 AM post forces the operator to review at midnight every night, and any failure in the night silently misses the next morning. **Weekly batch + morning publish workflow** is the pattern that actually works.

## Cron config

`vercel.json`:

```json
{
  "outputDirectory": ".",
  "crons": [
    {
      "path": "/api/cron-weekly-batch",
      "schedule": "0 20 * * 2"
    }
  ]
}
```

Vercel cron is UTC. To honor tenant-local 8 PM Tuesday across timezones, the cron-weekly-batch handler **iterates active tenants** and skips any whose local time isn't Tuesday-evening. Per-tenant config in `brands.batch_cron_local`:

```sql
alter table brands add column batch_cron_local text default '0 20 * * 2';
alter table brands add column batch_timezone text default 'America/Los_Angeles';
alter table brands add column batch_enabled boolean default true;
```

The single Vercel cron fires every hour (`0 * * * *`); the handler decides which tenants to run based on their local cron expression evaluated in their tz.

This is a recommended pattern: one cron, many tenants, each with their own local schedule.

## The handler — `api/cron-weekly-batch.js`

```js
export const config = { runtime: 'edge' };

export default async function handler(req) {
  // 1. Authorize: must be Vercel cron OR signed manual trigger
  if (!isCronInvocation(req)) return new Response('Forbidden', { status: 403 });

  // 2. List tenants whose local cron matches now
  const tenants = await tenantsDueNow();

  // 3. For each tenant, run its weekly batch sequentially
  for (const tenant of tenants) {
    await runWeeklyBatch(tenant);
  }

  return new Response(JSON.stringify({ ok: true, tenantsProcessed: tenants.length }));
}
```

## Per-tenant batch — `runWeeklyBatch(tenant)`

```js
async function runWeeklyBatch(tenant) {
  const calendar = await loadCalendar(tenant.id, { startDate: nextDay(today), days: 5 });
  if (!calendar.length) {
    notify(tenant, 'No calendar entries for next 5 days. Skipping batch.');
    return;
  }

  // Pre-flight checks
  if (await creditBalance(tenant) < 2500) {
    notify(tenant, `Generation credits low (${balance}). Top up before next run.`);
    return;
  }
  if (!await endCardExists(tenant)) {
    notify(tenant, 'End card missing. Building before batch...');
    await buildTenantEndCard(tenant);
  }

  // Process days sequentially (parallel jobs within day, sequential across days)
  const summary = { stillsGenerated: 0, stillsFromLibrary: 0, reelsStitched: 0, failures: [] };

  for (const day of calendar) {
    try {
      const dayResult = await processDayForTenant(tenant, day);
      summary.stillsGenerated += dayResult.stillsGenerated;
      summary.stillsFromLibrary += dayResult.stillsFromLibrary;
      if (dayResult.reelStitched) summary.reelsStitched++;
    } catch (err) {
      summary.failures.push({ date: day.date, sku: day.skuId, err: err.message });
    }
  }

  // Persist + notify
  await writeWeeklyBatchSummary(tenant, summary);
  await sendPushNotification(tenant, formatSummary(summary));
}
```

## Day processing — `processDayForTenant(tenant, day)`

```js
async function processDayForTenant(tenant, day) {
  // 1. For each lane required by day's calendar entry, ask Source Index (SPEC-05) for an asset
  const lanes = ['feed_hero', 'story', 'carousel_1', 'carousel_2_ingredient', 'carousel_3_texture', 'pin_2x3'];
  const slots = {};
  for (const lane of lanes) {
    const resolved = await resolveForLane({ tenant, sku: day.skuId, lane, register: day.register });
    slots[lane] = resolved.fallback === 'generate'
      ? { generate: true, intent: { kind: lane, ... } }
      : { useLibrary: true, assetId: resolved.asset.id };
  }

  // 2. Generate everything that needs generating (in parallel)
  const generationJobs = await Promise.all(
    Object.entries(slots)
      .filter(([_, slot]) => slot.generate)
      .map(([lane, slot]) => generate({ tenant, intent: slot.intent }))
  );

  // 3. If reel day, pick a story (SPEC-04) and generate beat frames + animations
  let reelStitched = false;
  if (day.reelDay) {
    const story = await selectStory({ tenantId: tenant.id, skuType: day.skuType, register: day.register });
    const beatFrames = await Promise.all(story.beats.map((beat, i) =>
      generateImage({ tenant, intent: { kind: 'reel_beat_frame', story: story.id, beat: i }, beat })
    ));
    const beatVideos = await Promise.all(beatFrames.map((frame, i) =>
      generateVideo({ tenant, startImageJobId: frame.id, duration: story.beats[i].durationSeconds, story: story.id, beat: i })
    ));
    await stitchReel({ tenant, beatJobIds: beatVideos.map(v => v.id), format: story.format });
    await logStoryUsage(tenant, story.id, day.skuId);
    reelStitched = true;
  }

  // 4. Wait for all generations to complete (poll loop with timeout)
  await waitForJobs([...generationJobs.map(j => j.id)]);

  // 5. Quality gates (re-using SPEC-02's caption + visual checks)
  const failedGates = await runQualityGates({ tenant, day, slots });
  // failed gates auto-retry once with stronger prompt language; if still failing, log and proceed

  // 6. Captions + Publer CSVs (PATCH-08 utility)
  await generateAndStoreCaptions({ tenant, day, slots });
  await writePublerCsvs({ tenant, day, slots });

  return { stillsGenerated: ..., stillsFromLibrary: ..., reelStitched };
}
```

## Calendar schema

`api/lib/calendar.js` reads the `calendars` table:

```sql
create table calendars (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  date        date not null,
  sku_id      text not null,
  register    text not null,                -- 'royal' | 'regular' | 'lofi'
  lane        text not null,                -- editorial lane: 'cinematic' | 'lifestyle' | 'women_cam' | 'intimate'
  reel_day    boolean default false,
  campaign_overlay text,                    -- optional: 'launch' | 'restock' | 'festival' | null
  notes       text,
  created_at  timestamptz default now(),
  unique (tenant_id, date)
);
```

Calendar is editable by operators in the UI (Studio → Calendar). The cron reads it as-is at fire time.

## Push notification format

```
{tenantName} — Week ready ({startDate}–{endDate}).
{N} stills generated, {M} from library, {K} reels.
{F} quality flags. Open Drive to review.
```

## Failure handling

- **Single SKU fails (3 retries exhausted)** — log to `summary.failures`, continue to next day. Operator notified at end with "1 of 5 days FAILED — re-run manually."
- **Provider outage mid-batch** — exponential backoff up to 5 min; if still down, abort batch and notify "Provider down — re-run manually after recovery."
- **End card missing** — generate on-the-fly using SPEC-06 fallback path, log warning.
- **Calendar empty** — exit cleanly, notify "No content scheduled."
- **Credits low** — pre-flight fails, notify before any work done.

## Manual trigger

Operators can trigger a batch from the UI ("Run weekly batch now"). Hits the same handler with a tenant ID + signed token. Bypasses cron schedule.

## Edge cases

1. **Tenant has no story bank entries** — fall back to a single 1-beat composition push-in story; surface UI nudge.
2. **Reel beats generate but stitch fails** — beats are saved; reel marked failed; operator can retry stitch from UI without regenerating beats.
3. **Calendar entry references a retired SKU** — log warning; skip; surface to operator.
4. **Two batches kicked off concurrently** — DB advisory lock per tenant prevents double-run.
5. **Operator edits calendar mid-batch** — batch uses snapshot at fire time; subsequent edits affect next week.

## Test strategy

`tests/integration/weekly-batch.test.js`:
- Mock all upstream services (SPEC-01/04/05/06) to return canned fixtures
- Seed a fixture tenant's calendar with 5 days (a mix of reel-day and non-reel-day entries)
- Run `runWeeklyBatch(<fixture-tenant>)` and assert:
  - 5 days processed
  - The expected number of reels stitched (one per `reel_day=true` entry)
  - Story Bank cooldown table has 3 new entries
  - Push notification message matches expected format
  - Credits decremented appropriately
- Failure injection: middle day's generation fails 3x, batch should continue and final notification flags it
