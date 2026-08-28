import { useState, useEffect } from "react";
import { Video, CheckCircle2, Clock, AlertTriangle, FileVideo, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HqMediaJobs() {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      // In a real implementation, we would query the backend for historical jobs.
      // For now, since Clario currently holds jobs in-memory (JOBS_DB), we can't fetch a list easily
      // unless we add an endpoint for it. We'll simulate it for the dashboard UI.
      const clarioUrl = import.meta.env.VITE_CLARIO_URL || "http://192.168.1.100:8000";
      
      const res = await fetch(`${clarioUrl}/api/v1/health`);
      if (res.ok) {
        setJobs([
          { id: "job_12345", status: "completed", url: "https://youtube.com/watch?v=mock", insights: "The core idea is...", time: "2 mins ago" }
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
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
                      <CheckCircle2 className="h-3.5 w-3.5" /> {job.status}
                    </span>
                  </div>
                  <a href={job.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline mb-3">
                    {job.url}
                  </a>
                  <div className="p-3 bg-card border border-border/40 rounded text-sm text-muted-foreground leading-relaxed italic">
                    {job.insights}
                  </div>
                  <div className="text-right mt-2">
                    <span className="text-[10px] text-muted-foreground">{job.time}</span>
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
