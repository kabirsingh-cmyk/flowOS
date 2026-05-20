-- Brand voice extension: structured messaging + terminology fields
-- Read by api/chat.js buildBrandVoiceBlock (supervisor + drafter prompts).
-- Written by api/brand-import.js upsertBrand.
--
-- voice.attributes / voice.antiAttributes are added inside the existing
-- `voice` jsonb column — no schema change needed for those.

alter table brands
  add column if not exists messaging   jsonb,
  add column if not exists terminology jsonb;

comment on column brands.messaging   is 'Structured messaging: { valuePropositions: string[] }';
comment on column brands.terminology is 'Structured terminology: { approved: string[], prohibited: string[] }';
