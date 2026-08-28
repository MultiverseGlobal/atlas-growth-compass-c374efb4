import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const { user } = useAuth();
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) return;
    setUpgrading(true);
    try {
      // Simulate Stripe checkout delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const { error } = await supabase
        .from("profiles")
        .update({ plan: "atlas" })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Welcome to Atlas! Unlimited maps and advanced signals unlocked.");
      onClose();
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message ?? "Upgrade failed");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center font-display text-2xl">
            1 map on Free
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground mt-1">
            Upgrade to Atlas for unlimited maps.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-lg border border-border bg-card p-4 space-y-2">
          {["Unlimited maps", "All integrations", "Daily update card", "Public page + reports"].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              {f}
            </div>
          ))}
          <div className="pt-1 text-xs text-muted-foreground font-mono">$15 / month</div>
        </div>

        <div className="mt-4 space-y-2">
          <Button className="w-full" onClick={handleUpgrade} disabled={upgrading}>
            {upgrading ? "Processing payment…" : "Upgrade to Atlas"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose} disabled={upgrading}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
