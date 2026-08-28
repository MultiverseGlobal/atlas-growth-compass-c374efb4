import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users2, Compass, FileText, Plug, Settings, 
  Map, Shield, ArrowUpRight, Zap, Database
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface TheVaultDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenChat: () => void;
}

const VAULT_SECTIONS = [
  {
    title: "Sovereign Intelligence & Memory",
    items: [
      { to: "/app", icon: Map, label: "Strategic Maps & Roadmaps", desc: "Long-range master maps, execution milestones & dependencies" },
      { to: "/hq/leads", icon: Users2, label: "Leads Archive & Intelligence", desc: "Qualified founder directory, ICP matrices, pain profiles" },
      { to: "/hq/dashboard", icon: Compass, label: "Mission Control", desc: "High-altitude revenue telemetry, pipeline velocity & win rates" },
      { to: "/hq/partnerships", icon: Users2, label: "Partnership CRM", desc: "Manage agency partners, track referrals and commissions" },
    ],
  },
  {
    title: "System Connectors & Telemetry",
    items: [
      { to: "/app/integrations", icon: Plug, label: "Integrations Hub", desc: "Sync 2-way with Notion, Attio, Stripe, GitHub & Slack" },
      { to: "/hq/report", icon: FileText, label: "Diagnostic Reports", desc: "Automated audit logs, pitch proposals & weekly founder syncs" },
      { to: "/hq/settings", icon: Settings, label: "Workspace & API Config", desc: "Custom LLM keys, team access, domain & security rules" },
    ],
  },
];

export function TheVaultDrawer({ open, onClose, onOpenChat }: TheVaultDrawerProps) {
  const navigate = useNavigate();

  // Keyboard shortcut listener (Cmd+K or Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl bg-background border-border text-foreground p-0 overflow-hidden shadow-2xl rounded-2xl">
        {/* Vault Header — Clean Metaphor Style */}
        <div className="p-6 border-b border-border bg-surface-2/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight flex items-center gap-2">
                <span>The Vault</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border">
                  RESOURCES & REPOSITORIES
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Strategic memory, database archives, and system integrations outside the active acquisition stream.
              </p>
            </div>
          </div>

          <button
            onClick={() => { onClose(); onOpenChat(); }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Ask Atlas AI</span>
          </button>
        </div>

        {/* Vault Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[70vh] overflow-y-auto bg-background">
          {VAULT_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2.5">
              <h4 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground px-1">
                {section.title}
              </h4>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <button
                    key={item.to}
                    onClick={() => {
                      onClose();
                      navigate(item.to);
                    }}
                    className="w-full text-left p-3.5 rounded-xl bg-card hover:bg-surface-2 border border-border hover:border-primary/40 transition-all group flex items-start gap-3.5 shadow-sm hover:shadow-md"
                  >
                    <div className="h-8 w-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0 group-hover:border-primary/30 group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary transition-colors">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground group-hover:text-primary flex items-center justify-between">
                        <span>{item.label}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Vault Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface-2/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2 font-mono">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span>Sovereign Storage Protocol</span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-foreground font-sans">ESC</kbd> to exit
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
