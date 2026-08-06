-- Fix 3: Add 'metaphor' to the integration_provider enum in Atlas's Supabase database.
-- Run this in the Supabase SQL editor for the Atlas project.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.integration_provider'::regtype
      AND enumlabel = 'metaphor'
  ) THEN
    ALTER TYPE public.integration_provider ADD VALUE 'metaphor';
  END IF;
END;
$$;
