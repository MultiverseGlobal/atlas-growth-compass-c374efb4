-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL,
  founder_name      TEXT,
  linkedin_url      TEXT,
  twitter_url       TEXT,
  employee_count    INT,
  is_b2b_saas       BOOLEAN NOT NULL DEFAULT true,
  icp_score         INT,
  is_contacted      BOOLEAN NOT NULL DEFAULT false,
  reply_status      TEXT NOT NULL DEFAULT 'none' CHECK (reply_status IN ('none', 'pending', 'replied', 'ignored')),
  product_hunt_url  TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for searching and sorting leads
CREATE INDEX IF NOT EXISTS idx_leads_user_created ON public.leads(user_id, created_at DESC);

-- Enable RLS for leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Configure RLS policies for leads
DO $$ BEGIN
  CREATE POLICY "users manage own leads" ON public.leads
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enable updated_at auto-updating trigger
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
