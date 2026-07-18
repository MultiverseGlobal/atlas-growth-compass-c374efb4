-- Rename leads table to pipeline_crm
ALTER TABLE IF EXISTS public.leads RENAME TO pipeline_crm;

-- Rename existing columns
ALTER TABLE public.pipeline_crm RENAME COLUMN company_name TO company;
ALTER TABLE public.pipeline_crm RENAME COLUMN founder_name TO prospect;
ALTER TABLE public.pipeline_crm RENAME COLUMN product_hunt_url TO source;

-- Add new columns
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS founder_thesis TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'Sourced';

-- Populate website and founder_thesis if there is any data
UPDATE public.pipeline_crm SET website = source WHERE website IS NULL;
UPDATE public.pipeline_crm SET founder_thesis = notes WHERE founder_thesis IS NULL;

-- If website is still null (e.g. if source was null), fallback
UPDATE public.pipeline_crm SET website = 'https://unknown.com' WHERE website IS NULL;
UPDATE public.pipeline_crm SET founder_thesis = 'No dominant constraint specified' WHERE founder_thesis IS NULL;

-- Delete any existing leads that do not meet the new strict requirements:
-- (founder name, company name, working source URL must not be null/empty, ICP score must be >= 10, dominant constraint must not be null)
DELETE FROM public.pipeline_crm 
WHERE prospect IS NULL 
   OR prospect = '' 
   OR company IS NULL 
   OR company = '' 
   OR website IS NULL 
   OR website = ''
   OR source IS NULL
   OR source = ''
   OR founder_thesis IS NULL
   OR founder_thesis = ''
   OR icp_score < 10
   OR icp_score IS NULL;

-- Drop retired columns
ALTER TABLE public.pipeline_crm DROP COLUMN IF EXISTS employee_count;
ALTER TABLE public.pipeline_crm DROP COLUMN IF EXISTS is_b2b_saas;
ALTER TABLE public.pipeline_crm DROP COLUMN IF EXISTS exported_to_airtable;

-- Set NOT NULL constraints
ALTER TABLE public.pipeline_crm ALTER COLUMN prospect SET NOT NULL;
ALTER TABLE public.pipeline_crm ALTER COLUMN company SET NOT NULL;
ALTER TABLE public.pipeline_crm ALTER COLUMN website SET NOT NULL;
ALTER TABLE public.pipeline_crm ALTER COLUMN founder_thesis SET NOT NULL;
ALTER TABLE public.pipeline_crm ALTER COLUMN source SET NOT NULL;
ALTER TABLE public.pipeline_crm ALTER COLUMN icp_score SET NOT NULL;

-- Rename indexes if they exist
ALTER INDEX IF EXISTS idx_leads_user_created RENAME TO idx_pipeline_crm_user_created;

-- Rename triggers if they exist
ALTER TRIGGER trg_leads_updated ON public.pipeline_crm RENAME TO trg_pipeline_crm_updated;

-- Re-grant permissions just in case
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_crm TO authenticated;
GRANT ALL ON public.pipeline_crm TO service_role;
