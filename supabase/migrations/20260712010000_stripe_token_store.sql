-- Function: upsert_stripe_token
-- Called by the client when they link a Stripe integration.
-- Uses SECURITY DEFINER to write the token securely into the encrypted column.
CREATE OR REPLACE FUNCTION public.upsert_stripe_token(
  p_token TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label TEXT;
BEGIN
  -- Validate API key format roughly
  IF p_token IS NULL OR length(p_token) < 10 THEN
    RAISE EXCEPTION 'Invalid Stripe API token';
  END IF;

  -- Create a masked label (e.g. sk_test_...4a2b or sk_live_...1f9d)
  IF p_token LIKE 'sk_test_%' THEN
    v_label := 'Stripe Test (' || substring(p_token from length(p_token)-3 for 4) || ')';
  ELSIF p_token LIKE 'sk_live_%' THEN
    v_label := 'Stripe Live (' || substring(p_token from length(p_token)-3 for 4) || ')';
  ELSE
    v_label := 'Stripe Connected (' || substring(p_token from length(p_token)-3 for 4) || ')';
  END IF;

  INSERT INTO public.integrations (
    user_id,
    provider,
    status,
    external_account_label,
    access_token_encrypted,
    last_sync_at
  )
  VALUES (
    auth.uid(),
    'stripe',
    'active',
    v_label,
    p_token,
    now()
  )
  ON CONFLICT (user_id, provider)
  DO UPDATE SET
    access_token_encrypted = EXCLUDED.access_token_encrypted,
    external_account_label = EXCLUDED.external_account_label,
    status                 = 'active',
    last_sync_at           = now();
END;
$$;

-- Grant EXECUTE to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_stripe_token(TEXT) TO authenticated;

COMMENT ON FUNCTION public.upsert_stripe_token IS
  'Security-definer function that stores a Stripe API key in integrations.access_token_encrypted. '
  'Authenticated users can write their key via this function but cannot SELECT the column directly.';
