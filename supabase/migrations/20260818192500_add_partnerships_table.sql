-- Create partnerships table
CREATE TABLE IF NOT EXISTS public.atlas_partnerships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    partner_name TEXT NOT NULL,
    partner_company TEXT,
    partner_email TEXT,
    partner_type TEXT NOT NULL DEFAULT 'agency', -- agency, vc, fractional, other
    commission_rate DECIMAL(5,2) DEFAULT 10.00,
    status TEXT NOT NULL DEFAULT 'active', -- active, inactive
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.atlas_partnerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own partnerships"
    ON public.atlas_partnerships
    FOR ALL
    USING (auth.uid() = user_id);

-- Add partnership_id to pipeline to track attributed leads
ALTER TABLE public.kuro_pipeline_view ADD COLUMN IF NOT EXISTS partnership_id UUID REFERENCES public.atlas_partnerships(id) ON DELETE SET NULL;
