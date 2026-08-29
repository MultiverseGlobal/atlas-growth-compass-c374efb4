-- Create metaphor_drafts table
CREATE TABLE IF NOT EXISTS public.metaphor_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Draft',
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Set up RLS
ALTER TABLE public.metaphor_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own drafts"
    ON public.metaphor_drafts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts"
    ON public.metaphor_drafts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
    ON public.metaphor_drafts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
    ON public.metaphor_drafts FOR DELETE
    USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER trg_metaphor_drafts_updated
    BEFORE UPDATE ON public.metaphor_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Update pipeline_crm if it's missing any fields needed by HqICP
-- HqICP expects: source, company, website, industry, location, team_size, icp_score, rating, founder, bottleneck, pitch, status
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS team_size TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS rating TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS bottleneck_area TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS bottleneck_observation TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS bottleneck_hypothesis TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS pitch_linkedin_dm TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS pitch_email_subject TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS pitch_email_body TEXT;
ALTER TABLE public.pipeline_crm ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_decision';
