-- Add notion, slack, and google to the integration_provider enum
-- and ensure the (user_id, provider) unique constraint exists for upserts.

-- ── 1. Extend integration_provider enum ──────────────────────────────────────
-- ALTER TYPE ... ADD VALUE is not transactional in Postgres, but is safe here
-- because we use IF NOT EXISTS guards.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.integration_provider'::regtype
      AND enumlabel = 'notion'
  ) THEN
    ALTER TYPE public.integration_provider ADD VALUE 'notion';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.integration_provider'::regtype
      AND enumlabel = 'slack'
  ) THEN
    ALTER TYPE public.integration_provider ADD VALUE 'slack';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.integration_provider'::regtype
      AND enumlabel = 'google'
  ) THEN
    ALTER TYPE public.integration_provider ADD VALUE 'google';
  END IF;
END;
$$;

-- ── 2. Add (user_id, provider) unique constraint for upsert on conflict ───────
-- The base table only has UNIQUE(user_id, provider, external_account_id).
-- The oauth-callback upsert uses onConflict: "user_id,provider" which needs
-- a dedicated 2-column unique constraint.
ALTER TABLE public.integrations
  DROP CONSTRAINT IF EXISTS integrations_user_provider_unique;

ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_user_provider_unique UNIQUE (user_id, provider);

-- ── 3. Ensure token columns exist (safe no-ops if already present) ────────────
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scopes                  TEXT[];

-- ── 4. Ensure oauth_states table exists ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_token   TEXT NOT NULL UNIQUE,
  provider      TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS oauth_states_token_idx ON public.oauth_states (state_token);

COMMENT ON TABLE public.oauth_states IS
  'Short-lived CSRF state tokens used during OAuth 2.0 flows. '
  'Written by oauth-initiate Edge Function, consumed by oauth-callback Edge Function.';
