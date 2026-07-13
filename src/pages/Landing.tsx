import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Target, Layers, Activity, ChevronRight } from "lucide-react";
import { Logo, LogoMark } from "@/components/atlas/Logo";
import { useAuth } from "@/hooks/useAuth";
import { resolvePostAuthPath } from "@/lib/postAuthRedirect";
import { Reveal, InView } from "@/components/atlas/Reveal";

// ── Cycling words ──────────────────────────────────────────────────────────
const CYCLE_WORDS = ["constraint", "bottleneck", "next move", "blind spot"];

function useCyclingWord(words: string[], intervalMs = 2800) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setVisible(true);
      }, 280);
    }, intervalMs);
    return () => clearInterval(id);
  }, [words, intervalMs]);
  return { word: words[index], visible };
}

// ── Integration list ───────────────────────────────────────────────────────
const INTEGRATIONS = ["GitHub", "Stripe", "Linear", "Notion", "Slack", "Google Workspace"];

// ── Main ───────────────────────────────────────────────────────────────────
export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { word: cycleWord, visible: cycleVisible } = useCyclingWord(CYCLE_WORDS);

  useEffect(() => {
    if (loading || !user) return;
    try { if (sessionStorage.getItem("atlas.auth.next")) return; } catch {}
    let cancelled = false;
    resolvePostAuthPath(user.id).then((path) => {
      if (!cancelled) navigate(path, { replace: true });
    });
    return () => { cancelled = true; };
  }, [user, loading, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading) return <div className="min-h-screen" style={{ background: "#FAFAF8" }} />;

  return (
    <div className="min-h-screen page-fade" style={{ background: "#FAFAF8", color: "#1A1A18", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Nav */}
      <header style={{
        position: "fixed", inset: "0 0 auto 0", zIndex: 50,
        transition: "all 300ms",
        background: scrolled ? "rgba(255,255,255,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.07)" : "1px solid transparent",
        boxShadow: scrolled ? "0 1px 3px rgba(0,0,0,0.04)" : "none",
      }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 20px", display: "flex", height: 56, alignItems: "center", justifyContent: "space-between" }}>
          <Logo />
          <nav style={{ display: "flex", gap: 2, fontSize: 13, fontWeight: 500, color: "#666" }}>
            {[["#how","How it works"],["#sprint","Founder Sprint"],["#pricing","Pricing"]].map(([href, label]) => (
              <a key={href} href={href} style={{ padding: "8px 14px", borderRadius: 99, textDecoration: "none", color: "inherit", transition: "all 160ms" }}
                onMouseOver={e => { (e.target as HTMLElement).style.color = "#111"; (e.target as HTMLElement).style.background = "rgba(0,0,0,0.05)"; }}
                onMouseOut={e => { (e.target as HTMLElement).style.color = "#666"; (e.target as HTMLElement).style.background = "transparent"; }}>
                {label}
              </a>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link to="/auth?mode=signin" style={{ padding: "8px 14px", fontSize: 13, fontWeight: 500, color: "#666", borderRadius: 99, textDecoration: "none", transition: "all 160ms" }}>Sign in</Link>
            <Link to="/start" style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#1A1A18", borderRadius: 99, textDecoration: "none", transition: "all 160ms" }}>Start a map</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ position: "relative", minHeight: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "80px 20px 80px", overflow: "hidden" }}>
        {/* Amber glow */}
        <div aria-hidden style={{ pointerEvents: "none", position: "absolute", inset: 0, zIndex: 0, background: "radial-gradient(ellipse 70% 60% at 50% 30%, hsla(37,72%,62%,0.18) 0%, transparent 70%)" }} />
        <div style={{ position: "relative", zIndex: 10, maxWidth: 800, margin: "0 auto" }}>
          {/* Sprint badge */}
          <Reveal>
            <a href="#sprint" style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px 4px 4px",
              borderRadius: 99, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(8px)", fontSize: 12, fontWeight: 500, color: "#666",
              textDecoration: "none", marginBottom: 32, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", transition: "all 200ms"
            }}>
              <span style={{ background: "#1A1A18", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.06em" }}>NEW</span>
              Founder Operating Sprint — limited cohort
              <ChevronRight style={{ height: 14, width: 14, color: "#aaa" }} />
            </a>
          </Reveal>

          {/* Cycling headline */}
          <Reveal delay={60}>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(2.6rem, 6.5vw, 4.25rem)", fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.03em", margin: 0 }}>
              Atlas finds your{" "}
              <span style={{
                color: "hsl(37,72%,42%)",
                display: "inline-block",
                minWidth: "7ch",
                transition: "opacity 280ms ease, transform 280ms ease",
                opacity: cycleVisible ? 1 : 0,
                transform: cycleVisible ? "translateY(0)" : "translateY(-8px)",
              }}>
                {cycleWord}
              </span>
              .
            </h1>
          </Reveal>

          <Reveal delay={140}>
            <p style={{ margin: "20px auto 0", maxWidth: 480, fontSize: 16, lineHeight: 1.65, color: "#777", fontWeight: 450 }}>
              Connect your real tools. Get one map, one constraint, one next move — updated as you build.
            </p>
          </Reveal>

          {/* CTA */}
          <Reveal delay={220}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 40 }}>
              <Link to="/start" style={{
                height: 48, padding: "0 28px", fontSize: 15, fontWeight: 600, color: "#fff",
                background: "#1A1A18", borderRadius: 99, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 8,
                boxShadow: "0 2px 12px rgba(0,0,0,0.18)", transition: "all 160ms"
              }}>
                Start a map <ArrowRight style={{ height: 16, width: 16 }} />
              </Link>
              <a href="#how" style={{
                height: 48, padding: "0 28px", fontSize: 15, fontWeight: 500, color: "#555",
                background: "#fff", borderRadius: 99, textDecoration: "none", border: "1px solid rgba(0,0,0,0.12)",
                display: "inline-flex", alignItems: "center", transition: "all 160ms"
              }}>
                See how it works
              </a>
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: "#bbb", fontWeight: 500 }}>One sentence. No credit card.</p>
          </Reveal>

          {/* Hero card */}
          <Reveal delay={320}>
            <div style={{ marginTop: 56, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
              <div style={{
                borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", background: "#fff",
                boxShadow: "0 16px 60px -20px rgba(0,0,0,0.18), 0 4px 12px -4px rgba(0,0,0,0.08)", overflow: "hidden"
              }}>
                <div style={{ borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#FF5F56", display: "inline-block" }} />
                  <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#FEBC2E", display: "inline-block" }} />
                  <span style={{ height: 10, width: 10, borderRadius: "50%", background: "#27C840", display: "inline-block" }} />
                  <span style={{ marginLeft: 12, fontSize: 11, fontFamily: "monospace", color: "#ccc" }}>atlas — founder map</span>
                </div>
                <div style={{ padding: "24px 28px" }}>
                  <PreviewTrail />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Integration marquee */}
      <section style={{ background: "#fff", borderTop: "1px solid rgba(0,0,0,0.07)", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "20px 0", overflow: "hidden" }}>
        <p style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#ccc", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
          Reads signals from the tools you already use
        </p>
        <div className="marquee-track" style={{ display: "flex", gap: 48, width: "max-content" }}>
          {[...INTEGRATIONS, ...INTEGRATIONS, ...INTEGRATIONS].map((name, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, fontSize: 13, fontWeight: 500, color: "#bbb" }}>
              <span style={{ height: 6, width: 6, borderRadius: "50%", background: "#ddd", display: "inline-block" }} />
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ padding: "96px 20px", background: "#FAFAF8" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "hsl(37,72%,42%)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>How it works</div>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(1.9rem,4vw,2.8rem)", fontWeight: 600, letterSpacing: "-0.025em", margin: 0 }}>A route, not a dashboard.</h2>
              <p style={{ marginTop: 16, fontSize: 15, color: "#888", maxWidth: 380, margin: "16px auto 0", lineHeight: 1.65 }}>Most founders optimize noise. Atlas optimizes leverage.</p>
            </div>
          </Reveal>
          <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <StepCard step="01" title="State your active goal" body="One sentence. What are you trying to achieve right now? Not a mission statement — a specific goal." delay={0}>
              <div style={{ height: 36, borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", background: "#FAFAF8", display: "flex", alignItems: "center", padding: "0 14px", fontSize: 12, color: "#333", fontWeight: 500 }}>
                Get my first 3 paying clients
                <span style={{ display: "inline-block", width: 2, height: 14, marginLeft: 4, background: "hsl(37,72%,42%)", borderRadius: 1, animation: "pulse 1s ease infinite" }} />
              </div>
            </StepCard>
            <StepCard step="02" title="Connect your tools" body="Atlas reads GitHub, Stripe, Linear, Notion, and Slack. Your actual behaviour is the signal." delay={80}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["GitHub", "Stripe", "Notion", "Slack"].map((n) => (
                  <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 99, border: "1px solid rgba(0,0,0,0.09)", background: "#fff", fontSize: 11, fontWeight: 500, color: "#444" }}>
                    <span style={{ height: 6, width: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                    {n}
                  </span>
                ))}
              </div>
            </StepCard>
            <StepCard step="03" title="Get your move" body="Atlas finds your dominant constraint and gives you exactly one next action. Not a dashboard — a direction." delay={160}>
              <div style={{ borderRadius: 10, border: "1px solid hsla(37,72%,42%,0.3)", background: "hsla(37,72%,42%,0.06)", padding: "10px 14px" }}>
                <div style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "hsl(37,72%,42%)", fontWeight: 600 }}>Next Move</div>
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: "#1A1A18", lineHeight: 1.4 }}>Book 5 founder calls this week — no pitching, just learning.</div>
              </div>
            </StepCard>
          </div>
        </div>
      </section>

      {/* Founder Sprint — dark section */}
      <section id="sprint" style={{ background: "#1A1A18", color: "#fff", padding: "96px 20px", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ pointerEvents: "none", position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 50% at 50% 0%, hsla(37,72%,55%,0.12) 0%, transparent 60%)" }} />
        <div style={{ position: "relative", zIndex: 10, maxWidth: 1024, margin: "0 auto", display: "grid", gap: 64, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "center" }}>
          <div>
            <Reveal>
              <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "hsl(37,72%,55%)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16 }}>Founder Operating Sprint</div>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(1.9rem,3.5vw,2.8rem)", fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0 }}>
                Work directly with the Atlas founder.
              </h2>
              <p style={{ marginTop: 20, fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.65 }}>
                A high-touch 4-week operating engagement. I map your business, diagnose your constraint, and give you one clear move per week — built live in Atlas together.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <ul style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 14, listStyle: "none", padding: 0 }}>
                {["Weekly 1:1 — constraint diagnosis & strategy", "Live Atlas map built and updated together", "Async Slack access — answers within 24h", "Your journey documented as Atlas case study"].map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 14, color: "rgba(255,255,255,0.65)" }}>
                    <Check style={{ height: 16, width: 16, color: "hsl(37,72%,55%)", flexShrink: 0, marginTop: 1 }} />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={140}>
              <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
                <a href="mailto:hello@atlas.so?subject=Founder%20Sprint%20Application" style={{
                  height: 48, padding: "0 28px", fontSize: 15, fontWeight: 600, color: "#fff",
                  background: "hsl(37,72%,44%)", borderRadius: 99, textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                  boxShadow: "0 4px 20px hsla(37,72%,44%,0.35)", transition: "all 160ms"
                }}>
                  Apply for a spot <ArrowRight style={{ height: 16, width: 16 }} />
                </a>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>3 spots per cohort</span>
              </div>
            </Reveal>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "Month 1 sprint", price: "$500", note: "Prove the model" },
              { label: "Month 2 growth", price: "$1,000", note: "Double down on what works" },
              { label: "Full product", price: "$2,000+", note: "Atlas at scale" },
            ].map(({ label, price, note }, i) => (
              <Reveal key={label} delay={i * 60}>
                <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.65)" }}>{note}</div>
                  </div>
                  <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 600, color: "#fff" }}>{price}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "96px 20px", background: "#FAFAF8" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "hsl(37,72%,42%)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Intelligence</div>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(1.9rem,4vw,2.8rem)", fontWeight: 600, letterSpacing: "-0.025em", margin: 0 }}>Built for focused shipping.</h2>
              <p style={{ marginTop: 16, fontSize: 15, color: "#888", maxWidth: 380, margin: "16px auto 0", lineHeight: 1.65 }}>Not a dashboard. One constraint, one move — updated as you build.</p>
            </div>
          </Reveal>
          <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <FeatureCard icon={<Layers style={{ height: 20, width: 20 }} />} title="Confidence levels" body="Pins fill based on evidence depth. Hollow inferred, half building, solid established. You always know how sure Atlas is." delay={0} />
            <FeatureCard icon={<Activity style={{ height: 20, width: 20 }} />} title="Live signal reading" body="Reads GitHub commits, Stripe revenue, Linear tickets, Notion docs, and Slack activity — no manual logging." delay={90} />
            <FeatureCard icon={<Target style={{ height: 20, width: 20 }} />} title="Constraint engine" body="Connects quantitative signals to qualitative diagnosis. Not just what's happening — exactly why and what to do next." delay={180} />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: "96px 20px", background: "#fff", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "hsl(37,72%,42%)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Pricing</div>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(1.9rem,4vw,2.8rem)", fontWeight: 600, letterSpacing: "-0.025em", margin: 0 }}>Simple pricing.</h2>
            </div>
          </Reveal>
          <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", maxWidth: 680, margin: "0 auto" }}>
            <Reveal delay={60}><PriceCard name="Free" price="$0" lines={["1 active map", "Manual upload only", "Save and revisit"]} cta={<Link to="/start"><button style={{ width: "100%", height: 40, borderRadius: 99, border: "1px solid rgba(0,0,0,0.15)", fontSize: 14, fontWeight: 500, color: "#333", background: "transparent", cursor: "pointer" }}>Start a map</button></Link>} /></Reveal>
            <Reveal delay={130}><PriceCard name="Atlas" price="$15/mo" highlight lines={["Unlimited maps", "GitHub, Stripe, Linear, Notion, Slack", "Daily intelligence update", "Public profile + shareable maps"]} cta={<Link to="/auth"><button style={{ width: "100%", height: 40, borderRadius: 99, fontSize: 14, fontWeight: 600, color: "#fff", background: "#1A1A18", border: "none", cursor: "pointer" }}>Start free — upgrade anytime</button></Link>} /></Reveal>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ background: "#1A1A18", color: "#fff", padding: "96px 20px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ pointerEvents: "none", position: "absolute", inset: 0, background: "radial-gradient(ellipse 50% 60% at 50% 100%, hsla(37,72%,55%,0.10) 0%, transparent 60%)" }} />
        <div style={{ position: "relative", zIndex: 10, maxWidth: 560, margin: "0 auto", padding: "0 20px" }}>
          <Reveal>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(2rem,4.5vw,3.25rem)", fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0 }}>Start your map.</h2>
          </Reveal>
          <Reveal delay={80}>
            <p style={{ marginTop: 16, fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, maxWidth: 340, margin: "16px auto 0" }}>One sentence to state your goal. Atlas handles the rest. No credit card required.</p>
          </Reveal>
          <Reveal delay={160}>
            <div style={{ marginTop: 40 }}>
              <Link to="/start" style={{
                height: 48, padding: "0 32px", fontSize: 15, fontWeight: 600, color: "#fff",
                background: "hsl(37,72%,44%)", borderRadius: 99, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 8,
                boxShadow: "0 4px 20px hsla(37,72%,44%,0.35)", transition: "all 160ms"
              }}>
                Start a map <ArrowRight style={{ height: 16, width: 16 }} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: "#1A1A18", borderTop: "1px solid rgba(255,255,255,0.07)", padding: "32px 20px" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "rgba(255,255,255,0.28)" }}>
          <Logo />
          <div style={{ display: "flex", gap: 20 }}>
            <Link to="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy &amp; Terms</Link>
            <span>© 2026 Atlas</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StepCard({ step, title, body, children, delay }: {
  step: string; title: string; body: string; children?: React.ReactNode; delay?: number;
}) {
  return (
    <Reveal delay={delay ?? 0}>
      <div className="lift" style={{ borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", background: "#fff", padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "hsl(37,72%,42%)" }}>{step}</div>
        <div>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, color: "#1A1A18", lineHeight: 1.3, margin: 0 }}>{title}</h3>
          <p style={{ marginTop: 8, fontSize: 13, color: "#888", lineHeight: 1.65 }}>{body}</p>
        </div>
        {children && <div style={{ marginTop: "auto" }}>{children}</div>}
      </div>
    </Reveal>
  );
}

