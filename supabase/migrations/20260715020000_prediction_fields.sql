-- Create custom enum types for waypoint predictions
DO $$ BEGIN
  CREATE TYPE public.predicted_direction AS ENUM ('up', 'down', 'flat');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.prediction_status AS ENUM ('pending', 'held', 'missed', 'unclear');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns for predictions to waypoints table (move kind only)
ALTER TABLE public.waypoints
  ADD COLUMN IF NOT EXISTS predicted_signal TEXT,
  ADD COLUMN IF NOT EXISTS predicted_direction public.predicted_direction,
  ADD COLUMN IF NOT EXISTS predicted_baseline_value TEXT,
  ADD COLUMN IF NOT EXISTS check_back_date DATE,
  ADD COLUMN IF NOT EXISTS result_status public.prediction_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS result_summary TEXT;
