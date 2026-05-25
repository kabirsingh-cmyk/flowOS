/**
 * GET /api/spend — FlowOS operator spend dashboard
 *
 * Queries generation_usage with the service key (bypasses RLS) to return
 * cross-tenant cost aggregates. Not exposed to tenants — operator-only view.
 */

import { requireAuth } from './lib/auth.js';

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function supabaseHeaders() {
  return {
    'apikey':        process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET') return json({ ok: false, error: 'GET required' }, 405);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const base = process.env.SUPABASE_URL;
  if (!base) return json({ ok: false, error: 'SUPABASE_URL not set' }, 500);

  // Fetch up to 1000 rows ordered by newest first. Service key bypasses RLS.
  const res = await fetch(
    `${base}/rest/v1/generation_usage?select=*&order=created_at.desc&limit=1000`,
    { headers: supabaseHeaders() }
  );

  if (!res.ok) {
    const text = await res.text();
    return json({ ok: false, error: `Supabase error (${res.status}): ${text}` }, 502);
  }

  const rows = await res.json();

  const now         = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const ago30d       = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const totalSpend     = rows.reduce((s, r) => s + (r.cost_estimate || 0), 0);
  const thisMonthSpend = rows.filter(r => r.created_at >= startOfMonth).reduce((s, r) => s + (r.cost_estimate || 0), 0);
  const last30dSpend   = rows.filter(r => r.created_at >= ago30d).reduce((s, r) => s + (r.cost_estimate || 0), 0);

  const byProvider = {};
  const byTenant   = {};

  for (const r of rows) {
    if (!byProvider[r.provider]) byProvider[r.provider] = { provider: r.provider, spend: 0, jobs: 0 };
    byProvider[r.provider].spend += r.cost_estimate || 0;
    byProvider[r.provider].jobs  += 1;

    if (!byTenant[r.tenant_id]) byTenant[r.tenant_id] = { tenant_id: r.tenant_id, spend: 0, jobs: 0 };
    byTenant[r.tenant_id].spend += r.cost_estimate || 0;
    byTenant[r.tenant_id].jobs  += 1;
  }

  return json({
    ok: true,
    summary: {
      totalSpend,
      thisMonthSpend,
      last30dSpend,
      totalJobs: rows.length,
    },
    byProvider: Object.values(byProvider).sort((a, b) => b.spend - a.spend),
    byTenant:   Object.values(byTenant).sort((a, b) => b.spend - a.spend),
    recent:     rows.slice(0, 50),
  });
}
