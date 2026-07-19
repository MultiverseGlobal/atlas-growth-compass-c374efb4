-- Add is_hq_dump to pipeline_crm table
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS is_hq_dump BOOLEAN NOT NULL DEFAULT true;

-- Existing records are treated as graduated/already in CRM (set is_hq_dump = false)
UPDATE public.pipeline_crm SET is_hq_dump = false;
