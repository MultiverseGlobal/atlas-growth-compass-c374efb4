-- Add research_data column to existing pipeline_crm table
ALTER TABLE public.pipeline_crm
  ADD COLUMN IF NOT EXISTS research_data JSONB;
