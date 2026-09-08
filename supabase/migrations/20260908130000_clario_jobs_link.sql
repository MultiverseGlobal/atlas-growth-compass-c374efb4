-- ============================================================
-- CLARIO JOBS → ATLAS OUTREACH LINK
-- Adds outreach_id FK + video_url to clario_jobs so that
-- when Clario pushes a completed recording, a trigger
-- automatically propagates the URL to atlas_outreach.
-- ============================================================

-- 1. Extend clario_jobs with outreach link + video URL
ALTER TABLE public.clario_jobs
  ADD COLUMN IF NOT EXISTS outreach_id UUID REFERENCES public.atlas_outreach(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS video_url   TEXT;

CREATE INDEX IF NOT EXISTS idx_clario_jobs_outreach_id
  ON public.clario_jobs(outreach_id)
  WHERE outreach_id IS NOT NULL;

-- 2. Trigger function: when a clario_job gets a video_url,
--    auto-copy it to the linked atlas_outreach row.
CREATE OR REPLACE FUNCTION public.fn_clario_job_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only act when video_url transitions from NULL to a real value
  IF NEW.video_url IS NOT NULL AND (OLD.video_url IS NULL OR OLD.video_url <> NEW.video_url) THEN
    IF NEW.outreach_id IS NOT NULL THEN
      UPDATE public.atlas_outreach
        SET clario_video_url = NEW.video_url,
            updated_at       = now()
        WHERE id = NEW.outreach_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clario_job_complete ON public.clario_jobs;
CREATE TRIGGER trg_clario_job_complete
  AFTER UPDATE ON public.clario_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_clario_job_complete();

-- 3. Grant service_role INSERT/UPDATE on clario_jobs so the
--    queue-worker can create Clario job records server-side.
GRANT INSERT, UPDATE ON public.clario_jobs TO service_role;
