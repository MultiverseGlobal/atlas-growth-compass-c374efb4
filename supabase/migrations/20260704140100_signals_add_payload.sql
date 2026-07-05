-- Add payload column to signals table for storing structured metadata
-- (e.g. manual notes, commit SHA, PR number, raw GitHub data)
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;
