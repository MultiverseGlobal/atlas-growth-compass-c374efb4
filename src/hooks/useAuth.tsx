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
        await supabase.rpc("upsert_github_token", {
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
    });

    supabase.auth.getSession().then(({ data }) => {
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
