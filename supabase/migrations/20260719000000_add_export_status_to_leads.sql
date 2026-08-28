-- Add export tracking columns to leads table
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS exported_to_notion BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exported_to_airtable BOOLEAN NOT NULL DEFAULT false;
