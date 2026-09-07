import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Target, UserPlus, Linkedin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function NewLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");

  // Extract a company name from the LinkedIn URL as a best-effort fallback
  const guessCompanyFromUrl = (rawUrl: string): string => {
    try {
      const u = new URL(rawUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      // linkedin.com/company/acme-corp → "Acme Corp"
      if (parts[0] === "company" && parts[1]) {
        return parts[1]
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
      // linkedin.com/in/john-doe → use person name as fallback
      if (parts[0] === "in" && parts[1]) {
        return parts[1]
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
    } catch {
      /* invalid URL — swallow */
    }
    return "New Lead";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be signed in to add leads.");
      return;
    }

    setLoading(true);
    try {
      const companyName = guessCompanyFromUrl(url);

      const { error } = await (supabase as any).from("leads").insert({
        user_id: user.id,
        company: companyName,
        source: "linkedin",
        website: url,
        stage: "new",
        icp_score: 0,
        is_contacted: false,
        research_data: { linkedin_url: url },
      });

      if (error) throw error;

      toast.success("Lead added to pipeline", {
        description: `${companyName} — enrichment queued.`,
        icon: <Target className="w-4 h-4 text-emerald-500" />,
      });
      setUrl("");
      onClose();
    } catch (err: any) {
      toast.error("Failed to add lead: " + (err.message ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  // Handle Portal mounting safely
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-auto"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative z-10 w-full max-w-md p-6 pointer-events-auto"
          >
            <div className="bg-card border border-border/60 rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-foreground/5 border border-border flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-foreground" />
                  </div>
                  <span className="font-semibold text-foreground">Import Lead</span>
                </div>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="url" className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Linkedin className="w-3.5 h-3.5" /> LinkedIn URL
                  </Label>
                  <Input
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://linkedin.com/company/acme or /in/john-doe"
                    className="h-10 bg-background border-border/60 focus:border-foreground/50 text-foreground"
                    required
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">
                    Paste a company or profile URL. Orion will enrich the rest.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-10 bg-foreground text-background hover:bg-foreground/90 font-semibold gap-2"
                  >
                    {loading ? "Adding to pipeline…" : "Initialize Enrichment"}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