function FeatureCard({ icon, title, body, delay }: { icon: React.ReactNode; title: string; body: string; delay?: number }) {
  return (
    <Reveal delay={delay ?? 0}>
      <div className="lift" style={{ borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", background: "#fff", padding: 24, display: "flex", flexDirection: "column", gap: 12, height: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: 8, width: "fit-content", borderRadius: 10, background: "hsla(37,72%,42%,0.08)", color: "hsl(37,72%,42%)" }}>{icon}</div>
        <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, color: "#1A1A18", margin: 0 }}>{title}</h3>
        <p style={{ fontSize: 13, color: "#888", lineHeight: 1.65, margin: 0 }}>{body}</p>
      </div>
    </Reveal>
  );
}

function PriceCard({ name, price, lines, cta, highlight }: {
  name: string; price: string; lines: string[]; cta: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className="lift" style={{
      borderRadius: 20, border: highlight ? "1px solid rgba(0,0,0,0.18)" : "1px solid rgba(0,0,0,0.08)",
      background: highlight ? "#FAFAF8" : "#fff",
      padding: 28, display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%",
      boxShadow: highlight ? "0 4px 24px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.04)"
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em" }}>{name}</div>
          {highlight && <LogoMark size={18} />}
        </div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "3rem", fontWeight: 600, color: "#1A1A18", letterSpacing: "-0.03em", lineHeight: 1 }}>{price}</div>
        <ul style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10, listStyle: "none", padding: 0 }}>
          {lines.map((l) => (
            <li key={l} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#777" }}>
              <Check style={{ height: 14, width: 14, color: "hsl(37,72%,42%)", flexShrink: 0, marginTop: 1 }} />
              {l}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 32 }}>{cta}</div>
    </div>
  );
}

