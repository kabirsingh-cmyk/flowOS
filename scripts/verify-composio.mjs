#!/usr/bin/env node
// Verify FlowOS APP_MAP slugs against the real Composio v3 toolkits API.
//
// Usage:
//   COMPOSIO_API_KEY2=<key> node scripts/verify-composio.mjs
//
// Steps:
//   1. List every toolkit slug Composio knows about.
//   2. For every FlowOS Composio-provider connector id, check whether its mapped
//      slug exists in that list.
//   3. For each existing slug, attempt to resolve/create a managed auth_config.
//   4. Print a diff: ✓ valid · ✗ missing slug · ⚠ exists but no managed auth.

const KEY = process.env.COMPOSIO_API_KEY2;
if (!KEY) {
  console.error("COMPOSIO_API_KEY2 env var not set. Run with: COMPOSIO_API_KEY2=<key> node scripts/verify-composio.mjs");
  process.exit(2);
}

const BASE = "https://backend.composio.dev/api/v3";
const HEADERS = { "x-api-key": KEY, "Content-Type": "application/json" };

// Must stay in sync with APP_MAP in api/composio.js
const APP_MAP = {
  googleads:    "googleads",
  metaads:      "facebook",
  liads:        "linkedin",
  ttads:        "tiktok",
  xads:         "twitter",
  fb:           "facebook",
  ig:           "instagram",
  li:           "linkedin",
  x:            "twitter",
  tt:           "tiktok",
  reddit:       "reddit",
  yt:           "youtube",
  mailchimp:    "mailchimp",
  klaviyo:      "klaviyo",
  mailerlite:   "mailerlite",
  moosend:      "moosend",
  hunter:       "hunter",
  klaviyo_sms:  "klaviyo",
  neverbounce:  "neverbounce",
  kickbox:      "kickbox",
  listclean:    "listclean",
  gsc:          "google_search_console",
  ahrefs:       "ahrefs",
  moz:          "moz",
  neuronwriter: "neuronwriter",
  shopify:      "shopify",
  heygen:       "heygen",
  elevenlabs:   "elevenlabs",
  ga4:          "google_analytics",
  hubspot:      "hubspot",
  salesforce:   "salesforce",
};

