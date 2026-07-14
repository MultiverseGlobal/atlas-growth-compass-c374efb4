-- Migration: OAuth state store for CSRF protection
-- Used by the oauth-initiate and oauth-callback Edge Functions

-- ── oauth_states table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_token   TEXT NOT NULL UNIQUE,
  provider      TEXT NOT NULL CHECK (provider IN ('notion', 'slack', 'google')),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the service role needs access (Edge Functions use service_role key)
-- Authenticated users never need to read/write this table directly
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- No RLS policies for authenticated — only service_role can access
-- (service_role bypasses RLS automatically)

-- Index for fast state lookup
CREATE INDEX IF NOT EXISTS oauth_states_token_idx ON public.oauth_states (state_token);

-- Auto-cleanup: delete expired states older than 1 hour to keep the table tiny.
-- This runs as a cron via pg_cron if available; otherwise it's handled on insert.
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.oauth_states WHERE expires_at < now() - interval '1 hour';
$$;

COMMENT ON TABLE public.oauth_states IS
  'Short-lived CSRF state tokens used during OAuth 2.0 flows for Notion, Slack, and Google. '
  'Written by oauth-initiate Edge Function, consumed (and deleted) by oauth-callback Edge Function.';

-- ── Add token_expires_at column if not already present ───────────────────────
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
