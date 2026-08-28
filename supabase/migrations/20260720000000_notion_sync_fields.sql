-- Add settings column to integrations table
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Grant select and update permission on the settings column
GRANT SELECT (settings), UPDATE (settings) ON public.integrations TO authenticated;

-- Add notion sync status and info to leads table
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS notion_sync_status TEXT NOT NULL DEFAULT 'not_synced' CHECK (notion_sync_status IN ('not_synced', 'syncing', 'synced', 'failed')),
  ADD COLUMN IF NOT EXISTS notion_page_id TEXT,
  ADD COLUMN IF NOT EXISTS notion_sync_error TEXT;
