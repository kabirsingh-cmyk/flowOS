#!/usr/bin/env node
// Backlog + daily-plan engine for FlowOS.
//
// Commands:
//   node scripts/backlog-engine.mjs bootstrap   one-time migration to schema
//   node scripts/backlog-engine.mjs catch-up    scan since last run, propose updates
//   node scripts/backlog-engine.mjs plan        emit today's Kanban
//   node scripts/backlog-engine.mjs daily       catch-up then plan
//
// Flags: --apply  --since=<ISO>  --verbose
//
// See ~/Desktop/flowOS/scripts/backlog-engine.mjs spec at the top of the file
// and CLAUDE.md for project context.

import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");        // ~/Desktop/flowOS
const SCRIPTS    = path.join(ROOT, "scripts");
const PLANS_DIR  = path.join(SCRIPTS, "plans");
const STATE_FILE = path.join(SCRIPTS, ".backlog-state.json");
const BACKLOG    = path.join(ROOT, "BACKLOG.md");
const WORKLOG    = path.join(ROOT, "WORKLOG.md");
const CLAUDEMD   = path.join(ROOT, "CLAUDE.md");
const PROPOSED   = path.join(ROOT, "BACKLOG.proposed.md");

// Transcript locations to scan. The spec names the Desktop-flowOS path,
// but in practice Kabir's primary cwd is ~ so transcripts land in the
// home-folder project dir. We try both and filter by cwd + flowOS mentions.
const TRANSCRIPT_DIRS = [
  path.join(os.homedir(), ".claude/projects/-Users-deadstar811-Desktop-flowOS"),
  path.join(os.homedir(), ".claude/projects/-Users-deadstar811"),
];

const ARGS = process.argv.slice(2);
const CMD  = ARGS[0];
const FLAGS = {
  apply:   ARGS.includes("--apply"),
  verbose: ARGS.includes("--verbose"),
  since:   (ARGS.find(a => a.startsWith("--since=")) || "").split("=")[1] || null,
};

const MODEL          = process.env.BACKLOG_MODEL || "claude-opus-4-7";
const EXTRACTION_MODEL = process.env.BACKLOG_EXTRACTION_MODEL || "claude-haiku-4-5-20251001";
const API_KEY        = process.env.ANTHROPIC_API_KEY;

// ─── ANSI ────────────────────────────────────────────────────────────────────
const ANSI = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red:   "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue:  "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m",
};
const c = (col, s) => `${ANSI[col]}${s}${ANSI.reset}`;

// ─── small utils ─────────────────────────────────────────────────────────────
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function readMaybe(p, fallback = "") {
  try { return await fs.readFile(p, "utf8"); } catch { return fallback; }
}
async function readState() {
  if (!(await exists(STATE_FILE))) {
    return { lastRun: null, lastCatchUp: null, lastTranscriptScanned: null, version: 1 };
  }
  return JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
}
async function writeState(s) {
  await fs.writeFile(STATE_FILE, JSON.stringify(s, null, 2));
}
function nowIso() { return new Date().toISOString(); }
function todayDate() { return nowIso().slice(0, 10); }
function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 60);
}
function genId(title, salt = "") {
  const h = crypto.createHash("sha256").update(salt + "|" + slugify(title) + "|" + Date.now() + Math.random()).digest("hex");
  return "b_" + h.slice(0, 4);
}
function ensureUniqueId(id, existing) {
  let cand = id, n = 0;
  while (existing.has(cand)) { n++; cand = "b_" + crypto.randomBytes(2).toString("hex"); }
  return cand;
}

// ─── Anthropic client ────────────────────────────────────────────────────────
async function callClaude({ system, messages, model = MODEL, maxTokens = 4096 }) {
  if (!API_KEY) {
    console.error(c("red", "ANTHROPIC_API_KEY not set in env."));
    console.error("Add it to your shell: export ANTHROPIC_API_KEY=sk-ant-…");
    process.exit(2);
  }
  // Lazy-load the SDK so the script can still run --help / --version without it.
  let Anthropic;
  try {
    Anthropic = (await import("@anthropic-ai/sdk")).default;
  } catch (e) {
    console.error(c("red", "@anthropic-ai/sdk not installed."));
    console.error("Install with:  cd " + ROOT + " && npm i @anthropic-ai/sdk");
    process.exit(2);
  }
  const client = new Anthropic({ apiKey: API_KEY });
  // Stream for long requests — the SDK requires it once max_tokens × estimated
  // latency exceeds the 10-minute non-streaming budget.
  const stream = await client.messages.stream({
    model, max_tokens: maxTokens,
    system,
    messages,
  });
  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      text += event.delta.text;
    }
  }
  const final = await stream.finalMessage();
  return { text, usage: final.usage };
}

// Build a cached system prompt for extraction. The schema + BACKLOG.md are
// stable across the catch-up run, so we mark them with cache_control.
function buildExtractionSystem(currentBacklog) {
  return [
    { type: "text", text: EXTRACTION_SYSTEM_PROMPT },
    { type: "text", text: `# Current BACKLOG.md\n\n${currentBacklog}`, cache_control: { type: "ephemeral" } },
  ];
}

