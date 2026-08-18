import { useState, useEffect, useCallback } from "react";
import { Users2, Loader2, Plus, Building2, Mail, Network, ArrowUpRight, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function HqPartnerships() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: "", company: "", email: "", type: "agency" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).from("atlas_partnerships").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      setPartners(data || []);
    } catch (err: any) {
      toast.error("Failed to load partnerships");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreatePartner = async () => {
    if (!newPartner.name.trim() || !user) return;
    setSaving(true);
    try {
      await (supabase as any).from("atlas_partnerships").insert({
        user_id: user.id,
        partner_name: newPartner.name,
        partner_company: newPartner.company,
        partner_email: newPartner.email,
        partner_type: newPartner.type,
      });
      toast.success("Partner added");
      setNewPartner({ name: "", company: "", email: "", type: "agency" });
      setShowAddPartner(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">Partnership CRM</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Manage agency partners, track inbound referrals, and monitor commission attribution for zero-cost acquisition.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Active Partners ({partners.length})</div>
        <Button onClick={() => setShowAddPartner(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add Partner
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : partners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 p-12 text-center">
          <Users2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No partners added yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add agencies, VCs, or fractional execs to track their referrals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map(p => (
            <div key={p.id} className="bg-card border border-border/60 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-foreground">{p.partner_company || "Independent Partner"}</h3>
                  <div className="text-sm text-muted-foreground">{p.partner_name}</div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 uppercase">
                  {p.partner_type}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> {p.partner_email || "No email"}
              </div>

              <div className="pt-4 border-t border-border/40 flex justify-between items-center">
                <div className="text-xs font-mono font-medium">{p.commission_rate}% Commission</div>
                <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase tracking-wider">
                  View Referrals <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Partner Dialog */}
      <Dialog open={showAddPartner} onOpenChange={setShowAddPartner}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">Partner Name *</label>
              <Input value={newPartner.name} onChange={e => setNewPartner({...newPartner, name: e.target.value})} placeholder="e.g. John Smith" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Company / Agency Name</label>
              <Input value={newPartner.company} onChange={e => setNewPartner({...newPartner, company: e.target.value})} placeholder="e.g. Acme Agency" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Email</label>
              <Input type="email" value={newPartner.email} onChange={e => setNewPartner({...newPartner, email: e.target.value})} placeholder="john@acme.com" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Partner Type</label>
              <Select value={newPartner.type} onValueChange={v => setNewPartner({...newPartner, type: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agency</SelectItem>
                  <SelectItem value="vc">VC / Investor</SelectItem>
                  <SelectItem value="fractional">Fractional Exec</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddPartner(false)}>Cancel</Button>
            <Button onClick={handleCreatePartner} disabled={!newPartner.name.trim() || saving}>
              {saving ? "Saving..." : "Add Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
