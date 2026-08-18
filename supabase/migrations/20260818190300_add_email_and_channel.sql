-- Add email and acquisition_channel to kuro_pipeline_view
ALTER TABLE public.kuro_pipeline_view ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.kuro_pipeline_view ADD COLUMN IF NOT EXISTS acquisition_channel TEXT DEFAULT 'Outbound';