// ─── Extraction prompts ──────────────────────────────────────────────────────
const EXTRACTION_SYSTEM_PROMPT = `You read Claude Code session transcripts and produce a STRICT, conservative
list of backlog candidates for the FlowOS project.

Output JSON only — a single object matching:
{
  "items": [
    {
      "title": "short imperative phrase, <70 chars",
      "why":   "1-2 sentences. The user-facing reason. NO speculation.",
      "evidence": "literal quote (≤200 chars) from transcript that justifies surfacing this",
      "kind": "new-item" | "done" | "blocked" | "duplicate-of",
      "duplicateOf": "b_xxxx id from current backlog if kind=duplicate-of",
      "touches": ["api/foo.js", ...],
      "effort": "rough sizing if mentioned, else null",
      "confidence": 0.0-1.0
    }
  ]
}

CONSERVATIVE BIAS — only surface an item if ONE of:
  1. The user said an explicit verb of commitment ("let's do X", "do X next",
     "add X to backlog", "next we should X").
  2. The assistant proposed a concrete step AND the user assented ("ok",
     "go ahead", "yes", ranking it, picking it).
  3. A ranked list was produced and the user accepted the ranking.

NEVER surface:
  - exploratory "we could maybe" without user assent
  - aspirational ideas with no concrete first step
  - things already covered by the current backlog (dedupe by fuzzy title)

For "done" candidates: only flag if the transcript shows the work is
plausibly complete AND it matches an item in the current backlog. Lower
confidence (<0.7) is fine — the engine surfaces these as proposed-done.

If nothing meets the bar, return {"items": []}. Empty is the correct
output for most transcripts.`;

const BOOTSTRAP_SYSTEM_PROMPT = `You migrate an existing markdown backlog into a structured schema.

Input: a free-form BACKLOG.md.
Output: JSON only — an object with:
{
  "items": [
    {
      "title": "short imperative title",
      "status": "backlog" | "in-progress" | "blocked" | "done" | "dropped",
      "effort": "free text or null",
      "touches": ["file/path", ...],
      "dependsOn": [],
      "why":   "1-3 sentences explaining the user-facing reason (free text from source)",
      "notes": "any operational notes from source (free text)",
      "originalHeading": "h2 heading as it appears in source"
    }
  ]
}

Preserve free-text Why/Notes content faithfully. Do not paraphrase the user's
own words — copy them across so user-edited content survives. Group obvious
duplicates into one item. If a section header is just a status banner
("DONE — 2026-05-14"), treat it as a done item.`;

const PLAN_SYSTEM_PROMPT = `You are FlowOS's daily Kanban planner.

Input: the current structured backlog (JSON) plus recent activity context.
Output: JSON only — an object with:
{
  "today": [{"id": "b_xxxx", "whyNow": "1 sentence honest reason"}],
  "upNext":   ["b_xxxx", ...],
  "deferred": [{"id": "b_xxxx", "reason": "short"}],
  "rationale": "2-3 sentence honest narrative explaining today's pick and the
                trade-off vs the runner-up. Be direct. If signal is thin
                ('low-signal day'), say so and recommend cleanup instead."
}

PICK 1-3 items for today (NOT 3 — fewer is better). Pad NOTHING.
If only one item really deserves attention today, return one item.
If nothing deserves attention today, return today=[] and rationale must
explicitly say "low-signal day, suggest cleanup instead".

Weights (positive):
  + foundational items that unblock others (dependsOn count from OTHER items)
  + items the user has touched recently (last-touched in last 7d)
  + items with explicit deadlines in notes
  + small items that close fast

Weights (negative):
  - already in-progress (don't context-switch unless blocked)
  - deferred more than twice (flag for cleanup, don't keep nominating)

If the reasoning sounds weak when written out, pick a different item.`;

