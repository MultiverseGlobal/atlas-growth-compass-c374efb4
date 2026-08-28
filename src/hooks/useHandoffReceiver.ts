import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useHandoffReceiver() {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<{
    app: string;
    path: string;
    search: string;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    const channelName = `handoff-${user.id}`;
    const channel = supabase.channel(channelName);

    channel.on("broadcast", { event: "active_state" }, (payload) => {
      // Ignore our own broadcasts
      if (payload.payload.app === "Atlas IO") return;

      console.log("Handoff received from Orion:", payload);
      setActiveSession(payload.payload);
    });

    // Make sure we only subscribe if we haven't already in this component
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { activeSession };
}
