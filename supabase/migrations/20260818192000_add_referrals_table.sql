-- Create referrals table
CREATE TABLE IF NOT EXISTS public.atlas_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referrer_lead_id UUID REFERENCES public.kuro_pipeline_view(id) ON DELETE SET NULL,
    referred_company_name TEXT NOT NULL,
    referred_contact_name TEXT,
    referred_contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, contacted, converted, dead
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.atlas_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own referrals"
    ON public.atlas_referrals
    FOR ALL
    USING (auth.uid() = user_id);
