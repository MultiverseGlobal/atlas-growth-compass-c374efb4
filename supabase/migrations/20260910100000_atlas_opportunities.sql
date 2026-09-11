CREATE TABLE IF NOT EXISTS public.atlas_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_url TEXT,
  fit_score INT NOT NULL DEFAULT 0,
  pain_signals JSONB DEFAULT '[]'::jsonb,
  buying_signals JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atlas_opps_user ON public.atlas_opportunities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_atlas_opps_score ON public.atlas_opportunities(fit_score DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atlas_opportunities TO authenticated;
GRANT ALL ON public.atlas_opportunities TO service_role;

ALTER TABLE public.atlas_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own opportunities" ON public.atlas_opportunities;
CREATE POLICY "users manage own opportunities" ON public.atlas_opportunities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_atlas_opps_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_atlas_opps_updated ON public.atlas_opportunities;
CREATE TRIGGER trg_atlas_opps_updated
  BEFORE UPDATE ON public.atlas_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_atlas_opps_updated_at();
