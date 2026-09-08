-- ============ ATLAS USER SETTINGS ============
CREATE TABLE IF NOT EXISTS public.atlas_user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  openai_api_key TEXT,
  apollo_api_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reset permissions just in case
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atlas_user_settings TO authenticated;
GRANT ALL ON public.atlas_user_settings TO service_role;

-- Enable RLS
ALTER TABLE public.atlas_user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to make script idempotent
DROP POLICY IF EXISTS "users manage own settings" ON public.atlas_user_settings;

CREATE POLICY "users manage own settings" ON public.atlas_user_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
