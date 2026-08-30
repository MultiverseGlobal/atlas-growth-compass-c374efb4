import { useState, useEffect } from "react";
import { Video, CheckCircle2, Clock, AlertTriangle, FileVideo, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function HqMediaJobs() {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clario_jobs')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    const channel = supabase
      .channel('clario_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clario_jobs',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setJobs((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setJobs((prev) => prev.map((j) => j.id === payload.new.id ? payload.new : j));
          } else if (payload.eventType === 'DELETE') {
            setJobs((prev) => prev.filter((j) => j.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-8 bg-background min-h-screen text-foreground relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display flex items-center gap-2">
            <Video className="text-primary" /> Clario Media Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track and review media transcriptions and insights processed by Clario.</p>
        </div>
        <Button onClick={fetchJobs} variant="outline" className="h-9 gap-1.5" disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-lg">
          <h2 className="text-lg font-semibold mb-4 border-b border-border/60 pb-2">Recent Transcriptions</h2>
          
          {jobs.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <FileVideo className="h-12 w-12 mb-4 opacity-20" />
              <p>No recent media jobs found.</p>
              <p className="text-xs opacity-70 mt-1">Use the Orion app to send videos to Clario for insights.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map(job => (
                <div key={job.id} className="flex flex-col p-4 border border-border/40 rounded-lg bg-background/50 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-muted-foreground">ID: {job.id}</span>
                    <span className="flex items-center gap-1 text-xs font-mono text-emerald-500">
                      {job.status === "completed" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : job.status === "failed" ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ec4899]" />
                      )}
                      {job.status}
                    </span>
                  </div>
                  
                  {job.status !== "completed" && job.status !== "failed" && (
                    <div className="my-2">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground uppercase tracking-widest">{job.status_msg}</span>
                        <span className="text-[#ec4899] font-mono">{job.progress_pct}%</span>
                      </div>
                      <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-[#ec4899] h-1.5 rounded-full transition-all duration-300 ease-out" 
                          style={{ width: `${job.progress_pct || 0}%` }} 
                        />
                      </div>
                    </div>
                  )}

                  {job.input_url && (
                    <div className="text-sm text-primary hover:underline mb-3 truncate">
                      {job.input_url}
                    </div>
                  )}

                  {job.result && (
                    <div className="p-3 bg-card border border-border/40 rounded text-sm text-muted-foreground leading-relaxed italic line-clamp-3">
                      {JSON.stringify(job.result)}
                    </div>
                  )}
                  
                  <div className="text-right mt-2 flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
