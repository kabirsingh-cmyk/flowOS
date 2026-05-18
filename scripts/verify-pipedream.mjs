#!/usr/bin/env node
// Verify FlowOS APP_MAP slugs against the real Pipedream Connect API.
//
// Usage:
//   PIPEDREAM_PROJECT_ID=proj_XXX \
//   PIPEDREAM_CLIENT_ID=... \
//   PIPEDREAM_CLIENT_SECRET=... \
//   node scripts/verify-pipedream.mjs
//
// Steps:
//   1. Exchange client_credentials for a Bearer access_token.
//   2. List every Pipedream app slug.
//   3. For each FlowOS Pipedream-provider connector id, check whether its mapped
//      slug exists in that list.
//   4. Mint a real Connect Token for one known-good app (sendgrid) and confirm
//      we get a `connect_link_url` back.

const {
  PIPEDREAM_PROJECT_ID,
  PIPEDREAM_CLIENT_ID,
  PIPEDREAM_CLIENT_SECRET,
  PIPEDREAM_ENVIRONMENT = "production",
} = process.env;

if (!PIPEDREAM_PROJECT_ID || !PIPEDREAM_CLIENT_ID || !PIPEDREAM_CLIENT_SECRET) {
  console.error("Missing env. Run with: PIPEDREAM_PROJECT_ID=... PIPEDREAM_CLIENT_ID=... PIPEDREAM_CLIENT_SECRET=... node scripts/verify-pipedream.mjs");
  process.exit(2);
}

const BASE = "https://api.pipedream.com/v1";

// Must stay in sync with APP_MAP in api/pipedream.js
const APP_MAP = {
  pinads:         "pinterest",
  pn:             "pinterest",
  sendgrid:       "sendgrid",
  activecampaign: "activecampaign",
  twilio:         "twilio",
  runware:        "runware",
};

async function getAccessToken() {
  const res = await fetch(`${BASE}/oauth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      grant_type:    "client_credentials",
      client_id:     PIPEDREAM_CLIENT_ID,
      client_secret: PIPEDREAM_CLIENT_SECRET,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`/oauth/token ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error("No access_token in response");
  return data.access_token;
}

async function listApps(token) {
  const all = new Map();
  let cursor = null;
  for (let i = 0; i < 30; i++) {
    const url = `${BASE}/apps?limit=200${cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    if (!res.ok) throw new Error(`/apps ${res.status}: ${text.slice(0, 300)}`);
    const data = JSON.parse(text);
    const items = data?.data || data?.apps || data?.items || [];
    for (const a of items) {
      const slug = (a.name_slug || a.slug || a.id || "").toLowerCase();
      if (slug && !all.has(slug)) {
        all.set(slug, { slug, name: a.name || a.display_name || null, auth_type: a.auth_type || a.type || null });
      }
    }
    cursor = data?.page_info?.end_cursor || data?.next_cursor || null;
    if (!cursor || items.length === 0) break;
  }
  return all;
}

async function mintConnectToken(token, app) {
  const res = await fetch(`${BASE}/connect/${encodeURIComponent(PIPEDREAM_PROJECT_ID)}/tokens`, {
    method:  "POST",
    headers: {
      "Authorization":    `Bearer ${token}`,
      "Content-Type":     "application/json",
      "x-pd-environment": PIPEDREAM_ENVIRONMENT,
    },
    body:    JSON.stringify({
      external_user_id: "test-verify-tenant",
      allowed_origins:  [],
    }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, reason: `${res.status} ${text.slice(0, 300)}` };
  let data; try { data = JSON.parse(text); } catch { return { ok: false, reason: "non-JSON" }; }
  const connectUrl = data?.connect_link_url || data?.connectLinkUrl;
  return {
    ok:           !!data?.token,
    token:        data?.token,
    connectUrl:   connectUrl ? `${connectUrl}${connectUrl.includes("?") ? "&" : "?"}app=${encodeURIComponent(app)}` : null,
    expiresAt:    data?.expires_at,
  };
}

(async () => {
  console.log(`Pipedream project: ${PIPEDREAM_PROJECT_ID}`);
  console.log(`Environment:       ${PIPEDREAM_ENVIRONMENT}`);
  console.log("");

  console.log("Exchanging client credentials for Bearer token…");
  const token = await getAccessToken();
  console.log("  ✓ access_token acquired\n");

  console.log("Listing Pipedream apps…");
  const apps = await listApps(token);
  console.log(`  ${apps.size} apps found.\n`);

  const flowOSIds = Object.keys(APP_MAP).sort();
  let valid = 0, missing = 0;
  console.log("Results:");
  console.log("--------");
  for (const fid of flowOSIds) {
    const slug = APP_MAP[fid];
    const meta = apps.get(slug.toLowerCase());
    if (meta) {
      console.log(`✓  ${fid.padEnd(16)} → ${slug.padEnd(20)} ${meta.name ? `· ${meta.name}` : ""} ${meta.auth_type ? `[${meta.auth_type}]` : ""}`);
      valid++;
    } else {
      console.log(`✗  ${fid.padEnd(16)} → ${slug.padEnd(20)} slug NOT in Pipedream catalog`);
      missing++;
    }
  }
  console.log("");
  console.log(`Summary: ${valid} valid · ${missing} missing-slug · ${apps.size} total Pipedream apps`);

  if (missing > 0) {
    console.log("\nSubstring matches for missing slugs (any Pipedream app containing the search term):");
    const allEntries = [...apps.values()];
    for (const fid of flowOSIds) {
      const slug = APP_MAP[fid];
      if (apps.has(slug.toLowerCase())) continue;
      // Try the slug + a few likely synonyms
      const queries = [slug];
      if (slug === "wordpress")   queries.push("wp", "press");
      const seen = new Set();
      const hits = [];
      for (const q of queries) {
        for (const a of allEntries) {
          if ((a.slug.includes(q) || (a.name || "").toLowerCase().includes(q)) && !seen.has(a.slug)) {
            seen.add(a.slug);
            hits.push(`${a.slug}${a.name ? ` (${a.name})` : ""}`);
            if (hits.length >= 8) break;
          }
        }
        if (hits.length >= 8) break;
      }
      console.log(`  ${fid.padEnd(16)} (mapped to "${slug}")  →`);
      if (hits.length === 0) console.log("    (no substring matches found)");
      else hits.forEach(h => console.log(`    · ${h}`));
    }
  }

  // Connect Token round-trip on a known-good slug.
  const validEntry = flowOSIds.find(fid => apps.has(APP_MAP[fid].toLowerCase()));
  if (validEntry) {
    const slug = APP_MAP[validEntry];
    console.log(`\nConnect-token round-trip → ${validEntry} (${slug})…`);
    const trip = await mintConnectToken(token, slug);
    if (trip.ok) {
      console.log(`✓ /tokens works. token: ${trip.token.slice(0, 24)}…`);
      console.log(`  connect_link_url: ${trip.connectUrl ? trip.connectUrl.slice(0, 96) + "…" : "(none)"}`);
      console.log(`  expires_at:       ${trip.expiresAt || "(none)"}`);
    } else {
      console.log(`✗ /tokens failed: ${trip.reason}`);
    }
  }
})().catch(e => {
  console.error("FAILED:", e.message);
  process.exit(1);
});

function lev(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}
