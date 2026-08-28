import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useHandoffBroadcast() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;

    // Create a secure, user-specific channel for handoff signals
    const channelName = `handoff-${user.id}`;
    const channel = supabase.channel(channelName);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Broadcast the active state whenever the route changes
        channel.send({
          type: "broadcast",
          event: "active_state",
          payload: {
            app: "Atlas IO",
            path: location.pathname,
            search: location.search,
            timestamp: new Date().toISOString(),
          },
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname, location.search]);
}
