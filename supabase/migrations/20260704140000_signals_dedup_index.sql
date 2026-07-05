-- Add unique index on signals to support upsert deduplication in sync-github edge function
-- Without this index, duplicate commit signals get inserted on every sync

CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_dedup
  ON public.signals (map_id, user_id, occurred_at, title)
  WHERE title IS NOT NULL;
