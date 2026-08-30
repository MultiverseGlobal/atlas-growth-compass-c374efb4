CREATE TABLE public.clario_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.clario_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clario_jobs"
    ON public.clario_jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clario_jobs"
    ON public.clario_jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clario_jobs"
    ON public.clario_jobs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clario_jobs"
    ON public.clario_jobs FOR DELETE
    USING (auth.uid() = user_id);
