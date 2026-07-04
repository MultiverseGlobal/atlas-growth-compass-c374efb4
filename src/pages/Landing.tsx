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
      <section className="container pt-24 pb-28">
        <div className="max-w-3xl">
          <Reveal>
            <h1 className="font-display text-5xl md:text-7xl leading-[0.98] tracking-tight">
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
      </section>

      {/* Example */}
      <section id="example" className="container border-t border-border py-24">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] items-start">
          <div>
            <Reveal>
              <div className="eyebrow text-primary">How it reads</div>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-3 font-display text-3xl md:text-4xl leading-tight">
                A route, not a dashboard.
              </h2>
            </Reveal>
          </div>

          <Reveal delay={120} className="rounded-[16px] border border-border bg-card p-8">
            <PreviewTrail />
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container border-t border-border py-24">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl leading-tight">Three steps.</h2>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { n: "01", t: "State the goal", d: "One sentence. No signup." },
            { n: "02", t: "Connect a source", d: "GitHub, Stripe, or Linear." },
            { n: "03", t: "Take the next move", d: "One move, every day." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 90} className="rounded-[14px] border border-border bg-card p-6 lift">
              <div className="font-mono text-xs text-primary">{s.n}</div>
              <h3 className="mt-3 font-display text-xl">{s.t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container border-t border-border py-24">
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
