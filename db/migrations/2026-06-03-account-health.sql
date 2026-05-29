-- FlowOS Reach — PR B6 · channels.health_status
--
-- Per-channel rolling health summary, refreshed every 15 min by the
-- /api/cron/account-health cron. Shape:
--   {
--     "status":        "healthy" | "degraded" | "reconnect",
--     "lastChecked":   ISO timestamp (UTC),
--     "message":       short user-facing string,
--     "needsReconnect": boolean
--   }
--
-- "healthy"   → tile renders normal
-- "degraded"  → amber dot + tooltip (warning from Zernio: token nearing expiry,
--               missing optional permissions, etc.)
-- "reconnect" → red dot + tooltip ("Needs reconnect"), banner CTA in Connections.

ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS health_status jsonb NOT NULL DEFAULT '{}'::jsonb;
