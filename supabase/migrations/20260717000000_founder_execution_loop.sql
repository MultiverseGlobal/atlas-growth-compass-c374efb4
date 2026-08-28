-- Create commitment_status enum if not exists
DO $$ BEGIN
  CREATE TYPE public.commitment_status AS ENUM ('committed', 'done', 'not_done');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create commitments table
CREATE TABLE IF NOT EXISTS public.commitments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id        UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  waypoint_id   UUID NOT NULL REFERENCES public.waypoints(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  status        public.commitment_status NOT NULL DEFAULT 'committed',
  note          TEXT,
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_map_date_commitment UNIQUE (map_id, date)
);

-- Index for querying commitments by map and date
CREATE INDEX IF NOT EXISTS idx_commitments_map_date ON public.commitments(map_id, date);
CREATE INDEX IF NOT EXISTS idx_commitments_user ON public.commitments(user_id);

-- Enable RLS for commitments
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;

-- Configure RLS policies for commitments
DO $$ BEGIN
  CREATE POLICY "users manage own commitments" ON public.commitments
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id      UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for chat messages timeline
CREATE INDEX IF NOT EXISTS idx_chat_messages_map ON public.chat_messages(map_id, created_at ASC);

-- Enable RLS for chat messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Configure RLS policies for chat messages
DO $$ BEGIN
  CREATE POLICY "users manage own chat messages" ON public.chat_messages
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commitments TO authenticated;
GRANT ALL ON public.commitments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

-- Setup timezone-aware daily commitments reminder cron via pg_cron (runs hourly)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('atlas-evening-reminder-cron')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'atlas-evening-reminder-cron'
);

SELECT cron.schedule(
  'atlas-evening-reminder-cron',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-evening-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    )
  $$
);
