-- Fix RLS policies to allow SELECT reads for profiles, maps, waypoints, and reports when page_visibility is 'unlisted'
-- (otherwise 'unlisted' behaved exactly like 'private' for anonymous visitors)

-- 1. Profiles policy
DROP POLICY IF EXISTS "profiles readable by all for public pages" ON public.profiles;
CREATE POLICY "profiles readable by all for public pages" ON public.profiles
  FOR SELECT USING (page_visibility != 'private');

-- 2. Maps policy
DROP POLICY IF EXISTS "published maps visible to anon" ON public.maps;
CREATE POLICY "published maps visible to anon" ON public.maps
  FOR SELECT USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = maps.user_id AND p.page_visibility != 'private'
    )
  );

-- 3. Waypoints policy
DROP POLICY IF EXISTS "published waypoints visible" ON public.waypoints;
CREATE POLICY "published waypoints visible" ON public.waypoints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maps m WHERE m.id = waypoints.map_id AND m.is_published = true
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.user_id AND p.page_visibility != 'private')
    )
  );

-- 4. Reports policy
DROP POLICY IF EXISTS "public reports visible to anyone" ON public.reports;
CREATE POLICY "public reports visible to anyone" ON public.reports
  FOR SELECT USING (
    published = true AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = reports.user_id AND p.page_visibility != 'private'
    )
  );

-- 5. Evidence items policy
DROP POLICY IF EXISTS "published evidence visible" ON public.evidence_items;
CREATE POLICY "published evidence visible" ON public.evidence_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maps m WHERE m.id = evidence_items.map_id AND m.is_published = true
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.user_id AND p.page_visibility != 'private')
    )
  );

-- 6. Timeline events policy
DROP POLICY IF EXISTS "published timeline events visible" ON public.timeline_events;
CREATE POLICY "published timeline events visible" ON public.timeline_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maps m WHERE m.id = timeline_events.map_id AND m.is_published = true
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.user_id AND p.page_visibility != 'private')
    )
  );

