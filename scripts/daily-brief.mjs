#!/usr/bin/env node
// Daily build brief for FlowOS.
// Reads BACKLOG.md, SPRINT.md, WORKLOG.md → asks Claude → writes DAILY_BRIEF.md.
// Skips regeneration if the brief is already < 12 hours old.
// Run via SessionStart hook — fires each time you open Claude Code in this project.

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRIEF_PATH = resolve(ROOT, 'DAILY_BRIEF.md');
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

// ─── Skip if brief is already fresh ──────────────────────────────────────────
if (existsSync(BRIEF_PATH)) {
  const age = Date.now() - statSync(BRIEF_PATH).mtimeMs;
  if (age < TWELVE_HOURS) {
    process.exit(0); // already up to date — silent
  }
}

// ─── Read project state ───────────────────────────────────────────────────────
const read = (rel) => {
  const p = resolve(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '(not found)';
};

const backlog  = read('BACKLOG.md');
const sprint   = read('SPRINT.md');
const worklog  = read('WORKLOG.md').slice(0, 4000); // recent entries only

// ─── Run health check inline ──────────────────────────────────────────────────
import { spawnSync } from 'child_process';
const hc = spawnSync('node', [resolve(ROOT, 'scripts/health-check.mjs')], { encoding: 'utf8' });
const healthStatus = hc.status === 0
  ? '✅ All structural checks pass'
  : `🔴 Issues found:\n${hc.stderr}`;

// ─── Call Claude API ──────────────────────────────────────────────────────────
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  // Write a minimal brief without AI recommendations
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(BRIEF_PATH, `# FlowOS Daily Brief — ${date}

> ⚠️  ANTHROPIC_API_KEY not set — AI recommendations unavailable. Set it and re-run \`node scripts/daily-brief.mjs\`.

## Health
${healthStatus}

## In Progress
See SPRINT.md for current status.
`);
  process.exit(0);
}

const prompt = `You are a product advisor for FlowOS, an AI marketing OS.
Your job: read the current project state and produce a concise daily brief with prioritised recommendations.

Today's date: ${new Date().toISOString().slice(0, 10)}

--- HEALTH CHECK ---
${healthStatus}

--- SPRINT (current state) ---
${sprint}

--- BACKLOG (all items) ---
${backlog}

--- RECENT WORK LOG (last entries) ---
${worklog}

Write a DAILY_BRIEF.md in this exact format (keep it short — Kabir is not an engineer):

# FlowOS Daily Brief — [DATE]

## Health
[One line: all clear or list issues]

## In Progress
[Bullet list of what's actively being worked on, plain English, no IDs]

## 🎯 Build Next (top 3)
[Numbered list. For each: what it is in plain English, why it matters NOW, roughly how big the job is (small/medium/large). Prioritise: 1) open bugs that break real functionality, 2) things that unblock multiple other items, 3) highest user-visible impact. Be opinionated — don't list "it depends".]

## Watch Out For
[1-3 risks or decisions that need attention before starting new work. E.g. strategic pivots, dependencies, known unknowns.]

---
_Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC_`;

let brief;
try {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  brief = data.content?.[0]?.text;
  if (!brief) throw new Error('Empty response from API');

} catch (err) {
  // Fallback: write a static brief so the session still gets context
  const date = new Date().toISOString().slice(0, 10);
  brief = `# FlowOS Daily Brief — ${date}

> ⚠️  Could not reach Claude API: ${err.message}

## Health
${healthStatus}

## In Progress
See SPRINT.md — run this script again once the API is reachable.
`;
}

writeFileSync(BRIEF_PATH, brief);
process.stdout.write(`✅ Daily brief updated → DAILY_BRIEF.md\n`);
