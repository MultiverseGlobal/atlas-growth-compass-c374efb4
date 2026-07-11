import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Github, Target, Layers, Activity, Check } from "lucide-react";
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
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth?mode=signin"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/start"><Button size="sm">Start a map</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container pt-20 pb-20 relative overflow-hidden rounded-[24px] bg-grid-dots border border-border/40 mt-4">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center relative z-10">
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
          {/* Step 1 */}
          <Reveal delay={0} className="rounded-[16px] border border-border bg-card p-6 flex flex-col justify-between lift">
            <div>
              <div className="font-mono text-xs text-primary">01</div>
              <h3 className="mt-3 font-display text-xl font-semibold">State your active goal</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Write one sentence explaining what you are trying to achieve (e.g. 'Get first 10 customers').
              </p>
            </div>
            <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4 relative overflow-hidden">
              <div className="text-[9px] font-mono text-muted-foreground/55 uppercase tracking-wider mb-2">State Goal</div>
              <div className="h-8 rounded border border-primary/20 bg-background flex items-center px-3 text-xs text-foreground font-medium select-none">
                I want to get my first 10 customers
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-primary/70 animate-pulse" />
              </div>
            </div>
          </Reveal>

          {/* Step 2 */}
          <Reveal delay={90} className="rounded-[16px] border border-border bg-card p-6 flex flex-col justify-between lift">
            <div>
              <div className="font-mono text-xs text-primary">02</div>
              <h3 className="mt-3 font-display text-xl font-semibold">Link your developer signals</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Connect GitHub securely. Atlas reads read-only momentum signals like commit frequencies and velocity changes.
              </p>
            </div>
            <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-muted text-foreground">
                    <Github className="h-4 w-4" />
                  </div>
                  <div className="text-xs font-semibold">GitHub</div>
                </div>
                <span className="text-[10px] font-mono text-success border border-success/30 bg-success/10 px-2.5 py-0.5 rounded-full select-none">
                  Connected
                </span>
              </div>
            </div>
          </Reveal>

          {/* Step 3 */}
          <Reveal delay={180} className="rounded-[16px] border border-border bg-card p-6 flex flex-col justify-between lift">
            <div>
              <div className="font-mono text-xs text-primary">03</div>
              <h3 className="mt-3 font-display text-xl font-semibold">Get your move</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Receive a clear, actionable next step. Focus entirely on executing the current target.
              </p>
            </div>
            <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4">
              <div className="relative pl-6">
                <div className="absolute left-0 top-0.5">
                  <svg width="14" height="14" viewBox="0 0 22 22">
                    <circle cx="11" cy="11" r="8" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2.5" />
                    <circle cx="11" cy="11" r="4.5" fill="hsl(var(--foreground))" />
                  </svg>
                </div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-foreground">Next Move</div>
                <div className="text-xs font-medium text-foreground mt-0.5 leading-snug">
                  Pick one channel this week and post something concrete.
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section id="features" className="container border-t border-border py-16">
        <Reveal>
          <div className="eyebrow text-primary">Feature highlights</div>
          <h2 className="mt-3 font-display text-3xl md:text-4xl leading-tight">Built for focused shipping.</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-xl">
            Atlas strips away the vanity graphs, distilling noise into clear, next-step priorities.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {/* Feature 1 */}
          <Reveal delay={0} className="rounded-[16px] border border-border bg-card p-6 flex flex-col justify-between lift">
            <div>
              <div className="p-2 w-fit rounded-lg bg-primary/5 text-primary border border-primary/10">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">Confidence levels</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Pins fill dynamically based on evidence depth. Hollow pins indicate inferred state, half pins denote building signal, and solid pins verify established evidence.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-around bg-muted/20 p-4 rounded-lg border border-border">
              <div className="flex items-center gap-1.5 text-xs">
                <svg width="14" height="14" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" /></svg>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Starter</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <svg width="14" height="14" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" /><path d="M11 3 a 8 8 0 0 0 0 16 Z" fill="hsl(var(--primary))" /></svg>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Emerging</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <svg width="14" height="14" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" /><circle cx="11" cy="11" r="5" fill="hsl(var(--primary))" /></svg>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Established</span>
              </div>
            </div>
          </Reveal>

          {/* Feature 2 */}
          <Reveal delay={90} className="rounded-[16px] border border-border bg-card p-6 flex flex-col justify-between lift">
            <div>
              <div className="p-2 w-fit rounded-lg bg-primary/5 text-primary border border-primary/10">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">Daily update briefing</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Receive a daily context update card mapping tool changes to active goals. Know the exact health of your development loop without parsing logs.
              </p>
            </div>
            <div className="mt-6 bg-muted/20 p-4 rounded-lg border border-border">
              <div className="text-[9px] font-mono uppercase text-muted-foreground mb-1 select-none">Daily Briefing</div>
              <div className="text-xs font-semibold leading-snug text-foreground">
                Commit velocity dropped 30% — focus shifted to marketing.
              </div>
            </div>
          </Reveal>

          {/* Feature 3 */}
          <Reveal delay={180} className="rounded-[16px] border border-border bg-card p-6 flex flex-col justify-between lift">
            <div>
              <div className="p-2 w-fit rounded-lg bg-primary/5 text-primary border border-primary/10">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">Hybrid constraint engine</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Connects mathematical codebase flags directly with natural language diagnosis. Tells you what is happening and exactly how to respond.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between gap-2 bg-muted/20 p-3 rounded-lg border border-border font-mono text-[9px]">
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-2 py-1.5 rounded shrink-0">
                Flag: No Commits
              </div>
              <span className="text-muted-foreground select-none">→</span>
              <div className="bg-primary/10 border border-primary/20 text-primary px-2.5 py-1.5 rounded truncate text-right">
                Constraint: Outbound paused
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container border-t border-border py-16">
        <Reveal>
          <div className="eyebrow text-primary">Pricing</div>
          <h2 className="mt-3 font-display text-3xl md:text-4xl leading-tight">Simple pricing.</h2>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          <Reveal delay={80} className="h-full flex flex-col">
            <PriceCard
              name="Free"
              price="$0"
              lines={["1 active map", "Manual upload only", "Save and revisit"]}
              cta={<Link to="/start"><Button variant="outline" className="w-full">Start a map</Button></Link>}
            />
          </Reveal>
          <Reveal delay={170} className="h-full flex flex-col">
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

      {/* Final CTA Section */}
      <section className="container border-t border-border py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-dots opacity-20 pointer-events-none" />
        <div className="relative z-10 max-w-xl mx-auto">
          <Reveal>
            <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
              Start your map.
            </h2>
          </Reveal>
          <Reveal delay={90}>
            <p className="mt-4 text-muted-foreground text-sm">
              One sentence to state your goal. Atlas handles the diagnosis. No credit card required.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/start">
                <Button size="lg" className="h-12 px-8 text-base">
                  Start a map
                </Button>
              </Link>
            </div>
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
    <div className={`lift rounded-[16px] border p-7 flex flex-col justify-between h-full ${highlight ? "border-primary bg-card" : "border-border bg-card"}`}>
      <div>
        <div className="flex items-center justify-between">
          <div className="font-display text-2xl">{name}</div>
          {highlight && <LogoMark size={18} />}
        </div>
        <div className="mt-3 font-display text-4xl">{price}</div>
        <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
          {lines.map((l) => (
            <li key={l} className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-7">{cta}</div>
    </div>
  );
}
