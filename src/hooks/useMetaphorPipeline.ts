import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const isProd = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
const METAPHOR_API = isProd ? "https://metaphor-backend.onrender.com/api/v1/pipeline" : "http://localhost:8000/api/v1/pipeline";

export type MetaphorBrief = {
  brief_id: string;
  generated_at: string;
  active_goals: string[];
  active_constraints: string[];
  open_decisions: string[];
  recommended_focus: string;
  node_count: number;
};

export function useMetaphorPipeline() {
  const [brief, setBrief] = useState<MetaphorBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBrief() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.user?.user_metadata?.metaphor_access_token;
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${METAPHOR_API}/brief`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setBrief(data);
        }
      } catch (err) {
        console.error("Failed to fetch Metaphor brief:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBrief();
  }, []);

  const pushStrategy = async (strategyData: { title: string, summary: string, content: string, target_id?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.user?.user_metadata?.metaphor_access_token;
    if (!token) return false;
    
    try {
      const res = await fetch(`${METAPHOR_API}/intake`, {
        method: "POST",
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: "atlas",
          type: "strategy",
          ...strategyData
        })
      });
      return res.ok;
    } catch (err) {
      console.error("Failed to push strategy to Metaphor:", err);
      return false;
    }
  };

  return { brief, loading, pushStrategy };
}
