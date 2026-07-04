import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

export type MapRow = {
  id: string;
  goal_statement: string;
  confidence: "starter" | "emerging" | "established";
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export function useMaps() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["maps", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("maps")
        .select("id, goal_statement, confidence, is_published, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MapRow[];
    },
    enabled: !!user,
  });

  const createMap = useMutation({
    mutationFn: async (goalStatement: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("maps")
        .insert({
          user_id: user.id,
          goal_statement: goalStatement,
          confidence: "starter",
          is_published: false,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maps", user?.id] });
      toast.success("Map created");
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });

  const claimStarterMap = useMutation({
    mutationFn: async (goalStatement: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("maps")
        .insert({
          user_id: user.id,
          goal_statement: goalStatement,
          confidence: "starter",
          is_published: false,
        })
        .select("id")
        .single();
      if (error) throw error;
      // Clear the anonymous localStorage starter map
      try {
        localStorage.removeItem("atlas.starter");
        localStorage.removeItem("atlas.setup");
      } catch {
        // non-critical
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maps", user?.id] });
      toast.success("Map saved to your account");
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });

  return { ...query, createMap, claimStarterMap };
}
