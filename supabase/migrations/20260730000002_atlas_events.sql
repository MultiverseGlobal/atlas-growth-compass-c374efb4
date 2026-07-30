-- ─────────────────────────────────────────────
-- Atlas HQ V3 Foundation: Event Log Table
-- Every action in the system writes here.
-- The Evidence Engine queries only this table.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.atlas_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id   UUID        REFERENCES public.pipeline_crm(id) ON DELETE SET NULL,
  deal_id      UUID        REFERENCES public.atlas_deals(id) ON DELETE SET NULL,
  event_type   TEXT        NOT NULL,
  metadata     JSONB,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source       TEXT        NOT NULL DEFAULT 'user'
  -- source: 'user' | 'system' | 'ai'
);

-- Indexes for Evidence Engine queries
CREATE INDEX IF NOT EXISTS idx_atlas_events_user       ON public.atlas_events(user_id);
CREATE INDEX IF NOT EXISTS idx_atlas_events_company    ON public.atlas_events(company_id);
CREATE INDEX IF NOT EXISTS idx_atlas_events_deal       ON public.atlas_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_atlas_events_type       ON public.atlas_events(event_type);
CREATE INDEX IF NOT EXISTS idx_atlas_events_occurred   ON public.atlas_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_atlas_events_user_type  ON public.atlas_events(user_id, event_type);

-- RLS
ALTER TABLE public.atlas_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.atlas_events TO authenticated;
GRANT ALL ON public.atlas_events TO service_role;

CREATE POLICY "users see own events" ON public.atlas_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own events" ON public.atlas_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Evidence Engine Views
-- Pre-built query patterns for V3.
-- These are empty until data accumulates.
-- ─────────────────────────────────────────────

-- Pain patterns: most frequently identified problems across all companies
CREATE OR REPLACE VIEW public.atlas_pain_patterns AS
SELECT
  user_id,
  metadata->>'problem'    AS problem,
  metadata->>'opportunity' AS opportunity,
  COUNT(*)                AS times_seen,
  AVG((metadata->>'confidence')::int) AS avg_confidence
FROM public.atlas_events
WHERE event_type = 'pain_analyzed'
  AND metadata->>'problem' IS NOT NULL
GROUP BY user_id, metadata->>'problem', metadata->>'opportunity'
ORDER BY times_seen DESC;

-- Deal outcomes by company industry/stage
CREATE OR REPLACE VIEW public.atlas_deal_outcomes AS
SELECT
  e.user_id,
  e.metadata->>'from_stage' AS from_stage,
  e.metadata->>'to_stage'   AS to_stage,
  e.metadata->>'reason'     AS lost_reason,
  COUNT(*)                   AS count,
  AVG((e.metadata->>'deal_value')::numeric) AS avg_value
FROM public.atlas_events e
WHERE e.event_type IN ('deal_won', 'deal_lost', 'deal_stage_changed')
GROUP BY e.user_id, from_stage, to_stage, lost_reason
ORDER BY count DESC;

-- Outreach performance: reply rate by outreach type
CREATE OR REPLACE VIEW public.atlas_outreach_performance AS
SELECT
  user_id,
  metadata->>'outreach_type' AS outreach_type,
  COUNT(*) FILTER (WHERE event_type = 'outreach_sent')    AS sent,
  COUNT(*) FILTER (WHERE event_type = 'outreach_replied') AS replied,
  ROUND(
    COUNT(*) FILTER (WHERE event_type = 'outreach_replied')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE event_type = 'outreach_sent'), 0) * 100, 1
  ) AS reply_rate_pct
FROM public.atlas_events
WHERE event_type IN ('outreach_sent', 'outreach_replied')
GROUP BY user_id, metadata->>'outreach_type';

-- Top objections extracted from calls/notes
CREATE OR REPLACE VIEW public.atlas_top_objections AS
SELECT
  user_id,
  jsonb_array_elements_text(metadata->'objections') AS objection,
  COUNT(*) AS times_raised
FROM public.atlas_events
WHERE event_type = 'call_completed'
  AND metadata->'objections' IS NOT NULL
GROUP BY user_id, objection
ORDER BY times_raised DESC;
