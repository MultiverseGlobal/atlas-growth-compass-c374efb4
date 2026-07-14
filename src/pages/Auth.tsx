import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/atlas/Logo";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { resolvePostAuthPath } from "@/lib/postAuthRedirect";
import { friendlyError } from "@/lib/errors";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signin" ? "signin" : "signup"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;

    let pendingNext: string | null = null;
    try {
      pendingNext = sessionStorage.getItem("atlas.auth.next");
    } catch (e) {
      console.warn(e);
    }

    if (pendingNext) {
      try {
        sessionStorage.removeItem("atlas.auth.next");
      } catch (e) {
        console.warn(e);
      }
      nav(pendingNext, { replace: true });
      return;
    }

    let cancelled = false;
    resolvePostAuthPath(user.id).then((path) => {
      if (!cancelled) nav(path, { replace: true });
    });
    return () => { cancelled = true; };
  }, [user, authLoading, nav]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        toast.success("Check your inbox to confirm your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      toast.error(friendlyError(err));
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error(friendlyError(err));
      setLoading(false);
    }
  };

  const handleGitHub = async () => {
    setLoading(true);
    try {
      // Pre-store destination so AuthCallback can route correctly after OAuth
      try { sessionStorage.setItem("atlas.auth.next", "/onboarding"); } catch {}
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          scopes: "read:user repo",
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error(friendlyError(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grain relative flex flex-col justify-between overflow-hidden">
      {/* Amber radial glow backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 15%, hsla(37,72%,62%,0.12) 0%, transparent 60%)" }} />

      <header className="container relative z-10 flex h-16 items-center justify-between border-b border-border/50 bg-background/30 backdrop-blur-md">
        <Link to="/"><Logo /></Link>
        <Link to="/" className="text-sm font-mono text-xs uppercase tracking-widest text-muted-foreground/60 hover:text-foreground">← Back</Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm rounded-[24px] border border-border/60 bg-card p-8 shadow-sm">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            {mode === "signup" ? "Create account." : "Welcome back."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signup" ? "Draw your first founder map." : "Sign in to your Atlas workspace."}
          </p>

          <div className="mt-8 flex flex-col gap-2.5">
            <Button onClick={handleGoogle} disabled={loading} variant="outline" className="w-full h-11 rounded-xl bg-background/40 hover:bg-muted/10 border-border/50 font-mono text-xs font-semibold gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" opacity=".85"/><path fill="currentColor" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.83Z" opacity=".7"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.2 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" opacity=".55"/></svg>
              Continue with Google
            </Button>
            <Button onClick={handleGitHub} disabled={loading} variant="outline" className="w-full h-11 rounded-xl bg-background/40 hover:bg-muted/10 border-border/50 font-mono text-xs font-semibold gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              Continue with GitHub
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 select-none">
            <div className="h-px flex-1 bg-border/40" /> or email <div className="h-px flex-1 bg-border/40" />
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground/80">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground/80">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-mono text-xs font-semibold gap-1 bg-foreground text-background hover:bg-foreground/90 mt-2">
              {mode === "signup" ? "Create account" : "Sign in"} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="mt-6 w-full text-center text-xs font-mono text-muted-foreground/80 hover:text-foreground transition-colors"
          >
            {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        </div>
      </main>

      <footer className="container py-6 text-center text-[11px] text-muted-foreground/60 border-t border-border/40 relative z-10 bg-background/20 backdrop-blur-sm">
        By continuing, you agree to our <Link to="/privacy" className="underline hover:text-foreground">Privacy & Terms</Link>.
      </footer>
    </div>
  );
}
