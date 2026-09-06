-- ==============================================================================
-- PSEUDONYMS ATLAS V1 — CANONICAL DATABASE SCHEMA
-- Migration: 20260907000000_atlas_v1_vertical_slice.sql
-- ==============================================================================

-- 1. OBJECTIVES (Founder Commercial Intent)
CREATE TABLE IF NOT EXISTS public.atlas_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_summary TEXT NOT NULL,
  target_hypothesis TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ICP PROFILES (Version Numbers Represent Approved Versions)
CREATE TABLE IF NOT EXISTS public.atlas_icp_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES public.atlas_objectives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INT, -- NULL when status = 'draft'; 1, 2, 3... when approved
  title TEXT NOT NULL,
  buyer_persona JSONB NOT NULL DEFAULT '{"role": "Managing Director / Founder", "seniority": "Executive"}',
  target_geography TEXT[] NOT NULL DEFAULT ARRAY['US', 'UK'],
  employee_range_min INT NOT NULL DEFAULT 5,
  employee_range_max INT NOT NULL DEFAULT 30,
  industry_keywords TEXT[] NOT NULL DEFAULT ARRAY['digital agency', 'web agency', 'design studio', 'marketing agency'],
  pain_signals TEXT[] NOT NULL DEFAULT ARRAY['delivery overhead', 'retainer management chaos', 'automation hiring'],
  buying_signals TEXT[] NOT NULL DEFAULT ARRAY['scaling operations', 'tech stack adoption'],
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ACQUISITION RUNS (Batch Jobs Storing Frozen ICP Snapshot)
CREATE TABLE IF NOT EXISTS public.atlas_acquisition_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icp_profile_id UUID NOT NULL REFERENCES public.atlas_icp_profiles(id) ON DELETE RESTRICT,
  icp_version_snapshot INT NOT NULL,
  icp_snapshot JSONB NOT NULL, -- Frozen copy of the exact approved search thesis
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_connector TEXT NOT NULL DEFAULT 'controlled_agency_feed',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  items_discovered INT NOT NULL DEFAULT 0,
  items_qualified INT NOT NULL DEFAULT 0,
  run_telemetry JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. OPPORTUNITIES (Evaluated Organizations with Transparent Fit Score)
CREATE TABLE IF NOT EXISTS public.atlas_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.atlas_acquisition_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  primary_domain TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'Digital Agency',
  employee_count_est INT,
  country TEXT,
  pipeline_stage TEXT NOT NULL DEFAULT 'discovered' 
    CHECK (pipeline_stage IN ('discovered', 'qualified', 'outreach_ready', 'contacted', 'engaged', 'closed_won', 'closed_lost', 'disqualified')),
  fit_score INT NOT NULL DEFAULT 0 CHECK (fit_score BETWEEN 0 AND 100),
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_action_recommendation TEXT,
  next_action_due_at TIMESTAMPTZ,
  deal_value_usd NUMERIC,
  deal_closed_at TIMESTAMPTZ,
  deal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_atlas_org_domain UNIQUE (user_id, primary_domain)
);

-- 5. EVIDENCE (Truly Immutable Append-Only Grounded Signals)
CREATE TABLE IF NOT EXISTS public.atlas_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.atlas_opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('employee_fit', 'geo_fit', 'industry_fit', 'pain_signal', 'buying_signal', 'decision_maker')),
  raw_snippet TEXT NOT NULL,
  source_url TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable Evidence Trigger: Hard block on UPDATE or DELETE
CREATE OR REPLACE FUNCTION public.trg_fn_prevent_evidence_mutation() 
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'atlas_evidence records are strictly append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_evidence_mutation ON public.atlas_evidence;
CREATE TRIGGER trg_prevent_evidence_mutation 
  BEFORE UPDATE OR DELETE ON public.atlas_evidence
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_prevent_evidence_mutation();

-- 6. CONTACTS (Decision Makers with Rigorous Provenance Tier)
CREATE TABLE IF NOT EXISTS public.atlas_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.atlas_opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  email TEXT,
  linkedin_url TEXT,
  verification_tier TEXT NOT NULL DEFAULT 'email_discovered'
    CHECK (verification_tier IN ('email_discovered', 'email_domain_valid', 'email_verified', 'person_email_verified', 'user_provided')),
  provenance_source TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. OUTREACH (Human-Approved Pitch Copy for Manual Send)
CREATE TABLE IF NOT EXISTS public.atlas_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.atlas_opportunities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.atlas_contacts(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'linkedin')),
  draft_subject TEXT NOT NULL,
  draft_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'manually_sent', 'replied', 'declined')),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  manual_send_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. FOLLOWUPS (Deterministic Next Best Actions)
CREATE TABLE IF NOT EXISTS public.atlas_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_id UUID NOT NULL REFERENCES public.atlas_outreach(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  action_strategy TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. ROW LEVEL SECURITY (Tenant Isolation)
ALTER TABLE public.atlas_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_icp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_acquisition_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation_objectives" ON public.atlas_objectives FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_icp" ON public.atlas_icp_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_runs" ON public.atlas_acquisition_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_opps" ON public.atlas_opportunities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_evidence" ON public.atlas_evidence FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_contacts" ON public.atlas_contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_outreach" ON public.atlas_outreach FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_followups" ON public.atlas_followups FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. ONE-WAY COMPATIBILITY READ ADAPTER (Read-Only Projection for Legacy Consumers)
CREATE OR REPLACE VIEW public.legacy_kuro_sync 
WITH (security_invoker = true) AS
  SELECT 
    id,
    user_id,
    organization_name AS company_name,
    primary_domain AS domain,
    pipeline_stage AS status,
    fit_score AS score,
    created_at
  FROM public.atlas_opportunities;

-- Explicitly block all writes through the compatibility view
REVOKE INSERT, UPDATE, DELETE ON public.legacy_kuro_sync FROM authenticated, anon, public;
