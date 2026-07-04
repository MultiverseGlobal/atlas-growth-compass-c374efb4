
CREATE EXTENSION IF NOT EXISTS citext;

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.integration_provider AS ENUM ('github', 'stripe', 'linear', 'posthog');
CREATE TYPE public.integration_status AS ENUM ('active', 'error', 'disconnected', 'syncing');
CREATE TYPE public.event_type AS ENUM (
  'gh_pr_merged','gh_release','gh_deploy','gh_repo_created','gh_readme_milestone',
  'stripe_new_customer','stripe_first_dollar','stripe_mrr_milestone','stripe_churn_saved','stripe_refund',
  'linear_cycle_completed','linear_issue_closed','linear_project_shipped','linear_milestone',
  'posthog_wau_milestone','posthog_feature_adoption','posthog_retention_milestone','posthog_funnel_improvement',
  'manual_note'
);
CREATE TYPE public.report_type AS ENUM ('weekly','investor','launch_post');
CREATE TYPE public.page_visibility AS ENUM ('public','unlisted','private');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle CITEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  page_visibility public.page_visibility NOT NULL DEFAULT 'unlisted',
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by all for public pages" ON public.profiles
  FOR SELECT USING (page_visibility = 'public' OR auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- ============ INTEGRATIONS ============
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  external_account_id TEXT,
  external_account_label TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  status public.integration_status NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, external_account_id)
);
CREATE INDEX idx_integrations_user ON public.integrations(user_id);
GRANT INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
GRANT SELECT (id, user_id, provider, external_account_id, external_account_label, scopes, status, last_sync_at, last_error, token_expires_at, created_at, updated_at)
  ON public.integrations TO authenticated;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own integrations" ON public.integrations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ SYNC RUNS ============
CREATE TABLE public.sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  events_ingested INT NOT NULL DEFAULT 0,
  error TEXT,
  kind TEXT NOT NULL DEFAULT 'poll'
);
CREATE INDEX idx_sync_runs_integration ON public.sync_runs(integration_id, started_at DESC);
GRANT SELECT ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own sync runs" ON public.sync_runs
  FOR SELECT USING (auth.uid() = user_id);

-- ============ EVENTS ============
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,
  provider public.integration_provider,
  event_type public.event_type NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  external_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  signal_score INT NOT NULL DEFAULT 0,
  is_high_signal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_events_provider_external ON public.events(provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_events_user_time ON public.events(user_id, occurred_at DESC);
CREATE INDEX idx_events_user_highsignal_time ON public.events(user_id, occurred_at DESC) WHERE is_high_signal = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own events" ON public.events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ EVENT METRICS ============
CREATE TABLE public.event_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_value_numeric NUMERIC,
  metric_value_text TEXT,
  metric_unit TEXT
);
CREATE INDEX idx_event_metrics_event ON public.event_metrics(event_id);
CREATE INDEX idx_event_metrics_user_key ON public.event_metrics(user_id, metric_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_metrics TO authenticated;
GRANT ALL ON public.event_metrics TO service_role;
ALTER TABLE public.event_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own metrics" ON public.event_metrics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ REPORTS ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.report_type NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  template_output_md TEXT NOT NULL,
  llm_output_md TEXT,
  validator_passed BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  og_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_user_time ON public.reports(user_id, period_end DESC);
CREATE INDEX idx_reports_published ON public.reports(user_id, published, period_end DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT SELECT ON public.reports TO anon;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own reports" ON public.reports
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public reports visible to anyone" ON public.reports
  FOR SELECT USING (
    published = true AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = reports.user_id AND p.page_visibility = 'public'
    )
  );

-- ============ REPORT ↔ EVENT LINKS ============
CREATE TABLE public.report_event_links (
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  citation_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (report_id, event_id)
);
GRANT SELECT, INSERT, DELETE ON public.report_event_links TO authenticated;
GRANT SELECT ON public.report_event_links TO anon;
GRANT ALL ON public.report_event_links TO service_role;
ALTER TABLE public.report_event_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "links follow report visibility" ON public.report_event_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_event_links.report_id
        AND (r.user_id = auth.uid()
             OR (r.published AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = r.user_id AND p.page_visibility = 'public')))
    )
  );
CREATE POLICY "users write own report links" ON public.report_event_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_event_links.report_id AND r.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_event_links.report_id AND r.user_id = auth.uid())
  );

-- ============ PUBLIC SNAPSHOTS ============
CREATE TABLE public.public_snapshots (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle CITEXT NOT NULL,
  snapshot JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_snapshots_handle ON public.public_snapshots(handle);
GRANT SELECT ON public.public_snapshots TO anon, authenticated;
GRANT ALL ON public.public_snapshots TO service_role;
ALTER TABLE public.public_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots visible when profile public" ON public.public_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = public_snapshots.user_id AND p.page_visibility = 'public')
  );

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ ACTIVITY LOGS ============
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_user ON public.activity_logs(user_id, created_at DESC);
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own activity" ON public.activity_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
          NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
