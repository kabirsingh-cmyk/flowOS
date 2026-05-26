#!/usr/bin/env node
// Structural health check for FlowOS (no-build Babel standalone SPA).
// Silent + exit 0 when all clear. Prints plain English + exit 1 on failure.
// Runs automatically via Claude Code Stop hook after every session.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const issues   = [];
const warnings = [];
const fail  = (msg) => issues.push(msg);
const warn  = (msg) => warnings.push(msg);

// ─── Check 1: All scripts listed in index.html exist on disk ─────────────────
const html = read('index.html');
const scriptSrcs = [...html.matchAll(/type="text\/babel"\s+src="([^"]+)"/g)].map(m => m[1]);

for (const src of scriptSrcs) {
  if (!existsSync(resolve(ROOT, src))) {
    fail(`MISSING FILE: "${src}" is in index.html but the file doesn't exist`);
  }
}

// ─── Check 2: Load order matches the documented order in CLAUDE.md ───────────
const EXPECTED_ORDER = [
  'app/supabase.jsx', 'app/seed.jsx', 'app/ui.jsx', 'app/ui2.jsx', 'app/store.jsx',
  'app/workspaces1.jsx', 'app/workspaces2.jsx', 'app/workspaces3.jsx', 'app/workspaces4.jsx',
  'app/chat-data.jsx', 'app/chat-ui.jsx', 'app/channel-strategy.jsx',
  'app/features.jsx', 'app/studio.jsx', 'app/login.jsx', 'app/onboarding.jsx',
  'app/agents.jsx', 'app/insights.jsx', 'app/ai.jsx', 'app/chat-app.jsx',
];

for (let i = 0; i < EXPECTED_ORDER.length; i++) {
  if (scriptSrcs[i] !== EXPECTED_ORDER[i]) {
    fail(
      `LOAD ORDER BROKEN at position ${i + 1}: ` +
      `expected "${EXPECTED_ORDER[i]}", found "${scriptSrcs[i] || '(nothing)'}". ` +
      `This can cause "X is not defined" errors at startup.`
    );
    break;
  }
}

// ─── Check 3: No bare import statements in frontend files ─────────────────────
// import statements break Babel standalone — the app loads a blank page with no error.
for (const src of scriptSrcs) {
  if (!existsSync(resolve(ROOT, src))) continue;
  const lines = read(src).split('\n');
  const bad = lines
    .map((l, i) => ({ n: i + 1, l }))
    .filter(({ l }) => /^\s*import\s/.test(l));
  if (bad.length > 0) {
    fail(
      `IMPORT STATEMENT in ${src} (breaks Babel standalone — app will show blank page):\n` +
      bad.slice(0, 3).map(({ n, l }) => `    line ${n}: ${l.trim()}`).join('\n')
    );
  }
}

// ─── Check 4: Critical globals present in their expected files ────────────────
// If these disappear, large parts of the app stop working silently.
const CRITICAL_EXPORTS = {
  'app/store.jsx':       ['useMvedaStore'],
  'app/ai.jsx':         ['sendAIMessage'],
  'app/login.jsx':      ['LoginScreen'],
  'app/chat-ui.jsx':    ['Composer', 'ArtifactCard', 'Message'],
  'app/workspaces1.jsx':['CommandCenter', 'BrandMemory'],
  'app/workspaces2.jsx':['CampaignPlanner'],
  'app/workspaces3.jsx':['PublishingQueue', 'InboxEscalation'],
  'app/workspaces4.jsx':['Connections'],
  'app/onboarding.jsx': ['OnboardingWizard', 'applyPalette'],
  'app/agents.jsx':     ['AgentsWorkspace'],
  'app/insights.jsx':   ['InsightsCenter'],
  'app/features.jsx':   ['OrganicSocialStudio', 'SmsCenter', 'SeoStudio'],
  'app/studio.jsx':     ['StudioHub', 'EmailStudio', 'SettingsHub'],
};

