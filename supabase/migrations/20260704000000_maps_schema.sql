-- ============ ENUMS ============
CREATE TYPE public.map_confidence AS ENUM ('starter', 'emerging', 'established');
CREATE TYPE public.waypoint_kind AS ENUM ('goal', 'constraint', 'evidence', 'move');
CREATE TYPE public.user_plan AS ENUM ('free', 'atlas');

-- ============ PLAN COLUMN ON PROFILES ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan public.user_plan NOT NULL DEFAULT 'free';

-- ============ MAPS ============
CREATE TABLE public.maps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_statement TEXT NOT NULL,
  confidence    public.map_confidence NOT NULL DEFAULT 'starter',
  is_published  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_maps_user ON public.maps(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps TO authenticated;
GRANT SELECT ON public.maps TO anon;
GRANT ALL ON public.maps TO service_role;
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own maps" ON public.maps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "published maps visible to anon" ON public.maps
  FOR SELECT USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = maps.user_id AND p.page_visibility != 'private'
    )
  );
CREATE TRIGGER trg_maps_updated BEFORE UPDATE ON public.maps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ WAYPOINTS ============
CREATE TABLE public.waypoints (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id     UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       public.waypoint_kind NOT NULL,
  title      TEXT NOT NULL,
  confidence public.map_confidence NOT NULL DEFAULT 'starter',
  position   INT NOT NULL DEFAULT 0,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_waypoints_map ON public.waypoints(map_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waypoints TO authenticated;
GRANT ALL ON public.waypoints TO service_role;
ALTER TABLE public.waypoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own waypoints" ON public.waypoints
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Published waypoints follow map visibility
CREATE POLICY "published waypoints visible" ON public.waypoints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maps m WHERE m.id = waypoints.map_id AND m.is_published = true
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.user_id AND p.page_visibility != 'private')
    )
  );

-- ============ SOURCES (never publishable) ============
CREATE TABLE public.sources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id         UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,
  provider       public.integration_provider,
  label          TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sources_map ON public.sources(map_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
-- Sources are NEVER anon-readable
CREATE POLICY "users manage own sources" ON public.sources
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ SIGNALS (never publishable) ============
CREATE TABLE public.signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id      UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  score       INT NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_signals_map ON public.signals(map_id, occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
-- Signals are NEVER anon-readable
CREATE POLICY "users manage own signals" ON public.signals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ EVIDENCE ITEMS ============
CREATE TABLE public.evidence_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id      UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  waypoint_id UUID REFERENCES public.waypoints(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  source_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidence_map ON public.evidence_items(map_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_items TO authenticated;
GRANT ALL ON public.evidence_items TO service_role;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own evidence" ON public.evidence_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "published evidence visible" ON public.evidence_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maps m WHERE m.id = evidence_items.map_id AND m.is_published = true
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.user_id AND p.page_visibility != 'private')
    )
  );

-- ============ TIMELINE EVENTS ============
CREATE TABLE public.timeline_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id      UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_timeline_map ON public.timeline_events(map_id, occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeline_events TO authenticated;
GRANT ALL ON public.timeline_events TO service_role;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own timeline events" ON public.timeline_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "published timeline events visible" ON public.timeline_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maps m WHERE m.id = timeline_events.map_id AND m.is_published = true
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.user_id AND p.page_visibility != 'private')
    )
  );

-- ============ ACTIVE MAP COUNT HELPER ============
CREATE OR REPLACE FUNCTION public.active_map_count(_user_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.maps WHERE user_id = _user_id;
$$;
