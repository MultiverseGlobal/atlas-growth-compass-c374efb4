import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useAcquisitionSimulator() {
  // Simulator removed. Acquisition runs are now processed by the dedicated backend Python worker.
  // The UI will naturally update via Supabase Realtime when the worker inserts into atlas_opportunities.
}
