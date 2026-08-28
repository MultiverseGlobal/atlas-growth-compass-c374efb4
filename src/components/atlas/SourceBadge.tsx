import { Github, CreditCard, Layers, LineChart, PenLine } from "lucide-react";

type Provider = "github" | "stripe" | "linear" | "posthog" | "manual";

const map: Record<Provider, { icon: any; label: string }> = {
  github: { icon: Github, label: "GitHub" },
  stripe: { icon: CreditCard, label: "Stripe" },
  linear: { icon: Layers, label: "Linear" },
  posthog: { icon: LineChart, label: "PostHog" },
  manual: { icon: PenLine, label: "Note" },
};

export function SourceBadge({ provider, href }: { provider: Provider; href?: string }) {
  const { icon: Icon, label } = map[provider];
  const inner = (
    <span className="source-badge">
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {label}
    </span>
  );
  if (href) return <a href={href} target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity">{inner}</a>;
  return inner;
}