// ─── Parsing existing BACKLOG.md ─────────────────────────────────────────────
//
// Structured items look like:
//   ## b_a8f3 · Title
//   - **status**: backlog
//   - **created**: 2026-…
//   - **last-touched**: 2026-…
//   - ...
//   ### Why ...
//   ### Notes ...
//
// Pre-bootstrap, items are free-form h2s. parseBacklog accepts both shapes
// and returns the structured ones; the free-form ones are returned as
// `legacy: true` so bootstrap can convert them.
function parseBacklog(md) {
  const items = [];
  const lines = md.split("\n");
  let cur = null;
  let mode = null; // "fields" | "free"
  let freeHeading = null;

  function flush() {
    if (cur) items.push(cur);
    cur = null; mode = null; freeHeading = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const h2 = ln.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      flush();
      const heading = h2[1];
      const idMatch = heading.match(/^(b_[0-9a-f]{4})\s*[·\-:]\s*(.+)$/);
      cur = {
        id: idMatch ? idMatch[1] : null,
        title: idMatch ? idMatch[2].trim() : heading.replace(/^#+\s*/, "").trim(),
        legacy: !idMatch,
        status: "backlog",
        created: null,
        lastTouched: null,
        effort: null,
        source: "manual",
        dependsOn: [],
        touches: [],
        whyDeferred: null,
        free: {},     // free-text section -> body
        rawBody: [],
        originalHeading: heading,
      };
      mode = "fields";
      continue;
    }
    if (!cur) continue;
    const h3 = ln.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      freeHeading = h3[1].trim();
      cur.free[freeHeading] = "";
      mode = "free";
      continue;
    }
    if (mode === "fields") {
      const m = ln.match(/^\s*-\s+\*\*([^*]+)\*\*\s*:\s*(.*)$/);
      if (m) {
        const k = m[1].trim().toLowerCase();
        const v = m[2].trim();
        if (k === "status")       cur.status = v.toLowerCase();
        else if (k === "created") cur.created = v;
        else if (k === "last-touched") cur.lastTouched = v;
        else if (k === "effort")  cur.effort = v;
        else if (k === "source")  cur.source = v;
        else if (k === "depends-on") {
          cur.dependsOn = v.replace(/^\[|\]$/g, "").split(",")
            .map(s => s.trim()).filter(Boolean);
        }
        else if (k === "touches") {
          cur.touches = v.split(",").map(s => s.trim()).filter(Boolean);
        }
        else if (k === "why-deferred") cur.whyDeferred = v || null;
        continue;
      }
      // first non-field, non-h3 line: anything before free sections is body
      if (ln.trim()) cur.rawBody.push(ln);
    } else if (mode === "free" && freeHeading) {
      cur.free[freeHeading] = (cur.free[freeHeading] + "\n" + ln).trimStart();
    }
  }
  flush();
  return items;
}

function serializeItem(it) {
  const lines = [];
  lines.push(`## ${it.id} · ${it.title}`);
  lines.push("");
  lines.push(`- **status**: ${it.status}`);
  lines.push(`- **created**: ${it.created || todayDate()}`);
  lines.push(`- **last-touched**: ${it.lastTouched || it.created || todayDate()}`);
  lines.push(`- **effort**: ${it.effort || "unsized"}`);
  lines.push(`- **source**: ${it.source || "manual"}`);
  lines.push(`- **depends-on**: [${(it.dependsOn || []).join(", ")}]`);
  lines.push(`- **touches**: ${(it.touches || []).join(", ")}`);
  if (it.whyDeferred) lines.push(`- **why-deferred**: ${it.whyDeferred}`);
  lines.push("");
  for (const [heading, body] of Object.entries(it.free || {})) {
    lines.push(`### ${heading}`);
    lines.push((body || "").trim());
    lines.push("");
  }
  return lines.join("\n");
}

function serializeBacklog(items) {
  const statusOrder = ["in-progress", "blocked", "today", "up-next", "backlog", "proposed-done", "done", "dropped"];
  const sorted = [...items].sort((a, b) => {
    const ai = statusOrder.indexOf(a.status); const bi = statusOrder.indexOf(b.status);
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return (b.lastTouched || "").localeCompare(a.lastTouched || "");
  });
  // Index table.
  const idx = [
    "# FlowOS Backlog",
    "",
    "Maintained by `scripts/backlog-engine.mjs`. Free-text `### Why` / `### Notes` are user-owned — the engine never rewrites them.",
    "",
    "## Index",
    "",
    "| id | title | status | last-touched |",
    "|---|---|---|---|",
  ];
  for (const it of sorted) {
    idx.push(`| ${it.id} | ${it.title.replace(/\|/g, "\\|")} | ${it.status} | ${it.lastTouched || "—"} |`);
  }
  idx.push("");
  idx.push("---");
  idx.push("");
  return idx.join("\n") + sorted.map(serializeItem).join("\n");
}

