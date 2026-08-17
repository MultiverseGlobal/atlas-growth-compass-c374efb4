-- ============================================================
-- ATLAS IO — CRM & OUTREACH TABLES
-- Creates the core pipeline + outreach tables the app relies on.
-- Run this in your Supabase SQL editor.
-- ============================================================

-- ─── 1. Main pipeline table (was previously a missing "view") ───────────────
CREATE TABLE IF NOT EXISTS public.kuro_pipeline_view (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Company & contact fields
  company               TEXT        NOT NULL,
  website               TEXT        NOT NULL DEFAULT '',
  prospect              TEXT        NOT NULL DEFAULT '',   -- founder full name
  linkedin_url          TEXT,
  twitter_url           TEXT,
  contact_channel       TEXT,                              -- 'email' | 'linkedin' | 'twitter'

  -- ICP scoring (0–100)
  icp_score             INTEGER     NOT NULL DEFAULT 0,
  score_icp_fit         INTEGER,
  score_buying_signal   INTEGER,
  score_founder_active  INTEGER,
  score_atlas_relevance INTEGER,
  score_reachable       INTEGER,

  -- Sourcing & AI analysis
  source                TEXT        NOT NULL DEFAULT 'manual',  -- 'hn' | 'ph' | 'github' | 'manual'
  founder_thesis        TEXT        NOT NULL DEFAULT '',        -- one-line bottleneck hypothesis
  goal                  TEXT,                                    -- their stated goal
  research_data         JSONB,                                   -- full raw research payload

  -- Outreach state
  stage                 TEXT        NOT NULL DEFAULT 'new',     -- 'new' | 'contacted' | 'replied' | 'booked' | 'closed' | 'dead'
  reply_status          TEXT        NOT NULL DEFAULT 'none',    -- 'none' | 'positive' | 'negative' | 'bounced'
  is_contacted          BOOLEAN     NOT NULL DEFAULT false,
  draft_message         TEXT,
  notes                 TEXT,
  next_action           TEXT,
  priority              TEXT        DEFAULT 'medium',           -- 'high' | 'medium' | 'low'

  -- Integrations
  is_hq_dump            BOOLEAN     NOT NULL DEFAULT false,
  exported_to_notion    BOOLEAN     NOT NULL DEFAULT false,
  notion_page_id        TEXT,
  notion_sync_status    TEXT        NOT NULL DEFAULT 'none',
  notion_sync_error     TEXT,
  stale_data_warning    BOOLEAN,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_user_id    ON public.kuro_pipeline_view(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage      ON public.kuro_pipeline_view(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_icp_score  ON public.kuro_pipeline_view(icp_score DESC);

-- RLS
ALTER TABLE public.kuro_pipeline_view ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own pipeline" ON public.kuro_pipeline_view
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kuro_pipeline_view TO authenticated;
GRANT ALL ON public.kuro_pipeline_view TO service_role;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_updated_at ON public.kuro_pipeline_view;
CREATE TRIGGER trg_pipeline_updated_at
  BEFORE UPDATE ON public.kuro_pipeline_view
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ─── 2. Outreach messages log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id         UUID        REFERENCES public.kuro_pipeline_view(id) ON DELETE SET NULL,

  -- Message content
  type            TEXT        NOT NULL DEFAULT 'cold_email', -- 'cold_email' | 'linkedin' | 'followup'
  subject         TEXT,
  body            TEXT        NOT NULL,
  to_email        TEXT,
  to_name         TEXT,
  company_name    TEXT,

  -- Delivery state
  status          TEXT        NOT NULL DEFAULT 'draft',      -- 'draft' | 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced'
  resend_id       TEXT,                                       -- Resend message ID for tracking
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  follow_up_due   TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_user_id  ON public.outreach_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_lead_id  ON public.outreach_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_status   ON public.outreach_messages(status);

ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own outreach" ON public.outreach_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_messages TO authenticated;
GRANT ALL ON public.outreach_messages TO service_role;

DROP TRIGGER IF EXISTS trg_outreach_updated_at ON public.outreach_messages;
CREATE TRIGGER trg_outreach_updated_at
  BEFORE UPDATE ON public.outreach_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ─── 3. User settings (Resend API key + sender identity) ────────────────────
CREATE TABLE IF NOT EXISTS public.atlas_settings (
  user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  resend_api_key  TEXT,
  sender_name     TEXT        DEFAULT 'Ben',
  sender_email    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.atlas_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own settings" ON public.atlas_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.atlas_settings TO authenticated;
GRANT ALL ON public.atlas_settings TO service_role;
