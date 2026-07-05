import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, Trash2, ArrowLeft, Info, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  system: Bell,
};

const KIND_COLOR: Record<string, string> = {
  info: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  warning: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  success: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  system: "text-primary bg-primary/10 border-primary/20",
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link_url, read_at, created_at")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data ?? []);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      toast.success("Marked as read");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.read_at);
    if (unread.length === 0) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user?.id)
        .is("read_at", null);

      if (error) throw error;
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
      toast.success("All marked as read");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success("Notification deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight md:text-5xl">
            Inbox
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            System updates, sync alerts, and milestone celebrations.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="text-xs shrink-0"
          >
            Mark all read
          </Button>
        )}
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-card border border-border" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {notifications.map(n => {
              const Icon = KIND_ICON[n.kind] ?? Bell;
              const colorClass = KIND_COLOR[n.kind] ?? KIND_COLOR.system;
              const isUnread = !n.read_at;

              return (
                <div
                  key={n.id}
                  className={`flex gap-4 rounded-xl border p-4 transition-all duration-200 ${
                    isUnread
                      ? "border-primary/20 bg-primary/5 shadow-sm"
                      : "border-border bg-card/60 opacity-80"
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-sm font-medium ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                        {n.title}
                      </h3>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {n.body && (
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        {n.body}
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-3">
                      {n.link_url && (
                        <Link
                          to={n.link_url}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View detail <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {isUnread && (
                        <button
                          onClick={() => handleMarkAsRead(n.id)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Check className="h-3 w-3" /> Mark read
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[20px] border border-dashed border-border bg-card/40 px-8 py-16 text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        <Bell className="h-5 w-5" />
      </div>
      <h3 className="font-display text-xl font-semibold">Inbox is clear</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
        You're completely up to date. Future system alerts will arrive here.
      </p>
    </div>
  );
}
