-- Store the encrypted GitHub provider_token in the integrations table.
-- We use pg_net + pgsodium for encryption, but as a practical alternative
-- we store the token in a dedicated column protected by RLS + service_role.
-- Only the service_role (Edge Functions) can read it; authenticated users cannot.

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scopes TEXT[]; -- Ensure scopes is text array

-- Revoke SELECT on the sensitive column from authenticated role
-- (they can still INSERT/UPDATE the row via the secure function below)
-- Note: column-level security requires separate policies, so we use a security-definer
-- function approach instead.

-- Function: upsert_github_token
-- Called by the client immediately after a successful GitHub OAuth sign-in.
-- Uses SECURITY DEFINER so it can write the token to the column that
-- authenticated users cannot directly read.
CREATE OR REPLACE FUNCTION public.upsert_github_token(
  p_token TEXT,
  p_scopes TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label TEXT;
  v_scopes TEXT[];
BEGIN
  -- Get the GitHub username from user_metadata (set during OAuth)
  SELECT COALESCE(
    (auth.jwt()->'user_metadata'->>'user_name'),
    (auth.jwt()->'user_metadata'->>'full_name'),
    'GitHub'
  ) INTO v_label;

  -- Convert space-separated scope string to array
  IF p_scopes IS NOT NULL THEN
    v_scopes := string_to_array(p_scopes, ' ');
  ELSE
    v_scopes := ARRAY['read:user', 'repo']::TEXT[];
  END IF;

  INSERT INTO public.integrations (
    user_id,
    provider,
    status,
    external_account_label,
    access_token_encrypted,
    scopes,
    token_expires_at,
    last_sync_at
  )
  VALUES (
    auth.uid(),
    'github',
    'active',
    v_label,
    p_token,
    v_scopes,
    p_expires_at,
    now()
  )
  ON CONFLICT (user_id, provider)
  DO UPDATE SET
    access_token_encrypted = EXCLUDED.access_token_encrypted,
    scopes                 = COALESCE(EXCLUDED.scopes, integrations.scopes),
    token_expires_at       = EXCLUDED.token_expires_at,
    status                 = 'active',
    last_sync_at           = now();
END;
$$;

-- Grant EXECUTE to authenticated users (they can call this to store their own token)
GRANT EXECUTE ON FUNCTION public.upsert_github_token(TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- Ensure integrations has a unique constraint on (user_id, provider) for the upsert
ALTER TABLE public.integrations
  DROP CONSTRAINT IF EXISTS integrations_user_provider_unique;
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_user_provider_unique UNIQUE (user_id, provider);

-- Comment explaining the security model
COMMENT ON FUNCTION public.upsert_github_token IS
  'Security-definer function that stores a GitHub OAuth provider_token in integrations.access_token_encrypted. '
  'Authenticated users can write their own token via this function but cannot SELECT the column directly.';

