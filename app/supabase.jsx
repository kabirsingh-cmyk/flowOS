// FlowOS Reach — Supabase client + authed fetch helper
//
// The anon key is intentionally public — all data is now protected by Row
// Level Security (see db/migrations/007_core_schema_and_rls.sql) and every
// /api/* endpoint requires either a user JWT (requireAuth) or the cron
// secret (requireCron). The anon key alone gets you nothing.
import { createClient } from '@supabase/supabase-js'

const _sbUrl  = 'https://rlrfffnkoxwzgfzklxyo.supabase.co';
const _sbAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJscmZmZm5rb3h3emdmemtseHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjkyMzcsImV4cCI6MjA5MzE0NTIzN30.yCyggFjqOw0uLg6gQd5cBy4cgexy8grcIi-AmyPF_A8';

// Use the bundled ES module — the Supabase CDN script was removed from
// index.html during the Vite migration, so `window.supabase` was undefined.
const sb = createClient(_sbUrl, _sbAnon);
window.sb            = sb;
window.__SUPABASE_URL__      = _sbUrl;
window.__SUPABASE_ANON_KEY__ = _sbAnon;

// ── Auth state shared across the app ────────────────────────────────────────
// flowAuth.getAccessToken() returns whichever token is currently valid:
//   - real Supabase user session (production / login flow)
//   - dev JWT minted by /api/dev/mint-token (?seed=mveda / ?seed=erickson)
// flowAuth.setDevToken() is called once by chat-app.jsx after the dev mint.
let _devToken = null;
window.flowAuth = {
  setDevToken(t) { _devToken = t || null; },
  hasDevToken() { return !!_devToken; },
  async getAccessToken() {
    if (_devToken) return _devToken;
    try {
      const { data: { session } } = await sb.auth.getSession();
      return session?.access_token || null;
    } catch { return null; }
  },
  async authHeaders() {
    const t = await this.getAccessToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  },
};

// ── apiFetch — drop-in fetch wrapper for /api/* and direct Supabase REST ────
// Always attaches the user's bearer token (or dev token) to the Authorization
// header. Existing headers in init are preserved. Use this everywhere instead
// of bare fetch when calling our own /api or Supabase /rest/v1.
window.apiFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Authorization")) {
    const token = await window.flowAuth.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
};
