-- ============================================================
-- Atlas HQ v2 — Revenue OS Migration
-- Tables: atlas_deals, atlas_interactions, atlas_outreach, atlas_contacts
-- ============================================================

-- ── Deals (pipeline) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atlas_deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id      TEXT NOT NULL,  -- references pipeline_crm.id (text PK)
  company_name    TEXT NOT NULL,
  stage           TEXT NOT NULL DEFAULT 'contacted'
                    CHECK (stage IN ('contacted','interested','call_booked','proposal_sent','won','lost')),
  value           NUMERIC(12,2) NOT NULL DEFAULT 0,
  probability     INT NOT NULL DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
  currency        TEXT NOT NULL DEFAULT 'GBP',
  next_action     TEXT,
  next_action_due DATE,
  lost_reason     TEXT,
  won_at          TIMESTAMPTZ,
  lost_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atlas_deals_user    ON public.atlas_deals(user_id, updated_at DESC);
CREATE INDEX idx_atlas_deals_stage   ON public.atlas_deals(user_id, stage);
CREATE INDEX idx_atlas_deals_company ON public.atlas_deals(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atlas_deals TO authenticated;
GRANT ALL ON public.atlas_deals TO service_role;
ALTER TABLE public.atlas_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own deals" ON public.atlas_deals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_atlas_deals_updated BEFORE UPDATE ON public.atlas_deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── Interactions (activity timeline) ──────────────────────
CREATE TABLE IF NOT EXISTS public.atlas_interactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  TEXT NOT NULL,
  contact_id  UUID,
  type        TEXT NOT NULL DEFAULT 'note'
                CHECK (type IN ('email','linkedin','call','meeting','note')),
  direction   TEXT NOT NULL DEFAULT 'sent'
                CHECK (direction IN ('sent','received')),
  subject     TEXT,
  content     TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atlas_interactions_user    ON public.atlas_interactions(user_id, occurred_at DESC);
CREATE INDEX idx_atlas_interactions_company ON public.atlas_interactions(company_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atlas_interactions TO authenticated;
GRANT ALL ON public.atlas_interactions TO service_role;
ALTER TABLE public.atlas_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own interactions" ON public.atlas_interactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── Outreach messages ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atlas_outreach (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id      TEXT NOT NULL,
  contact_id      UUID,
  type            TEXT NOT NULL DEFAULT 'cold_email'
                    CHECK (type IN ('cold_email','linkedin','followup','call_script','loom')),
  subject         TEXT,
  body            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','opened','replied','booked','declined')),
  sent_at         TIMESTAMPTZ,
  follow_up_due   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atlas_outreach_user      ON public.atlas_outreach(user_id, created_at DESC);
CREATE INDEX idx_atlas_outreach_company   ON public.atlas_outreach(company_id);
CREATE INDEX idx_atlas_outreach_followup  ON public.atlas_outreach(user_id, follow_up_due) WHERE follow_up_due IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atlas_outreach TO authenticated;
GRANT ALL ON public.atlas_outreach TO service_role;
ALTER TABLE public.atlas_outreach ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own outreach" ON public.atlas_outreach
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_atlas_outreach_updated BEFORE UPDATE ON public.atlas_outreach
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── Contacts at companies ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atlas_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT,
  email       TEXT,
  linkedin    TEXT,
  phone       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atlas_contacts_user    ON public.atlas_contacts(user_id);
CREATE INDEX idx_atlas_contacts_company ON public.atlas_contacts(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atlas_contacts TO authenticated;
GRANT ALL ON public.atlas_contacts TO service_role;
ALTER TABLE public.atlas_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own contacts" ON public.atlas_contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── Revenue summary view ───────────────────────────────────
CREATE OR REPLACE VIEW public.atlas_revenue_summary AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE stage = 'won' AND won_at >= date_trunc('month', now()))          AS deals_won_this_month,
  COUNT(*) FILTER (WHERE stage = 'lost' AND lost_at >= date_trunc('month', now()))        AS deals_lost_this_month,
  COALESCE(SUM(value) FILTER (WHERE stage = 'won' AND won_at >= date_trunc('month', now())), 0) AS revenue_this_month,
  COALESCE(SUM(value * probability / 100.0) FILTER (WHERE stage NOT IN ('won','lost')), 0) AS pipeline_weighted,
  COALESCE(AVG(value) FILTER (WHERE stage = 'won'), 0)                                    AS avg_deal_size,
  COUNT(*) FILTER (WHERE stage NOT IN ('won','lost'))                                      AS active_deals
FROM public.atlas_deals
GROUP BY user_id;

GRANT SELECT ON public.atlas_revenue_summary TO authenticated;