// ─── Git ─────────────────────────────────────────────────────────────────────
function gitLogSince(sinceIso) {
  try {
    const since = sinceIso ? `--since="${sinceIso}"` : "-50";
    const out = execSync(
      `git -C "${ROOT}" log ${since} --pretty=format:"%H%x09%cI%x09%s%x09%b%x1e"`,
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    return out.split("\x1e").filter(Boolean).map(rec => {
      const [hash, date, subject, body] = rec.split("\t");
      return { hash, date, subject: (subject || "").trim(), body: (body || "").trim() };
    });
  } catch (e) {
    if (FLAGS.verbose) console.error("git log failed:", e.message);
    return [];
  }
}

function gitFilesForCommit(hash) {
  try {
    return execSync(`git -C "${ROOT}" show --pretty="" --name-only ${hash}`, { encoding: "utf8" })
      .split("\n").filter(Boolean);
  } catch { return []; }
}

// ─── Transcript scanning ─────────────────────────────────────────────────────
async function listTranscripts(sinceIso) {
  const sinceMs = sinceIso ? new Date(sinceIso).getTime() : 0;
  const out = [];
  for (const dir of TRANSCRIPT_DIRS) {
    if (!(await exists(dir))) continue;
    const ents = await fs.readdir(dir, { withFileTypes: true });
    for (const e of ents) {
      if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
      const full = path.join(dir, e.name);
      const st = await fs.stat(full);
      if (st.mtimeMs > sinceMs) out.push({ path: full, mtime: st.mtime });
    }
  }
  out.sort((a, b) => a.mtime - b.mtime);
  return out;
}

// Reduce a 1MB+ JSONL transcript to a few-KB digest of user + assistant text,
// only for turns where cwd contains "flowOS" or the content mentions flowOS.
async function digestTranscript(filePath, maxChars = 60000) {
  let raw;
  try { raw = await fs.readFile(filePath, "utf8"); } catch { return null; }
  const lines = raw.split("\n").filter(Boolean);
  const turns = [];
  let flowOsTouched = false;
  for (const ln of lines) {
    let d; try { d = JSON.parse(ln); } catch { continue; }
    if (d.type !== "user" && d.type !== "assistant") continue;
    const cwd = d.cwd || "";
    const msg = d.message || {};
    let content = msg.content;
    let text = "";
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "text" && block.text) text += "\n" + block.text;
        // skip tool_use, tool_result — too bloated
      }
    }
    text = text.trim();
    if (!text) continue;
    if (cwd.includes("flowOS") || /flowos|flowOS|BACKLOG\.md|WORKLOG\.md/i.test(text)) {
      flowOsTouched = true;
    }
    turns.push({ role: d.type, text: text.slice(0, 4000), ts: msg.id || d.timestamp });
  }
  if (!flowOsTouched) return null;

  // Take only the last N chars of digest — recent turns dominate.
  let acc = "";
  for (let i = turns.length - 1; i >= 0; i--) {
    const tag = turns[i].role === "user" ? "USER" : "ASSISTANT";
    const chunk = `\n\n--- ${tag} ---\n${turns[i].text}`;
    if (acc.length + chunk.length > maxChars) break;
    acc = chunk + acc;
  }
  return acc.trim();
}

