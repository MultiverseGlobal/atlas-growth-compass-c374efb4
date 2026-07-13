-- Migration: upsert_notion_token / upsert_slack_token / upsert_google_token
-- v1 "paste your token" integrations — no OAuth flow needed yet.

-- Notion
CREATE OR REPLACE FUNCTION public.upsert_notion_token(p_token TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_label TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 10 THEN RAISE EXCEPTION 'Invalid Notion token'; END IF;
  v_label := 'Notion (..'' || substring(p_token from length(p_token)-3 for 4) || '')';
  INSERT INTO public.integrations (user_id, provider, status, external_account_label, access_token_encrypted, last_sync_at)
  VALUES (auth.uid(), 'notion', 'active', v_label, p_token, now())
  ON CONFLICT (user_id, provider) DO UPDATE SET
    access_token_encrypted = EXCLUDED.access_token_encrypted,
    external_account_label = EXCLUDED.external_account_label,
    status = 'active', last_sync_at = now();
END; $$;
GRANT EXECUTE ON FUNCTION public.upsert_notion_token(TEXT) TO authenticated;

-- Slack
CREATE OR REPLACE FUNCTION public.upsert_slack_token(p_token TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_label TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 10 THEN RAISE EXCEPTION 'Invalid Slack token'; END IF;
  v_label := 'Slack (..' || substring(p_token from length(p_token)-3 for 4) || ')';
  INSERT INTO public.integrations (user_id, provider, status, external_account_label, access_token_encrypted, last_sync_at)
  VALUES (auth.uid(), 'slack', 'active', v_label, p_token, now())
  ON CONFLICT (user_id, provider) DO UPDATE SET
    access_token_encrypted = EXCLUDED.access_token_encrypted,
    external_account_label = EXCLUDED.external_account_label,
    status = 'active', last_sync_at = now();
END; $$;
GRANT EXECUTE ON FUNCTION public.upsert_slack_token(TEXT) TO authenticated;

-- Google Workspace
CREATE OR REPLACE FUNCTION public.upsert_google_token(p_token TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_label TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 10 THEN RAISE EXCEPTION 'Invalid Google token'; END IF;
  v_label := 'Google (..' || substring(p_token from length(p_token)-3 for 4) || ')';
  INSERT INTO public.integrations (user_id, provider, status, external_account_label, access_token_encrypted, last_sync_at)
  VALUES (auth.uid(), 'google', 'active', v_label, p_token, now())
  ON CONFLICT (user_id, provider) DO UPDATE SET
    access_token_encrypted = EXCLUDED.access_token_encrypted,
    external_account_label = EXCLUDED.external_account_label,
    status = 'active', last_sync_at = now();
END; $$;
GRANT EXECUTE ON FUNCTION public.upsert_google_token(TEXT) TO authenticated;
