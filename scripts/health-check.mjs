#!/usr/bin/env node
// Structural health check for FlowOS (Vite SPA — legacy global-scope pattern).
// Silent + exit 0 when all clear. Prints plain English + exit 1 on failure.
// Runs automatically via Claude Code Stop hook after every session.
//
// Vite migration note: the dependency graph used to live in index.html as a
// sequence of <script src="app/...">. It now lives in app/main.jsx as a
// sequence of `import './X.jsx'` statements. index.html only loads main.jsx.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const issues   = [];
const warnings = [];
const fail  = (msg) => issues.push(msg);
const warn  = (msg) => warnings.push(msg);

// ─── Check 1: index.html loads /app/main.jsx ─────────────────────────────────
const html = read('index.html');
if (!/<script\s+type="module"\s+src="\/app\/main\.jsx"/.test(html)) {
  fail(
    `index.html does not load /app/main.jsx as a module. ` +
    `Expected: <script type="module" src="/app/main.jsx"></script>`
  );
}

// ─── Check 2: every file imported from main.jsx exists on disk ───────────────
const mainSrc = read('app/main.jsx');
// `import './X.jsx'` and `import { … } from './X.jsx'`. Captures relative paths
// only — bare specifiers like `react` are intentionally skipped.
const importPaths = [...mainSrc.matchAll(/import\s+(?:{[^}]+}\s+from\s+)?['"](\.\/[^'"]+)['"]/g)]
  .map(m => m[1].replace(/^\.\//, 'app/'));

for (const p of importPaths) {
  if (!existsSync(resolve(ROOT, p))) {
    fail(`MISSING FILE: "${p}" is imported in app/main.jsx but the file doesn't exist`);
  }
}

// ─── Check 3: dependency-order sanity in main.jsx ────────────────────────────
// Hard ordering invariants — these come up in real bugs:
//   - setup-globals must come first (defines globalThis.React)
//   - supabase + seed + ui + ui2 + store must come before any workspaces*.jsx
//     (they all destructure React.useState etc. and read window globals)
//   - chat-app.jsx must come last (it mounts ReactDOM and consumes everything)
const idx = (file) => importPaths.indexOf(file);
const before = (a, b, why) => {
  const ia = idx(a), ib = idx(b);
  if (ia < 0 || ib < 0) return;
  if (ia >= ib) fail(`LOAD ORDER: ${a} must come before ${b}. ${why}`);
};
if (importPaths.length > 0 && importPaths[0] !== 'app/setup-globals.jsx') {
  fail(
    `LOAD ORDER: app/setup-globals.jsx must be the FIRST import in main.jsx ` +
    `(it defines globalThis.React before legacy files destructure hooks).`
  );
}
const FOUNDATIONS = ['app/supabase.jsx', 'app/seed.jsx', 'app/ui.jsx', 'app/ui2.jsx', 'app/store.jsx'];
const WORKSPACES  = ['app/workspaces1.jsx', 'app/workspaces2.jsx', 'app/workspaces3.jsx', 'app/workspaces4.jsx'];
for (const f of FOUNDATIONS) {
  for (const w of WORKSPACES) {
    before(f, w, `${w} reads window globals defined in ${f}.`);
  }
}
if (idx('app/chat-app.jsx') !== -1 && idx('app/chat-app.jsx') !== importPaths.length - 1) {
  // chat-app.jsx may be imported via a named export rather than as a side-effect
  // — that's still the last import line, so this only fails if something else
  // comes after it.
  const after = importPaths.slice(idx('app/chat-app.jsx') + 1);
  if (after.length > 0) {
    fail(
      `LOAD ORDER: app/chat-app.jsx must be the LAST import in main.jsx. ` +
      `Found after it: ${after.join(', ')}.`
    );
  }
}

// ─── Check 4: IIFE-wrapped legacy files have no bare import statements ───────
// IIFE-wrapped files (workspaces1-4, features, studio, etc.) define everything
// inside (function () { … })(); a top-level `import` would force Vite to treat
// the file as an ES module, which moves the IIFE's window-assignments into
// module-scope and breaks every legacy consumer that reads them as globals.
// Non-IIFE files (supabase.jsx, seed.jsx, ai.jsx, …) write to window directly
// at top level and CAN legitimately use ES imports under Vite.
for (const p of importPaths) {
  if (!existsSync(resolve(ROOT, p))) continue;
  const content = read(p);
  const isIife = /\(function\s*\(\s*\)\s*\{/.test(content) || /\(\(\s*\)\s*=>\s*\{/.test(content);
  if (!isIife) continue;
  const lines = content.split('\n');
  const bad = lines
    .map((l, i) => ({ n: i + 1, l }))
    .filter(({ l }) => /^\s*import\s/.test(l));
  if (bad.length > 0) {
    fail(
      `IMPORT STATEMENT in ${p} (IIFE-wrapped file — would become an ES module and break window-global wiring):\n` +
      bad.slice(0, 3).map(({ n, l }) => `    line ${n}: ${l.trim()}`).join('\n')
    );
  }
}

// scriptSrcs alias kept for the remaining checks that iterate frontend files.
const scriptSrcs = importPaths;

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
  'app/ads-workspace.jsx': ['AdsWorkspace'],
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
