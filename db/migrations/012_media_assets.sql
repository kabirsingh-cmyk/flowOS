-- 012_media_assets — Durable image/video storage bucket + asset registry.
--
-- Wired in:
--   api/generate.js  rehost() uploads to tenant-media and inserts a row here.
--
-- The bucket is public — objects are readable by anyone who knows the path.
-- Service-role key is used for writes; no anon write policy.

-- Create the storage bucket (idempotent).
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-media', 'tenant-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow service-role to insert objects — guard against duplicate policy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'service_role_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "service_role_insert"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'tenant-media')
    $policy$;
  END IF;
END;
$$;

-- media_assets — registry of re-hosted assets per tenant.
CREATE TABLE IF NOT EXISTS public.media_assets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     text        NOT NULL,
  job_id        text        NOT NULL,          -- generation_jobs.id or provider_job_id
  storage_path  text        NOT NULL,          -- {tenantId}/{jobId}.{ext}
  storage_url   text        NOT NULL,          -- full public URL
  provider      text        NOT NULL,          -- original provider (runware, replicate, …)
  asset_type    text        NOT NULL DEFAULT 'image',  -- 'image' | 'video'
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_job_id_idx
  ON public.media_assets (tenant_id, job_id);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'media_assets'
      AND policyname = 'tenant_isolation_select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "tenant_isolation_select" ON public.media_assets
        FOR SELECT USING (tenant_id = auth.uid()::text)
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'media_assets'
      AND policyname = 'tenant_isolation_modify'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "tenant_isolation_modify" ON public.media_assets
        FOR ALL USING (tenant_id = auth.uid()::text)
              WITH CHECK (tenant_id = auth.uid()::text)
    $policy$;
  END IF;
END;
$$;
