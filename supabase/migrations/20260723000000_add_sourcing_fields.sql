-- Add new columns for sourcing tool enhancement
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS draft_message TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS contact_channel TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS stale_data_warning BOOLEAN DEFAULT false;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS score_founder_active INT2 DEFAULT 0;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS score_buying_signal INT2 DEFAULT 0;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS score_icp_fit INT2 DEFAULT 0;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS score_reachable INT2 DEFAULT 0;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS score_atlas_relevance INT2 DEFAULT 0;
