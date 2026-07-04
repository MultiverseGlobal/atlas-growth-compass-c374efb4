import { FileText, Lock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const ROADMAP = [
  {
    label: "Constraint summary",
    description: "One-page snapshot of the current constraint, evidence, and recommended move. Shareable link.",
    status: "next",
  },
  {
    label: "Progress report",
    description: "Week-over-week signal history. Shows how constraint confidence changed over time.",
    status: "planned",
  },
  {
    label: "Investor digest",
    description: "Formatted update for a pre-seed round: goal, traction signals, key constraint, ask.",
    status: "planned",
  },
];

export default function Reports() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <div className="text-xs font-mono uppercase tracking-widest text-primary">Reports</div>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight md:text-5xl">
        Structured outputs
      </h1>
      <p className="mt-3 text-[15px] text-muted-foreground max-w-xl">
        Reports are generated from your maps — not filled in by you. They become meaningful once your map has enough signal to trust.
      </p>

      {/* Status callout */}
      <div className="mt-8 flex items-start gap-3 rounded-[14px] border border-border bg-card/60 px-5 py-4">
        <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          Reports are in development. The formats below are what's coming — in this order. When your map has established-confidence signals, the first format will unlock automatically.
        </div>
      </div>

      {/* Roadmap */}
      <div className="mt-8 space-y-3">
        {ROADMAP.map((item, i) => (
          <div
            key={i}
            className={`rounded-[16px] border px-5 py-5 ${
              item.status === "next"
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card opacity-60"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FileText className={`h-4 w-4 shrink-0 ${item.status === "next" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              <span className={`font-mono text-[10px] uppercase tracking-widest ${
                item.status === "next" ? "text-primary" : "text-muted-foreground/60"
              }`}>
                {item.status === "next" ? "Up next" : "Planned"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground pl-6">{item.description}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-10 rounded-[16px] border border-border bg-card px-5 py-5">
        <div className="text-sm font-medium">Make your first map reliable</div>
        <p className="mt-1 text-sm text-muted-foreground">
          The faster your map reaches established confidence, the sooner reports unlock. Sync GitHub and add context notes to strengthen the signal.
        </p>
        <Link to="/app" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          Go to your maps <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
