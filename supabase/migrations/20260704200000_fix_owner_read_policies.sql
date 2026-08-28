-- Fix: authenticated users must always be able to read their OWN profile
-- regardless of page_visibility, and must be able to SELECT their own maps/waypoints.
-- The existing policies only cover public/unlisted reads for anon visitors.

-- ── PROFILES ────────────────────────────────────────────────────────────────
-- Drop existing select policy and re-create it so it covers:
--   a) any authenticated user reading their OWN row, OR
--   b) anyone reading a non-private profile (public page access)
DROP POLICY IF EXISTS "profiles readable by all for public pages" ON public.profiles;
CREATE POLICY "profiles select" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id                  -- owner always sees own profile
    OR page_visibility != 'private'  -- non-private visible to all
  );

-- Make sure the owner can always INSERT/UPDATE (should already exist but re-assert)
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ── MAPS ─────────────────────────────────────────────────────────────────────
-- Ensure authenticated owner can always read their own maps
-- (FOR ALL policy already exists; just make sure it's present)
DROP POLICY IF EXISTS "users manage own maps" ON public.maps;
CREATE POLICY "users manage own maps" ON public.maps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── WAYPOINTS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users manage own waypoints" ON public.waypoints;
CREATE POLICY "users manage own waypoints" ON public.waypoints
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── INTEGRATIONS ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users manage own integrations" ON public.integrations;
CREATE POLICY "users manage own integrations" ON public.integrations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
