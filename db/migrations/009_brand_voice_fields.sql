-- 009_brand_voice_fields — Structured messaging + terminology columns on brands.
--
-- Read by api/chat.js buildBrandVoiceBlock (supervisor + drafter system prompts).
-- Written by api/brand-import.js upsertBrand (Claude brand-analysis result).
--
-- messaging  { valuePropositions: string[] }
-- terminology { approved: string[], prohibited: string[] }
--
-- voice.attributes / voice.antiAttributes live inside the existing `voice` jsonb
-- column — no schema change needed for those sub-fields.
--
-- Pairs with supabase/migrations/2026-05-19-brand-voice-fields.sql
-- (same DDL — ADD COLUMN IF NOT EXISTS is idempotent).

alter table brands
  add column if not exists messaging   jsonb,
  add column if not exists terminology jsonb;

comment on column brands.messaging   is 'Structured messaging: { valuePropositions: string[] }';
comment on column brands.terminology is 'Structured terminology: { approved: string[], prohibited: string[] }';
