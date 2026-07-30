import { useState } from "react";
import { Loader2, Zap, Copy, Check, ChevronRight, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { PainHypothesis } from "./PainEngine";
import { useNavigate } from "react-router-dom";

interface GeneratedOffer {
  problem: string;
  outcome: string;
  solution: string;
  timeline: string;
  price: string;
  roi: string;
  one_liner: string;
}

interface OfferBuilderProps {
  companyId: string;
  companyName: string;
  website: string;
  researchData: any;
  initialPain?: PainHypothesis | null;
}

export function OfferBuilder({ companyId, companyName, website, researchData, initialPain }: OfferBuilderProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pain, setPain] = useState<PainHypothesis | null>(initialPain ?? null);
  const [priceInput, setPriceInput] = useState("£2,500 – £5,000");
  const [offer, setOffer] = useState<GeneratedOffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!pain) { toast.error("Run Pain Analysis first to select a pain point"); return; }
    setLoading(true);
    setOffer(null);
    try {
      const { data, error } = await supabase.functions.invoke("sourcing-machine", {
        body: {
          action: "generate-offer",
          company: companyName,
          website,
          research: researchData,
          pain,
          price_range: priceInput,
        },
      });

      if (error) throw new Error(error.message);
      setOffer(data as GeneratedOffer);

      // Log event
      if (user) {
        await (supabase as any).from("atlas_events").insert({
          user_id: user.id,
          company_id: companyId,
          event_type: "offer_generated",
          source: "ai",
          metadata: {
            problem: pain.problem,
            price_range: priceInput,
            offer: data,
          },
        });
      }
    } catch (err: any) {
      toast.error("Offer generation failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const offerText = offer
    ? `OFFER FOR ${companyName.toUpperCase()}\n\n` +
      `Problem: ${offer.problem}\n\n` +
      `Outcome: ${offer.outcome}\n\n` +
      `Solution: ${offer.solution}\n\n` +
      `Timeline: ${offer.timeline}\n\n` +
      `Investment: ${offer.price}\n\n` +
      `ROI: ${offer.roi}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(offerText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Offer copied");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Offer Builder</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            One click from pain to positioned offer.
          </p>
        </div>
      </div>

      {/* Pain selector */}
      <div className={`rounded-xl border p-4 space-y-2 ${pain ? "border-primary/20 bg-primary/5" : "border-dashed border-border/40 bg-muted/5"}`}>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Selected Pain</div>
        {pain ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">{pain.problem}</p>
            <p className="text-xs text-muted-foreground">{pain.opportunity} · {pain.estimated_value}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60">
            Go to the Pain tab → run analysis → click "Build offer from this pain"
          </p>
        )}
      </div>

      {/* Price input + generate */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">Target price range</label>
          <Input
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="£2,500 – £5,000"
            className="h-9 text-sm border-border/60"
          />
        </div>
        <div className="flex items-end">
          <Button
            onClick={handleGenerate}
            disabled={loading || !pain}
            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {loading ? "Building..." : "Build Offer"}
          </Button>
        </div>
      </div>

      {/* Generated offer */}
      {offer && (
        <div className="space-y-3 animate-in fade-in duration-300">

          {/* One liner */}
          {offer.one_liner && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-sm font-semibold text-primary leading-snug">"{offer.one_liner}"</p>
            </div>
          )}

          {/* Chain */}
          <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40">
            {[
              { label: "Problem", value: offer.problem, color: "text-red-400" },
              { label: "Outcome", value: offer.outcome, color: "text-emerald-400" },
              { label: "Solution", value: offer.solution, color: "text-primary" },
              { label: "Timeline", value: offer.timeline, color: "text-amber-400" },
              { label: "Investment", value: offer.price, color: "text-emerald-400" },
              { label: "ROI", value: offer.roi, color: "text-primary" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-start gap-4 px-4 py-3">
                <div className={`text-[10px] font-semibold uppercase tracking-wider font-mono w-20 shrink-0 mt-0.5 ${color}`}>
                  {label}
                </div>
                <p className="text-sm leading-relaxed text-foreground/90 flex-1">{value}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 text-xs gap-1.5 border-border/60">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy offer"}
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(`/hq/leads/${companyId}/proposal`)}
              className="h-8 text-xs gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Build Proposal <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={loading} className="h-8 text-xs text-muted-foreground gap-1">
              <RefreshCw className="h-3 w-3" /> Regenerate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
