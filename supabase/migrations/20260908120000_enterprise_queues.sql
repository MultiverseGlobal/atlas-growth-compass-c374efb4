-- ============================================================
-- ENTERPRISE QUEUES: Background Jobs + Proxy + Clario
-- ============================================================

-- 1. Background job queue for large sourcing runs
CREATE TABLE IF NOT EXISTS public.atlas_background_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'sourcing_run',  -- extensible
  payload     JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result      JSONB,
  error       TEXT,
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atlas_bg_jobs_user_status
  ON public.atlas_background_jobs(user_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.atlas_background_jobs TO authenticated;
GRANT ALL ON public.atlas_background_jobs TO service_role;

ALTER TABLE public.atlas_background_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own bg jobs" ON public.atlas_background_jobs;
CREATE POLICY "users manage own bg jobs" ON public.atlas_background_jobs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_atlas_bg_job_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_atlas_bg_job_updated ON public.atlas_background_jobs;
CREATE TRIGGER trg_atlas_bg_job_updated
  BEFORE UPDATE ON public.atlas_background_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_atlas_bg_job_updated_at();

-- 2. Add proxy fields to atlas_user_settings
ALTER TABLE public.atlas_user_settings
  ADD COLUMN IF NOT EXISTS proxy_url  TEXT,
  ADD COLUMN IF NOT EXISTS proxy_auth TEXT,  -- "user:pass" format
  ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
  ADD COLUMN IF NOT EXISTS sender_name TEXT DEFAULT 'Atlas',
  ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- 3. Clario integration on atlas_outreach
--    Drop old constraint, add clario fields, re-add wider constraint
ALTER TABLE public.atlas_outreach
  DROP CONSTRAINT IF EXISTS atlas_outreach_status_check;

-- Ensure existing data complies with the new constraint
UPDATE public.atlas_outreach
  SET status = 'draft'
  WHERE status NOT IN ('draft','approved','waiting_for_clario','manually_sent','auto_sent','replied','declined');

ALTER TABLE public.atlas_outreach
  ADD CONSTRAINT atlas_outreach_status_check
    CHECK (status IN ('draft','approved','waiting_for_clario','manually_sent','auto_sent','replied','declined'));

ALTER TABLE public.atlas_outreach
  ADD COLUMN IF NOT EXISTS clario_video_url   TEXT,
  ADD COLUMN IF NOT EXISTS clario_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_send_enabled  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resend_id          TEXT,
  ADD COLUMN IF NOT EXISTS to_email           TEXT,
  ADD COLUMN IF NOT EXISTS to_name            TEXT;
