-- Create acquisition_runs table
CREATE TABLE IF NOT EXISTS public.acquisition_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    target INTEGER NOT NULL DEFAULT 20,
    contacted_count INTEGER NOT NULL DEFAULT 0,
    discovered_count INTEGER NOT NULL DEFAULT 0,
    qualified_count INTEGER NOT NULL DEFAULT 0,
    researched_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'idle',
    current_stage TEXT NOT NULL DEFAULT 'initializing',
    current_lead_id UUID,
    settings JSONB NOT NULL DEFAULT '{"target": 20, "min_icp": 70, "min_opportunity": 60, "human_approval": true, "email_enabled": true, "linkedin_enabled": true}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add new columns to kuro_pipeline_view
ALTER TABLE public.kuro_pipeline_view ADD COLUMN IF NOT EXISTS acquisition_run_id UUID REFERENCES public.acquisition_runs(id) ON DELETE SET NULL;
ALTER TABLE public.kuro_pipeline_view ADD COLUMN IF NOT EXISTS opportunity_score INTEGER;
ALTER TABLE public.kuro_pipeline_view ADD COLUMN IF NOT EXISTS outreach_draft TEXT;
ALTER TABLE public.kuro_pipeline_view ADD COLUMN IF NOT EXISTS research_data JSONB;

-- Set up RLS for acquisition_runs
ALTER TABLE public.acquisition_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own acquisition runs"
    ON public.acquisition_runs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own acquisition runs"
    ON public.acquisition_runs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own acquisition runs"
    ON public.acquisition_runs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own acquisition runs"
    ON public.acquisition_runs FOR DELETE
    USING (auth.uid() = user_id);

-- Create updated_at trigger for acquisition_runs
CREATE TRIGGER trg_acquisition_runs_updated
    BEFORE UPDATE ON public.acquisition_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
