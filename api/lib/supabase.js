/**
 * Shared Supabase REST helpers — imported by chat.js and analytics-ingest.js
 */

export function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
  };
}

export async function fetchBrandProfile(tenantId) {
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supaUrl || !supaKey || !tenantId) return null;
  try {
    const res = await fetch(
      `${supaUrl}/rest/v1/brands?user_id=eq.${encodeURIComponent(tenantId)}&select=*&limit=1`,
      { headers: sbHeaders() }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch {
    return null;
  }
}
