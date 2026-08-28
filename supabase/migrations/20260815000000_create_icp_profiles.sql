-- Create icp_profiles table for autonomous sourcing & outreach pipeline
CREATE TABLE IF NOT EXISTS public.icp_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  industries TEXT[] DEFAULT '{}',
  stages TEXT[] DEFAULT '{}',
  headcount_min INT DEFAULT 1,
  headcount_max INT DEFAULT 500,
  geographies TEXT[] DEFAULT '{}',
  signals TEXT[] DEFAULT '{}',
  pain_points TEXT[] DEFAULT '{}',
  auto_send_threshold INT DEFAULT 70,
  cron_enabled BOOLEAN DEFAULT true,
  cron_time TEXT DEFAULT '07:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.icp_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users manage own icp_profiles" ON public.icp_profiles
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TRIGGER trg_icp_profiles_updated BEFORE UPDATE ON public.icp_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.icp_profiles TO authenticated;
GRANT ALL ON public.icp_profiles TO service_role;