function PreviewTrail() {
  const items = [
    { label: "GOAL", title: "Get first 3 paying clients for Atlas", color: "hsl(37,72%,42%)", solid: true, alert: false },
    { label: "CONSTRAINT", title: "No one knows Atlas exists — zero outbound.", color: "hsl(7,49%,47%)", solid: false, alert: true },
    { label: "EVIDENCE", title: "0 organic signups, 12 GitHub stars this week.", color: "hsl(148,17%,43%)", solid: false, alert: false },
    { label: "NEXT MOVE", title: "DM 5 founders in your network. Ask about their biggest constraint.", color: "hsl(37,72%,42%)", solid: true, alert: false },
  ];
  return (
    <InView>
      {(inView, ref) => (
        <div ref={ref as never} style={{ position: "relative", paddingLeft: 32 }}>
          {inView && (
            <div aria-hidden className="trail-draw" style={{
              position: "absolute", left: 10, top: 8, bottom: 8, width: 2,
              backgroundImage: "linear-gradient(hsl(37,72%,42%) 50%, transparent 0%)",
              backgroundSize: "2px 8px", backgroundRepeat: "repeat-y"
            }} />
          )}
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 24 }}>
            {items.map((it, i) => (
              <li key={i} className={inView ? "waypoint-rise" : ""} style={{ position: "relative", opacity: inView ? undefined : 0, animationDelay: inView ? `${0.4 + i * 0.28}s` : undefined }}>
                <div style={{ position: "absolute", left: -32, top: 2 }}>
                  <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" fill="white" stroke={it.color} strokeWidth="2" />
                    {it.solid && <circle cx="11" cy="11" r="4" fill={it.color} />}
                  </svg>
                  {it.alert && (
                    <div style={{ position: "absolute", inset: -4 }}>
                      <span className="sonar-ring" style={{ display: "block", width: "100%", height: "100%", borderRadius: "50%", background: it.color, opacity: 0.2 }} />
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "#ccc", fontWeight: 600 }}>{it.label}</div>
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 500, color: "#1A1A18", lineHeight: 1.4 }}>{it.title}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </InView>
  );
}
