import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Target, UserPlus, Linkedin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Mock save
    setTimeout(() => {
      setLoading(false);
      toast.success("Lead imported to pipeline", {
        description: "Orion is processing background enrichment.",
        icon: <Target className="w-4 h-4 text-emerald-500" />
      });
      onClose();
    }, 800);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-6"
          >
            <div className="bg-card border border-border/60 rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="font-semibold text-foreground">Import Lead</span>
                </div>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
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
                    placeholder="https://linkedin.com/in/..." 
                    className="h-10 bg-background border-border/60 focus:border-emerald-500/50 text-foreground"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">Orion will auto-enrich the rest.</p>
                </div>
                
                <div className="pt-2">
                  <Button type="submit" disabled={loading} className="w-full h-10 bg-foreground text-background hover:bg-foreground/90 font-semibold gap-2">
                    {loading ? "Analyzing Profile..." : "Initialize Enrichment"}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
