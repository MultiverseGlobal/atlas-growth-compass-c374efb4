import { useState, useEffect } from "react";

export function useSovereignSync() {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const url = import.meta.env.VITE_METAPHOR_API_URL || "http://localhost:8000";
        const res = await fetch(`${url}/api/v1/system/active-context`);
        if (res.ok) {
          const data = await res.json();
          if (data.project_id) {
            setProjectId(data.project_id);
          }
        }
      } catch (e) {
        // Ignore fetch errors if Metaphor is offline
      }
    };

    fetchContext();
    const interval = setInterval(fetchContext, 3000);
    return () => clearInterval(interval);
  }, []);

  return { projectId };
}