for (const [file, globals] of Object.entries(CRITICAL_EXPORTS)) {
  if (!existsSync(resolve(ROOT, file))) continue;
  const content = read(file);
  for (const g of globals) {
    if (!content.includes(g)) {
      fail(`MISSING EXPORT: "${g}" was removed from ${file} — components depending on it will crash`);
    }
  }
}

// ─── Check 5: IIFE wrapper present in workspace files ─────────────────────────
// workspaces1-4 use IIFE; other files do not (verified against actual source).
const IIFE_REQUIRED = [
  'app/workspaces1.jsx', 'app/workspaces2.jsx',
  'app/workspaces3.jsx', 'app/workspaces4.jsx',
];

for (const f of IIFE_REQUIRED) {
  if (!existsSync(resolve(ROOT, f))) continue;
  const content = read(f);
  if (!content.includes('(function') && !content.includes('(()')) {
    fail(`IIFE MISSING in ${f} — variables from this file will collide with other files`);
  }
}

// ─── Check 6: All API route files have Vercel edge runtime config ─────────────
const apiDir = resolve(ROOT, 'api');
const apiFiles = readdirSync(apiDir).filter(f => f.endsWith('.js'));

for (const f of apiFiles) {
  const content = read(`api/${f}`);
  if (!content.includes('runtime') || (!content.includes('"edge"') && !content.includes("'edge'") && !content.includes('"nodejs"') && !content.includes("'nodejs'"))) {
    fail(`MISSING RUNTIME CONFIG in api/${f} — Vercel won't know how to run this endpoint`);
  }
}

// ─── Check 7: Vercel cron schedules compatible with plan ─────────────────────
// Hobby plan minimum interval: 1 hour. Sub-hourly crons (minute field = "*"
// or "*/N" where N < 60) are silently rejected at deploy on Hobby — the job
// never fires without any error message.
// Pro plan supports per-minute schedules.
//
// This check WARNS (does not fail) so a Pro-plan project isn't blocked.
// A WARN prefix distinguishes it from a hard structural failure.
const vercelJsonPath = resolve(ROOT, 'vercel.json');
if (existsSync(vercelJsonPath)) {
  let vj;
  try { vj = JSON.parse(read('vercel.json')); } catch { /* malformed — skip */ }
  if (vj?.crons) {
    for (const { path: cronPath, schedule } of vj.crons) {
      if (!schedule) continue;
      const minuteField = schedule.trim().split(/\s+/)[0];
      // Sub-hourly: minute field is "*" (every minute) or "*/N" with N < 60
      const isSubHourly =
        minuteField === '*' ||
        (/^\*\/(\d+)$/.test(minuteField) && parseInt(minuteField.slice(2), 10) < 60);
      if (isSubHourly) {
        warn(
          `cron "${cronPath}" schedule "${schedule}" is sub-hourly — requires Vercel Pro. ` +
          `On Hobby it will never fire (silently rejected at deploy). ` +
          `Use "0 * * * *" for Hobby, or confirm you're on Pro.`
        );
      }
    }
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────
if (warnings.length > 0) {
  process.stderr.write(
    `\n⚠️  FlowOS health check: ${warnings.length} warning${warnings.length === 1 ? '' : 's'}\n\n` +
    warnings.map((msg, i) => `  ${i + 1}. ${msg}`).join('\n\n') +
    '\n'
  );
}

if (issues.length === 0) {
  process.exit(0); // silent pass (warnings printed above but don't block)
}

const plural = issues.length === 1 ? 'issue' : 'issues';
process.stderr.write(
  `\n🔴 FlowOS health check: ${issues.length} ${plural} found\n\n` +
  issues.map((msg, i) => `  ${i + 1}. ${msg}`).join('\n\n') +
  '\n\nRun "node scripts/health-check.mjs" to see this again.\n\n'
);
process.exit(1);
