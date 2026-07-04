import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo, LogoMark } from "@/components/atlas/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { resolvePostAuthPath } from "@/lib/postAuthRedirect";
import { Reveal, InView } from "@/components/atlas/Reveal";

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    resolvePostAuthPath(user.id).then((path) => {
      if (!cancelled) navigate(path, { replace: true });
    });
    return () => { cancelled = true; };
  }, [user, loading, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background page-fade">
      <header
        className={`sticky top-0 z-40 border-b transition-colors duration-200 ${
          scrolled ? "nav-solid border-border" : "border-transparent bg-background/0"
        }`}
      >
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/start"><Button size="sm">Start a map</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container pt-20 pb-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div>
            <Reveal>
              <h1 className="font-display text-5xl md:text-7.5xl leading-[0.98] tracking-tight">
                See what's next.
              </h1>
            </Reveal>
            <Reveal delay={90}>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                GitHub, Stripe, and Linear activity → one map, one constraint, one next move.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link to="/start">
                  <Button size="lg" className="h-12 px-6 text-base">
                    Start a map <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <span className="text-sm text-muted-foreground">One sentence. No signup.</span>
              </div>
            </Reveal>
          </div>
          <Reveal delay={240} className="rounded-[20px] border border-border bg-card p-7 shadow-sm">
            <PreviewTrail />
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container border-t border-border py-16">
        <Reveal>
          <div className="eyebrow text-primary">How it works</div>
          <h2 className="mt-3 font-display text-3xl md:text-4xl leading-tight">A route, not a dashboard.</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-xl">
            Atlas connects to your real tools to diagnose what's actually slowing you down.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "State your active goal",
              d: "Draw a map by writing one sentence explaining what you are trying to hit (e.g. 'Get first 10 customers' or 'Raise seed round')."
            },
            {
              n: "02",
              t: "Link your developer signals",
              d: "Connect GitHub securely. Atlas reads read-only momentum signals like commit frequencies and velocity changes — never your raw code."
            },
            {
              n: "03",
              t: "Act on the active blocker",
              d: "Our goal-aware engine isolates the single constraint blocking progress, provides verified evidence, and gives one concrete move."
            },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 90} className="rounded-[16px] border border-border bg-card p-6 lift">
              <div className="font-mono text-xs text-primary">{s.n}</div>
              <h3 className="mt-3 font-display text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container border-t border-border py-16">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl leading-tight">Simple pricing.</h2>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2 max-w-4xl">
          <Reveal delay={80}>
            <PriceCard
              name="Free"
              price="$0"
              lines={["1 active map", "Manual upload only", "Save and revisit"]}
              cta={<Link to="/start"><Button variant="outline" className="w-full">Start a map</Button></Link>}
            />
          </Reveal>
          <Reveal delay={170}>
            <PriceCard
              name="Atlas"
              price="$15/mo"
              highlight
              lines={["Unlimited maps", "All integrations", "Daily update card", "Public page + reports"]}
              cta={<Link to="/auth"><Button className="w-full">Start free — upgrade anytime</Button></Link>}
            />
          </Reveal>
        </div>
      </section>

      <footer className="container border-t border-border py-10 flex items-center justify-between text-sm text-muted-foreground">
        <Logo />
        <div className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-foreground hover:underline">Privacy & Terms</Link>
          <span>© 2026 Atlas</span>
        </div>
      </footer>
    </div>
  );
}

function PreviewTrail() {
  const items = [
    { type: "goal", label: "Goal", title: "Get my first 10 customers for Calrio", fill: "solid" as const, color: "hsl(var(--primary))" },
    { type: "constraint", label: "Likely constraint", title: "No repeatable way people find out about it yet.", fill: "outline" as const, color: "hsl(var(--destructive))" },
    { type: "evidence", label: "Evidence to gather", title: "Traffic sources and any launch surface.", fill: "outline" as const, color: "hsl(var(--source))" },
    { type: "move", label: "Next move", title: "Pick one channel this week and post something concrete.", fill: "solid" as const, color: "hsl(var(--foreground))" },
  ];
  return (
    <InView>
      {(inView, ref) => (
        <div ref={ref as never} className="relative pl-8">
          {inView && (
            <div aria-hidden className="trail-line trail-draw absolute left-[10px] top-2 bottom-2" />
          )}
          <ol className="space-y-8">
            {items.map((it, i) => (
              <li
                key={i}
                className={`relative ${inView ? "waypoint-rise" : "opacity-0"}`}
                style={inView ? { animationDelay: `${0.5 + i * 0.35}s` } : undefined}
              >
                <div className="absolute -left-8 top-0.5">
                  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" fill="hsl(var(--card))" stroke={it.color} strokeWidth="1.75" />
                    {it.fill === "solid" && <circle cx="11" cy="11" r="4.5" fill={it.color} />}
                  </svg>
                </div>
                <div className="eyebrow text-muted-foreground">{it.label}</div>
                <div className="mt-1.5 font-display text-lg leading-snug text-foreground">{it.title}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </InView>
  );
}

function PriceCard({
  name, price, lines, cta, highlight,
}: {
  name: string; price: string; lines: string[]; cta: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className={`lift rounded-[16px] border p-7 ${highlight ? "border-primary bg-card" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between">
        <div className="font-display text-2xl">{name}</div>
        {highlight && <LogoMark size={18} />}
      </div>
      <div className="mt-3 font-display text-4xl">{price}</div>
      <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
        {lines.map((l) => <li key={l}>· {l}</li>)}
      </ul>
      <div className="mt-7">{cta}</div>
    </div>
  );
}
