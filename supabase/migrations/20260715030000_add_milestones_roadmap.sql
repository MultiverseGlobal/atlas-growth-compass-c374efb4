-- Create milestone_status enum if not exists
DO $$ BEGIN
  CREATE TYPE public.milestone_status AS ENUM ('pending', 'active', 'complete', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create milestones table
CREATE TABLE IF NOT EXISTS public.milestones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id              UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  sequence            INT NOT NULL DEFAULT 0,
  status              public.milestone_status NOT NULL DEFAULT 'pending',
  estimated_start     DATE,
  estimated_complete  DATE,
  actual_complete_at  TIMESTAMPTZ,
  is_reforecast       BOOLEAN NOT NULL DEFAULT false,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for speed
CREATE INDEX IF NOT EXISTS idx_milestones_map ON public.milestones(map_id, sequence);

-- Extend waypoints to support milestone grouping
ALTER TABLE public.waypoints
  ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Configure RLS policies
DO $$ BEGIN
  CREATE POLICY "users manage own milestones" ON public.milestones
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.maps m WHERE m.id = milestones.map_id AND m.user_id = auth.uid()
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.maps m WHERE m.id = milestones.map_id AND m.user_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "published milestones visible" ON public.milestones
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.maps m WHERE m.id = milestones.map_id AND m.is_published = true
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.user_id AND p.page_visibility != 'private')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT SELECT ON public.milestones TO anon;
GRANT ALL ON public.milestones TO service_role;