// ─── JSON extraction helpers ─────────────────────────────────────────────────
function extractJson(text) {
  // Find the first { ... } block. Models sometimes wrap with code fences.
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  const body = fence ? fence[1] : text;
  const start = body.indexOf("{");
  if (start === -1) throw new Error("no JSON in response");
  let depth = 0, end = -1;
  for (let i = start; i < body.length; i++) {
    if (body[i] === "{") depth++;
    else if (body[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("unbalanced JSON");
  return JSON.parse(body.slice(start, end + 1));
}

// ─── BOOTSTRAP ───────────────────────────────────────────────────────────────
async function cmdBootstrap() {
  console.log(c("bold", "→ Bootstrap: migrating BACKLOG.md to schema (dry-run unless --apply)"));
  const md = await readMaybe(BACKLOG, "");
  if (!md.trim()) {
    console.log("BACKLOG.md is empty — writing skeleton.");
    const skeleton = serializeBacklog([]);
    const dest = FLAGS.apply ? BACKLOG : PROPOSED;
    await fs.writeFile(dest, skeleton);
    console.log("wrote " + dest);
    return;
  }

  const parsed = parseBacklog(md);
  console.log(`parsed ${parsed.length} top-level sections from BACKLOG.md`);

  let parsedOut;
  if (API_KEY) {
    const system = [{ type: "text", text: BOOTSTRAP_SYSTEM_PROMPT }];
    const { text } = await callClaude({
      system,
      messages: [{
        role: "user",
        content: `BACKLOG.md follows. Return JSON only.\n\n---\n\n${md.slice(0, 80000)}`,
      }],
      model: MODEL,
      maxTokens: 32000,
    });
    try { parsedOut = extractJson(text); }
    catch (e) {
      console.error(c("red", "bootstrap: failed to parse model JSON output — falling back to heuristic"));
      if (FLAGS.verbose) console.error(text.slice(0, 500));
      parsedOut = null;
    }
  }
  if (!parsedOut) {
    // Heuristic: each h2 → item. Status inferred from "DONE", "Status:" lines.
    console.log(c("dim", "using heuristic parser (no API key or model fallback)"));
    const items = parsed.map(p => {
      const heading = p.originalHeading || p.title;
      const bodyAll = p.rawBody.join("\n") + "\n" + Object.values(p.free || {}).join("\n");
      let status = "backlog";
      if (/\bDONE\b/i.test(heading) || /^\s*\*\*Status:\*\*\s*Shipped/im.test(bodyAll)) status = "done";
      else if (/^\s*\*\*Status:\*\*[^\n]*Blocked/im.test(bodyAll)) status = "blocked";
      else if (/^\s*\*\*Status:\*\*[^\n]*Partial/im.test(bodyAll)) status = "in-progress";
      else if (/^\s*\*\*Status:\*\*[^\n]*Workaround/im.test(bodyAll)) status = "blocked";
      // Pull explicit "**Priority:**" or "**Status:**" lines for notes.
      const title = heading.replace(/\s*[—\-·]\s*(DONE|Status:.*)$/i, "").trim();
      const why = bodyAll.trim().slice(0, 1200);
      // Heuristic file extraction.
      const touches = Array.from(bodyAll.matchAll(/`?(api\/[a-z0-9_\-./]+|app\/[a-z0-9_\-./]+|db\/[a-z0-9_\-./]+|scripts\/[a-z0-9_\-./]+)`?/gi))
        .map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
      return { title, status, effort: null, touches, dependsOn: [], why, notes: "", originalHeading: heading };
    });
    parsedOut = { items };
  }

  const ids = new Set();
  const items = (parsedOut.items || []).map((raw, i) => {
    const id = ensureUniqueId(genId(raw.title, "bootstrap-" + i), ids);
    ids.add(id);
    const free = {};
    if (raw.why)   free["Why"] = raw.why;
    if (raw.notes) free["Notes"] = raw.notes;
    return {
      id, title: raw.title || `Item ${i}`,
      status: raw.status || "backlog",
      created: todayDate(),
      lastTouched: todayDate(),
      effort: raw.effort || null,
      source: "bootstrap (from " + (raw.originalHeading || "BACKLOG.md") + ")",
      dependsOn: raw.dependsOn || [],
      touches: raw.touches || [],
      whyDeferred: null,
      free,
    };
  });

  const serialized = serializeBacklog(items);
  const dest = FLAGS.apply ? BACKLOG : PROPOSED;
  await fs.writeFile(dest, serialized);
  console.log(c("green", `wrote ${items.length} items to ${dest}`));
  if (!FLAGS.apply) {
    console.log(c("dim", "dry-run — review " + PROPOSED + " then re-run with --apply"));
  }
}

// ─── CATCH-UP ────────────────────────────────────────────────────────────────
async function cmdCatchUp() {
  const state = await readState();
  const since = FLAGS.since || state.lastCatchUp || state.lastRun || null;
  console.log(c("bold", `→ Catch-up since ${since || "(never)"}`));

  const backlogMd = await readMaybe(BACKLOG, "");
  const backlogItems = parseBacklog(backlogMd);
  const structured = backlogItems.filter(it => it.id);

  // Gather signal sources.
  const transcripts = await listTranscripts(since);
  const commits     = gitLogSince(since);
  const worklog     = await readMaybe(WORKLOG, "");

  console.log(`  • ${transcripts.length} transcript file(s) modified since`);
  console.log(`  • ${commits.length} commit(s) since`);

  // Per-transcript model extraction (one call per file, cached system prompt).
  const proposals = { newItems: [], doneCandidates: [], blocked: [], duplicates: [] };

  if (transcripts.length === 0 && commits.length === 0) {
    console.log(c("dim", "no signal — skipping model calls"));
  } else if (!API_KEY) {
    console.log(c("yellow", "ANTHROPIC_API_KEY not set — skipping transcript extraction. Git + WORKLOG evidence will still run."));
  } else {
    const cachedSystem = buildExtractionSystem(backlogMd.slice(0, 60000));

    for (const t of transcripts) {
      const digest = await digestTranscript(t.path);
      if (!digest) {
        if (FLAGS.verbose) console.log(c("dim", `  skip (no flowOS signal): ${path.basename(t.path)}`));
        continue;
      }
      if (FLAGS.verbose) console.log(`  scan ${path.basename(t.path)} (${digest.length} chars)`);

      const userMsg = [
        `Transcript digest (recent text turns only, tool calls stripped):`,
        ``,
        digest,
        ``,
        `Return JSON per the schema. Empty {"items":[]} is the right answer for most transcripts.`,
      ].join("\n");

      let out;
      try {
        const r = await callClaude({
          system: cachedSystem,
          model: EXTRACTION_MODEL,
          messages: [{ role: "user", content: userMsg }],
          maxTokens: 2500,
        });
        out = extractJson(r.text);
      } catch (e) {
        console.error(c("yellow", `  extraction failed on ${path.basename(t.path)}: ${e.message}`));
        continue;
      }
      for (const it of (out.items || [])) {
        it._source = `transcript ${path.basename(t.path)}`;
        if (it.kind === "done")           proposals.doneCandidates.push(it);
        else if (it.kind === "blocked")   proposals.blocked.push(it);
        else if (it.kind === "duplicate-of") proposals.duplicates.push(it);
        else                              proposals.newItems.push(it);
      }
    }
  }

  // Evidence-based done proposals from git + worklog.
  const evidenceDone = [];
  for (const it of structured) {
    if (it.status === "done" || it.status === "dropped") continue;
    const titleWords = it.title.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    for (const cm of commits) {
      const blob = (cm.subject + "\n" + cm.body).toLowerCase();
      const idHit = blob.includes(it.id);
      const semHit = titleWords.length >= 2 &&
        titleWords.filter(w => blob.includes(w)).length >= Math.min(2, Math.ceil(titleWords.length * 0.6));
      const files = gitFilesForCommit(cm.hash);
      const fileHit = (it.touches || []).some(t => files.some(f => f.endsWith(t)));
      if (idHit) {
        evidenceDone.push({ id: it.id, title: it.title, kind: "done", evidence: `commit ${cm.hash.slice(0,7)} mentions ${it.id}: ${cm.subject}`, confidence: 0.95 });
      } else if (semHit && fileHit) {
        evidenceDone.push({ id: it.id, title: it.title, kind: "proposed-done", evidence: `commit ${cm.hash.slice(0,7)} matches title + touches ${(it.touches||[]).join(",")}: ${cm.subject}`, confidence: 0.65 });
      }
    }
    if (worklog.toLowerCase().includes(it.id) || (titleWords.length >= 2 &&
        titleWords.filter(w => worklog.toLowerCase().includes(w)).length >= Math.min(3, titleWords.length))) {
      evidenceDone.push({ id: it.id, title: it.title, kind: "proposed-done", evidence: "mentioned in WORKLOG.md", confidence: 0.6 });
    }
  }

  // Render proposal markdown.
  const proposalFile = path.join(SCRIPTS, `backlog-proposal-${todayDate()}.md`);
  const out = [];
  out.push(`# Backlog catch-up proposal — ${todayDate()}`);
  out.push("");
  out.push(`Scanned since: ${since || "(never)"} · transcripts: ${transcripts.length} · commits: ${commits.length}`);
  out.push("");
  out.push("## New items (status: proposed)");
  if (proposals.newItems.length === 0) out.push("_none_");
  for (const n of proposals.newItems) {
    out.push("");
    out.push(`### ${n.title}`);
    out.push(`- **confidence**: ${n.confidence ?? "?"}`);
    out.push(`- **source**: ${n._source}`);
    if (n.touches && n.touches.length) out.push(`- **touches**: ${n.touches.join(", ")}`);
    if (n.effort) out.push(`- **effort**: ${n.effort}`);
    out.push("");
    out.push(`**Why:** ${n.why || "—"}`);
    if (n.evidence) {
      out.push("");
      out.push(`> ${n.evidence}`);
    }
  }
  out.push("");
  out.push("## Done candidates (require approval before closing)");
  const allDone = [...proposals.doneCandidates, ...evidenceDone];
  if (allDone.length === 0) out.push("_none_");
  for (const d of allDone) {
    out.push("");
    out.push(`- **${d.id || "(unmatched)"}**: ${d.title || d.duplicateOf || ""} · conf ${d.confidence ?? "?"}`);
    if (d.evidence) out.push(`  - ${d.evidence}`);
  }
  out.push("");
  out.push("## Blocked / duplicate flags");
  if (proposals.blocked.length + proposals.duplicates.length === 0) out.push("_none_");
  for (const b of proposals.blocked) {
    out.push(`- BLOCKED: ${b.title} — ${b.why}`);
  }
  for (const d of proposals.duplicates) {
    out.push(`- DUP of ${d.duplicateOf}: ${d.title}`);
  }
  out.push("");
  await fs.writeFile(proposalFile, out.join("\n"));
  console.log(c("green", `wrote ${proposalFile}`));

  // Apply mode: merge proposals into BACKLOG.md.
  if (FLAGS.apply) {
    const existingIds = new Set(structured.map(it => it.id));
    const newItems = proposals.newItems.map((n, i) => {
      const id = ensureUniqueId(genId(n.title, "catchup-" + i), existingIds);
      existingIds.add(id);
      return {
        id, title: n.title, status: "backlog",
        created: todayDate(), lastTouched: todayDate(),
        effort: n.effort || null,
        source: n._source,
        dependsOn: [], touches: n.touches || [],
        whyDeferred: null,
        free: { Why: n.why || "", Evidence: n.evidence || "" },
      };
    });
    const merged = [...structured];
    for (const d of allDone) {
      const target = merged.find(m => m.id === d.id);
      if (target) {
        target.status = d.kind === "done" ? "done" : "proposed-done";
        target.lastTouched = todayDate();
        target.free = target.free || {};
        target.free["Update " + todayDate()] = d.evidence;
      }
    }
    const final = [...merged, ...newItems];
    await fs.writeFile(BACKLOG, serializeBacklog(final));
    state.lastCatchUp = nowIso();
    state.lastRun = nowIso();
    await writeState(state);
    console.log(c("green", `applied: +${newItems.length} new, ${allDone.length} done-candidates merged`));
  } else {
    console.log(c("dim", "dry-run — review " + proposalFile + " then re-run with --apply"));
  }
}

// ─── PLAN ────────────────────────────────────────────────────────────────────
async function cmdPlan() {
  console.log(c("bold", `→ Daily plan — ${todayDate()}`));

  const backlogMd = await readMaybe(BACKLOG, "");
  let items = parseBacklog(backlogMd).filter(it => it.id);
  if (items.length === 0) {
    console.log(c("yellow", "No structured items in BACKLOG.md. Run bootstrap --apply first."));
    return;
  }

  // Compute dependsOnCount-from-others.
  const inboundDeps = new Map();
  for (const it of items) {
    for (const d of it.dependsOn || []) inboundDeps.set(d, (inboundDeps.get(d) || 0) + 1);
  }

  const compact = items.map(it => ({
    id: it.id, title: it.title, status: it.status,
    lastTouched: it.lastTouched, effort: it.effort,
    touches: it.touches, dependsOn: it.dependsOn,
    blockedBy: inboundDeps.get(it.id) || 0,
    notes: (it.free?.Notes || "").slice(0, 300),
    why: (it.free?.Why || "").slice(0, 300),
  }));

  let modelOut = { today: [], upNext: [], deferred: [], rationale: "" };
  if (API_KEY) {
    const { text } = await callClaude({
      system: [{ type: "text", text: PLAN_SYSTEM_PROMPT }],
      messages: [{
        role: "user",
        content: `Current date: ${todayDate()}\n\nBacklog (JSON):\n${JSON.stringify(compact, null, 2)}\n\nPick today's plan. Return JSON only.`,
      }],
      maxTokens: 2500,
    });
    try { modelOut = extractJson(text); }
    catch { console.error(c("yellow", "plan: model output unparseable — falling back to heuristic")); }
  }

  // Heuristic fallback if model gave nothing or no API key.
  if (!modelOut.today || modelOut.today.length === 0) {
    const candidates = compact
      .filter(it => !["done", "dropped", "blocked"].includes(it.status))
      .sort((a, b) => (b.blockedBy - a.blockedBy) || (b.lastTouched || "").localeCompare(a.lastTouched || ""));
    if (candidates[0]) {
      modelOut.today = [{ id: candidates[0].id, whyNow: "heuristic: highest inbound deps + most recent touch" }];
      modelOut.rationale = modelOut.rationale || "Heuristic pick — model produced no plan. Treat as low-signal day; consider cleanup.";
    } else {
      modelOut.rationale = "Low-signal day, suggest cleanup instead.";
    }
  }

  // Render terminal Kanban.
  renderKanban(items, modelOut);

  // Markdown archive.
  await fs.mkdir(PLANS_DIR, { recursive: true });
  const planFile = path.join(PLANS_DIR, `plan-${todayDate()}.md`);
  await fs.writeFile(planFile, renderPlanMarkdown(items, modelOut));
  console.log("");
  console.log(c("dim", "archived to " + planFile));

  const state = await readState();
  state.lastRun = nowIso();
  await writeState(state);
}

// ─── Rendering ───────────────────────────────────────────────────────────────
function renderKanban(items, plan) {
  const byId = new Map(items.map(it => [it.id, it]));
  const sevenAgo = Date.now() - 7 * 86400 * 1000;
  const todayIds = new Set((plan.today || []).map(t => t.id));
  const upNextIds = new Set(plan.upNext || []);

  const cols = {
    Backlog:    items.filter(it => it.status === "backlog" && !todayIds.has(it.id) && !upNextIds.has(it.id)),
    "Up Next":  items.filter(it => upNextIds.has(it.id)),
    Today:      items.filter(it => todayIds.has(it.id)),
    "In Progress": items.filter(it => it.status === "in-progress"),
    Blocked:    items.filter(it => it.status === "blocked"),
    "Done (7d)": items.filter(it => it.status === "done" && new Date(it.lastTouched || 0).getTime() >= sevenAgo),
  };

  const termWidth = parseInt(process.env.COLUMNS || process.stdout.columns || 0, 10) || 100;
  const colNames = Object.keys(cols);
  const colWidth = Math.floor((termWidth - colNames.length - 1) / colNames.length);

  if (termWidth < 140 || colWidth < 18) {
    // Stacked fallback.
    for (const name of colNames) {
      console.log("");
      console.log(c("bold", `## ${name}`));
      const list = cols[name];
      if (list.length === 0) { console.log(c("dim", "  (empty)")); continue; }
      for (const it of list) {
        const whyNow = (plan.today || []).find(t => t.id === it.id)?.whyNow;
        const color = name === "Blocked" ? "red" : name === "Done (7d)" ? "green" : null;
        const head = `${it.id} · ${it.title}`;
        console.log(color ? c(color, head) : c("bold", head));
        if (it.effort) console.log(c("dim", `   ${it.effort}`));
        if (whyNow)    console.log(`   ${whyNow}`);
      }
    }
  } else {
    // Side-by-side columns.
    const cards = colNames.map(name => renderCards(cols[name], colWidth, name, plan));
    const maxRows = Math.max(...cards.map(c => c.length));
    // Headers.
    const headerRow = colNames.map(n => padCell(c("bold", n), colWidth)).join(" ");
    console.log(headerRow);
    console.log(colNames.map(_ => "─".repeat(colWidth)).join(" "));
    for (let r = 0; r < maxRows; r++) {
      const row = cards.map(col => col[r] || " ".repeat(colWidth)).join(" ");
      console.log(row);
    }
  }

  // Why-today block.
  console.log("");
  console.log(c("bold", "Why today's pick"));
  console.log(plan.rationale || "—");
  for (const t of plan.today || []) {
    const it = byId.get(t.id);
    if (!it) continue;
    console.log(`  • ${c("bold", it.id)}  ${it.title} — ${t.whyNow || ""}`);
  }
}

function visualLength(s) { return s.replace(/\x1b\[[0-9;]*m/g, "").length; }
function padCell(s, w) {
  const v = visualLength(s);
  if (v >= w) return s;
  return s + " ".repeat(w - v);
}
function wrapText(s, w) {
  const words = s.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const word of words) {
    if (visualLength(cur) + word.length + 1 > w) {
      if (cur) lines.push(cur);
      cur = word.length > w ? word.slice(0, w - 1) + "…" : word;
    } else {
      cur = cur ? cur + " " + word : word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function renderCards(list, width, columnName, plan) {
  const out = [];
  if (list.length === 0) {
    out.push(padCell(c("dim", "(empty)"), width));
    return out;
  }
  const innerW = width - 2;
  for (const it of list) {
    const colorWrap = columnName === "Blocked" ? "red" : columnName === "Done (7d)" ? "green" : null;
    const whyNow = (plan.today || []).find(t => t.id === it.id)?.whyNow;
    const lines = [];
    const head = `${it.id} · ${it.title}`;
    lines.push(...wrapText(head, innerW).map(s => colorWrap ? c(colorWrap, s) : c("bold", s)));
    const meta = [it.effort, (it.touches || [])[0]].filter(Boolean).join(" · ");
    if (meta) lines.push(c("dim", meta).length > innerW ? meta.slice(0, innerW) : c("dim", meta));
    if (whyNow) lines.push(...wrapText(whyNow, innerW));
    // Card frame: top, content, bottom, blank
    out.push(padCell("┌" + "─".repeat(width - 2) + "┐", width));
    for (const ln of lines) out.push(padCell("│ " + padCell(ln, innerW - 1) + "│", width));
    out.push(padCell("└" + "─".repeat(width - 2) + "┘", width));
    out.push(padCell("", width));
  }
  return out;
}

function renderPlanMarkdown(items, plan) {
  const byId = new Map(items.map(it => [it.id, it]));
  const sevenAgo = Date.now() - 7 * 86400 * 1000;
  const sec = (title, list) => {
    const lines = [`## ${title}`, ""];
    if (!list.length) lines.push("_empty_");
    for (const it of list) {
      lines.push(`### ${it.id} · ${it.title}`);
      if (it.effort) lines.push(`- effort: ${it.effort}`);
      if (it.touches?.length) lines.push(`- touches: ${it.touches.join(", ")}`);
      const whyNow = (plan.today || []).find(t => t.id === it.id)?.whyNow;
      if (whyNow) lines.push(`- why now: ${whyNow}`);
      lines.push("");
    }
    return lines.join("\n");
  };

  const todayIds = new Set((plan.today || []).map(t => t.id));
  const upNextIds = new Set(plan.upNext || []);

  return [
    `# Plan — ${todayDate()}`,
    "",
    "## Why today's pick",
    plan.rationale || "—",
    "",
    sec("Today", items.filter(it => todayIds.has(it.id))),
    sec("Up Next", items.filter(it => upNextIds.has(it.id))),
    sec("In Progress", items.filter(it => it.status === "in-progress")),
    sec("Blocked", items.filter(it => it.status === "blocked")),
    sec("Backlog", items.filter(it => it.status === "backlog" && !todayIds.has(it.id) && !upNextIds.has(it.id))),
    sec("Done (last 7d)", items.filter(it => it.status === "done" && new Date(it.lastTouched || 0).getTime() >= sevenAgo)),
  ].join("\n");
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!CMD || CMD === "--help" || CMD === "-h") {
    console.log(`backlog-engine — FlowOS backlog + daily-plan engine

  bootstrap         migrate BACKLOG.md to schema (dry-run; --apply to write)
  catch-up          scan transcripts + git since last run (dry-run; --apply merges)
  plan              emit today's Kanban
  daily             catch-up then plan (use --apply to write catch-up changes)

flags:
  --apply           write changes (default is dry-run for bootstrap & catch-up)
  --since=<ISO>     override last-run timestamp
  --verbose         show extraction reasoning

env:
  ANTHROPIC_API_KEY   required
  BACKLOG_MODEL              default ${MODEL}
  BACKLOG_EXTRACTION_MODEL   default ${EXTRACTION_MODEL}
`);
    return;
  }
  if (CMD === "bootstrap") return cmdBootstrap();
  if (CMD === "catch-up")  return cmdCatchUp();
  if (CMD === "plan")      return cmdPlan();
  if (CMD === "daily") {
    await cmdCatchUp();
    return cmdPlan();
  }
  console.error(c("red", "unknown command: " + CMD));
  process.exit(1);
}

main().catch(e => {
  console.error(c("red", "fatal: " + e.message));
  console.error(e.stack);
  process.exit(1);
});