async function listToolkits() {
  let cursor = null;
  const all = new Set();
  // Composio paginates; loop until empty page or no cursor.
  for (let page = 0; page < 20; page++) {
    const url = `${BASE}/toolkits?limit=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    if (!res.ok) throw new Error(`/toolkits ${res.status}: ${text.slice(0, 200)}`);
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(`/toolkits returned non-JSON: ${text.slice(0, 200)}`); }
    const items = data.items || data.toolkits || data.data || [];
    items.forEach(t => {
      const slug = (t.slug || t.toolkit_slug || t.id || "").toLowerCase();
      if (slug) all.add(slug);
    });
    cursor = data.next_cursor || data.cursor || null;
    if (!cursor || items.length === 0) break;
  }
  return all;
}

async function tryAuthConfig(slug) {
  // Mirrors getOrCreateAuthConfigId in api/composio.js
  const listRes = await fetch(`${BASE}/auth_configs?toolkit_slug=${encodeURIComponent(slug)}&limit=20`, { headers: HEADERS });
  if (!listRes.ok) return { ok: false, reason: `list ${listRes.status}` };
  const listData = await listRes.json();
  const items = listData.items || listData.auth_configs || listData.data || [];
  const existing = items.find(c => {
    const s = (c.toolkit?.slug || c.toolkit_slug || c.slug || "").toLowerCase();
    const managed = c.auth_config?.is_composio_managed ?? c.is_composio_managed ?? true;
    return s === slug.toLowerCase() && managed;
  });
  if (existing) return { ok: true, authConfigId: existing.auth_config?.id || existing.id, reused: true };

  // Try to create a managed one
  const createRes = await fetch(`${BASE}/auth_configs`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      toolkit: { slug },
      auth_config: { type: "use_composio_managed_auth" },
    }),
  });
  const createText = await createRes.text();
  if (!createRes.ok) return { ok: false, reason: `create ${createRes.status}: ${createText.slice(0, 160)}` };
  let data; try { data = JSON.parse(createText); } catch { return { ok: false, reason: "create non-JSON" }; }
  return { ok: true, authConfigId: data.auth_config?.id || data.id, reused: false };
}

async function initiateOAuthRoundTrip(slug) {
  // 1. Get/create managed auth_config (same path /api/composio uses)
  const list = await fetch(`${BASE}/auth_configs?toolkit_slug=${encodeURIComponent(slug)}&limit=20`, { headers: HEADERS }).then(r => r.json());
  const items = list.items || list.auth_configs || list.data || [];
  const existing = items.find(c => {
    const s = (c.toolkit?.slug || c.toolkit_slug || c.slug || "").toLowerCase();
    return s === slug.toLowerCase();
  });
  const authConfigId = existing?.auth_config?.id || existing?.id;
  if (!authConfigId) return { ok: false, reason: "no auth_config" };

  // 2. Create connected_account with a fake callback URL
  const createRes = await fetch(`${BASE}/connected_accounts`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      auth_config: { id: authConfigId },
      connection:  {
        user_id:      "test-tenant-verify",
        callback_url: "https://example.com/callback",
      },
    }),
  });
  const text = await createRes.text();
  if (!createRes.ok) return { ok: false, reason: `${createRes.status} ${text.slice(0, 200)}` };
  let data; try { data = JSON.parse(text); } catch { return { ok: false, reason: "non-JSON" }; }
  const redirectUrl =
    data?.connectionData?.val?.redirectUrl ||
    data?.connectionData?.redirectUrl      ||
    data?.redirectUrl                      ||
    data?.redirect_url                     ||
    null;

  return { ok: !!redirectUrl, redirectUrl, connectionId: data?.id };
}

async function fetchToolkitDetails(slug) {
  // Fetch toolkit detail to discover its required auth_schemes.
  const res = await fetch(`${BASE}/toolkits/${encodeURIComponent(slug)}`, { headers: HEADERS });
  if (!res.ok) {
    // Fall back to query-param form
    const fallback = await fetch(`${BASE}/toolkits?slug=${encodeURIComponent(slug)}&limit=1`, { headers: HEADERS });
    if (!fallback.ok) return null;
    const data = await fallback.json();
    const items = data.items || data.toolkits || data.data || [];
    return items[0] || null;
  }
  return res.json().catch(() => null);
}

async function tryApiKeyCustomAuth(slug) {
  // Confirmed payload (via prior probes):
  //   auth_config: { type: "use_custom_auth", authScheme: "API_KEY" }
  //   connected_account.connection: { user_id, data: { apiKey } }
  const acRes = await fetch(`${BASE}/auth_configs`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      toolkit:     { slug },
      auth_config: { type: "use_custom_auth", authScheme: "API_KEY" },
    }),
  });
  const acText = await acRes.text();
  if (!acRes.ok) return { ok: false, reason: `auth_config: ${acRes.status} ${acText.slice(0, 200)}` };
  let acData; try { acData = JSON.parse(acText); } catch { return { ok: false, reason: "auth_config non-JSON" }; }
  const authConfigId = acData.auth_config?.id || acData.id;

  // Create connection with fake key — Composio won't validate, just round-trip the shape.
  const FAKE = "fake-test-key-for-shape-verification";
  const cRes = await fetch(`${BASE}/connected_accounts`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      auth_config: { id: authConfigId },
      connection:  { user_id: "test-verify-tenant", data: { apiKey: FAKE } },
    }),
  });
  const cText = await cRes.text();
  if (!cRes.ok) {
    // Clean up the orphan auth_config
    await fetch(`${BASE}/auth_configs/${authConfigId}`, { method: "DELETE", headers: HEADERS }).catch(() => {});
    return { ok: false, reason: `connected_account: ${cRes.status} ${cText.slice(0, 200)}` };
  }
  let cData; try { cData = JSON.parse(cText); } catch { cData = {}; }

  // Clean up both orphans
  if (cData.id) await fetch(`${BASE}/connected_accounts/${cData.id}`, { method: "DELETE", headers: HEADERS }).catch(() => {});
  await fetch(`${BASE}/auth_configs/${authConfigId}`, { method: "DELETE", headers: HEADERS }).catch(() => {});

  return { ok: true, authConfigId, connectionId: cData.id, status: cData.status };
}

(async () => {
  console.log("Listing Composio toolkits…");
  const toolkitSlugs = await listToolkits();
  console.log(`  ${toolkitSlugs.size} toolkit slugs found.\n`);

  const flowOSIds = Object.keys(APP_MAP).sort();
  const results = [];

  for (const fid of flowOSIds) {
    const slug = APP_MAP[fid];
    const exists = toolkitSlugs.has(slug.toLowerCase());
    let auth = null;
    if (exists) {
      auth = await tryAuthConfig(slug);
    }
    results.push({ fid, slug, exists, auth });
  }

  console.log("Results:");
  console.log("--------");
  let valid = 0, missing = 0, noManaged = 0;
  for (const r of results) {
    if (!r.exists) {
      console.log(`✗  ${r.fid.padEnd(15)} → ${r.slug.padEnd(28)}  slug NOT in Composio toolkit list`);
      missing++;
    } else if (!r.auth?.ok) {
      console.log(`⚠  ${r.fid.padEnd(15)} → ${r.slug.padEnd(28)}  exists, no managed auth: ${r.auth?.reason}`);
      noManaged++;
    } else {
      console.log(`✓  ${r.fid.padEnd(15)} → ${r.slug.padEnd(28)}  auth_config: ${r.auth.authConfigId} ${r.auth.reused ? "(reused)" : "(created)"}`);
      valid++;
    }
  }

  console.log("");
  console.log(`Summary: ${valid} valid · ${noManaged} no-managed-auth · ${missing} missing-slug`);

  // ── OAuth round-trip test ──
  // Use one of the known-valid slugs to do a real /connected_accounts POST and
  // confirm the returned redirectUrl is a real OAuth URL.
  const oauthCandidate = results.find(r => r.exists && r.auth?.ok);
  if (oauthCandidate) {
    console.log(`\nOAuth round-trip test → ${oauthCandidate.fid} (${oauthCandidate.slug})…`);
    const trip = await initiateOAuthRoundTrip(oauthCandidate.slug);
    if (trip.ok) {
      console.log(`✓ initiate_connection works. redirectUrl: ${trip.redirectUrl.slice(0, 80)}…`);
      console.log(`  (connection id: ${trip.connectionId})`);
    } else {
      console.log(`✗ initiate_connection failed: ${trip.reason}`);
    }
  }

  // ── API-key custom-auth test ──
  // For at least one of the "no managed auth" toolkits, confirm we can create
  // a use_custom_auth auth_config (the path /api/composio takes for API-key connectors).
  const apiKeyCandidate = results.find(r => r.exists && !r.auth?.ok);
  if (apiKeyCandidate) {
    console.log(`\nAPI-key custom-auth test → ${apiKeyCandidate.fid} (${apiKeyCandidate.slug})…`);
    const tryCustom = await tryApiKeyCustomAuth(apiKeyCandidate.slug);
    if (tryCustom.ok) {
      console.log(`✓ API-key round-trip works.`);
      console.log(`  auth_config: ${tryCustom.authConfigId}`);
      console.log(`  connection:  ${tryCustom.connectionId} (status: ${tryCustom.status}) — created with data.apiKey, then deleted`);
    } else {
      console.log(`✗ API-key round-trip failed: ${tryCustom.reason}`);
    }
  }

  if (missing > 0) {
    console.log("\nSuggested slugs for the missing ones (best Levenshtein match):");
    const allSlugs = [...toolkitSlugs];
    for (const r of results.filter(r => !r.exists)) {
      const guesses = allSlugs
        .map(s => ({ s, d: lev(s, r.slug) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .filter(g => g.d <= 6);
      console.log(`  ${r.fid.padEnd(15)} (mapped to "${r.slug}")  →  ${guesses.map(g => g.s).join(", ") || "(no close match)"}`);
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
