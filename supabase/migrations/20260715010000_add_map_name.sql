-- ============ ADD name COLUMN TO maps ============
-- Separates the user-defined display label from the AI goal statement.

ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS name TEXT;

-- Backfill existing rows: use up to 80 chars of goal_statement as the name
UPDATE public.maps SET name = LEFT(goal_statement, 80) WHERE name IS NULL OR name = '';

-- Make it NOT NULL with a sensible default going forward
ALTER TABLE public.maps ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.maps ALTER COLUMN name SET DEFAULT '';
