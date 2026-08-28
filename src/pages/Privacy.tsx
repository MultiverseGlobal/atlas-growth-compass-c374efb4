import { Link } from "react-router-dom";
import { Logo } from "@/components/atlas/Logo";

const SECTIONS = [
  {
    title: "What we collect",
    body: [
      "Your email and basic account info when you sign up.",
      "The goal statements and notes you enter into Atlas.",
      "If you connect GitHub: your username and repository activity (commits, issue and PR counts) for repos you explicitly link — never code content, never private repos you haven't linked.",
      "Basic usage data — which pages you visit, when you take an action like completing a move.",
    ],
  },
  {
    title: "What we don't do",
    body: [
      "We never sell your data.",
      "We never make anything public without you explicitly choosing to publish it, item by item.",
      "We don't store your GitHub or OAuth tokens client-side — they're held server-side and used only to sync the data you've asked us to sync.",
      "We don't share your data with third parties outside what's needed to run the service (our database provider, Supabase).",
    ],
  },
  {
    title: "What's public vs. private",
    body: [
      "Everything in Atlas is private by default. Your maps, evidence, and connected source data are visible only to you unless you explicitly toggle a specific item to 'published'.",
      "Nothing is made public automatically. Publishing a map does not expose your raw connected-source data — only the specific content you chose to share.",
    ],
  },
  {
    title: "Your control",
    body: [
      "You can disconnect any source at any time from the Integrations page.",
      "You can delete your account at any time from Settings — this removes your data from Atlas immediately.",
      "If you disconnect a source, previously synced data stays in your account until you delete it manually or delete your account.",
    ],
  },
  {
    title: "This is a pilot",
    body: [
      "Atlas is in early testing. Expect rough edges.",
      "We may reach out directly to ask about your experience. Feedback you give us — in-app or directly — may be used to improve the product.",
    ],
  },
  {
    title: "Questions",
    body: [
      "Reach out directly with anything. This is a small pilot and you're talking to the person building it, not a support queue.",
    ],
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background grain">
      <header className="container flex h-16 items-center justify-between border-b border-border/60">
        <Link to="/"><Logo /></Link>
        <Link to="/auth?mode=signin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Sign in →
        </Link>
      </header>

      <main className="container max-w-2xl py-14 md:py-20">
        <div className="text-xs font-mono uppercase tracking-widest text-primary">Legal</div>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
          Privacy &amp; Terms
        </h1>
        <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">
          Plain language. This is a pilot, not a corporation. The goal is for you to understand exactly
          what Atlas does with your data — not to bury anything in legalese.
        </p>

        <div className="mt-12 space-y-10">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <h2 className="font-display text-xl font-semibold">{section.title}</h2>
              <ul className="mt-4 space-y-2">
                {section.body.map((point, i) => (
                  <li key={i} className="flex gap-3 text-[15px] text-muted-foreground leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Pilot notice */}
        <div className="mt-14 rounded-[14px] border border-border bg-card px-6 py-5">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Note</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This is a plain-language draft for a small pilot, not a formal legal document. If you have
            questions about anything here, reach out directly — you're talking to the person who built this.
          </p>
        </div>

        <div className="mt-12 border-t border-border/60 pt-8 flex items-center justify-between">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Atlas
          </Link>
          <span className="text-xs text-muted-foreground/50">Pilot draft · Atlas</span>
        </div>
      </main>
    </div>
  );
}
