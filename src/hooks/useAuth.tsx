import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = { user: User | null; session: Session | null; loading: boolean; signOut: () => Promise<void> };
const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncToken = async (s: Session | null) => {
      if (!s?.provider_token) return;
      const provider = s.user?.app_metadata?.provider;
      if (provider === "github") {
        await (supabase as any).rpc("upsert_github_token", {
          p_token: s.provider_token,
          p_scopes: "read:user repo",
          p_expires_at: s.expires_at ? new Date(s.expires_at * 1000).toISOString() : null,
        });
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s) syncToken(s);

      // When returning from a linkIdentity or OAuth flow, Supabase may redirect
      // to the site URL (not /auth/callback) — especially for existing-session link flows.
      // Check sessionStorage for a pending destination and navigate there immediately.
      if ((_e === "SIGNED_IN" || _e === "USER_UPDATED") && s) {
        try {
          const pendingNext = sessionStorage.getItem("atlas.auth.next");
          if (pendingNext && !window.location.pathname.includes("/auth/callback")) {
            sessionStorage.removeItem("atlas.auth.next");
            // Use replace so the OAuth redirect page isn't in browser history
            window.location.replace(pendingNext);
            return;
          }
        } catch (e) {
          console.warn("[useAuth] sessionStorage read failed", e);
        }
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      // If returning from an OAuth flow, let onAuthStateChange handle the state update
      // to prevent resolving loading=false with null before the token is parsed.
      const hasHash = window.location.hash.includes("access_token=") || window.location.hash.includes("error=");
      const hasCode = window.location.search.includes("code=");
      if (hasHash || hasCode) return;

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session) syncToken(data.session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{ user, session, loading, signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </Ctx.Provider>
  );
}
export const useAuth = () => useContext(Ctx);
