import { useState } from "react";
import { Loader2, ArrowRight, Video, Target, AlertTriangle, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { LogoMark } from "@/components/atlas/Logo";

export default function Landing() {
  const [form, setForm] = useState({ company: "", prospect: "", email: "", website: "", bottleneck: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company || !form.email || !form.bottleneck) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-inbound-lead", {
        body: form
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 flex flex-col grain">
      {/* Header */}
      <header className="absolute top-0 w-full p-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <LogoMark size={24} className="text-primary" />
          <span className="font-bold tracking-tight text-sm">Atlas Automations</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-xs">
          Client Login
        </Button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-32 pb-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold uppercase tracking-widest mb-4">
            <Zap className="h-3.5 w-3.5" /> For Small Agencies & Service Businesses
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight leading-[1.1] text-balance">
            Stop losing 10+ hours a week to manual operations.
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed text-balance">
            We find and remove the hidden operational bottlenecks destroying your margins. Get a free, custom teardown of your agency's most broken process.
          </p>

          <div className="pt-8 w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 text-left">
            
            {/* Left: Video / Proof */}
            <div className="space-y-6">
              <div className="aspect-video bg-card border border-border/50 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform cursor-pointer shadow-lg backdrop-blur-md z-10">
                  <Video className="h-6 w-6 text-primary ml-1" />
                </div>
                <p className="absolute bottom-4 text-xs font-mono text-muted-foreground z-10">Watch a sample 3-minute teardown</p>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> What you get:</h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> <span className="leading-tight">A detailed map of where you're bleeding time and money.</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> <span className="leading-tight">A step-by-step automation strategy to replace manual work.</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> <span className="leading-tight">Zero obligations, zero sales pressure. Just actionable value.</span></li>
                </ul>
              </div>
            </div>

            {/* Right: Form */}
            <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-primary/5 blur-3xl rounded-full" />
              
              {submitted ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-500 min-h-[350px]">
                  <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-2 border border-emerald-500/20">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-bold font-display">Teardown Requested</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    We've received your request. We'll review your bottleneck and send over your custom video teardown shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                  <div>
                    <h3 className="text-xl font-bold font-display mb-1">Request your free teardown</h3>
                    <p className="text-sm text-muted-foreground">Tell us about the process that's slowing you down.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">First Name</label>
                      <Input required value={form.prospect} onChange={e => setForm({...form, prospect: e.target.value})} placeholder="Jane" className="bg-background/50 border-input" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">Company Name</label>
                      <Input required value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Acme Agency" className="bg-background/50 border-input" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">Work Email</label>
                    <Input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="jane@acme.com" className="bg-background/50 border-input" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">Website <span className="text-muted-foreground font-normal normal-case">(Optional)</span></label>
                    <Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="https://acme.com" className="bg-background/50 border-input" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500" /> What's your biggest operational bottleneck right now?
                    </label>
                    <textarea 
                      required
                      value={form.bottleneck}
                      onChange={e => setForm({...form, bottleneck: e.target.value})}
                      placeholder="E.g., We spend 5 hours a week manually copying client data from Typeform to our CRM..."
                      className="w-full bg-background/50 border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-none"
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 text-sm font-bold mt-2 gap-2 bg-primary text-primary-foreground hover:bg-primary/90" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get My Free Teardown"}
                    {!submitting && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </form>
              )}
            </div>

          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-muted-foreground border-t border-border/20">
        <p>&copy; {new Date().getFullYear()} Atlas Automations. All rights reserved.</p>
      </footer>
    </div>
  );
}
