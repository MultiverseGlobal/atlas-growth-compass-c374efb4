import { useState, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Send, Zap, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AtlasChatProps {
  open: boolean;
  onClose: () => void;
}

const STARTER_PROMPTS = [
  "What should I focus on today?",
  "Which deal is closest to closing?",
  "Who needs a follow-up right now?",
  "Analyse my pipeline honestly.",
  "What's my biggest bottleneck?",
];

export function AtlasChat({ open, onClose }: AtlasChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Load history from DB when opened
  useEffect(() => {
    if (!open || !user) return;
    const loadHistory = async () => {
      setLoading(true);
      try {
        const { data } = await (supabase as any)
          .from("chat_messages")
          .select("role, content")
          .eq("map_id", user.id)
          .order("created_at", { ascending: true })
          .limit(30);
        if (data) setMessages(data as Message[]);
      } catch {}
      finally { setLoading(false); }
    };
    loadHistory();
  }, [open, user]);

  const send = async (text: string) => {
    const messageText = text.trim();
    if (!messageText || !user || sending) return;

    setInput("");
    setSending(true);
    setMessages(prev => [...prev, { role: "user", content: messageText }]);

    try {
      const { data, error } = await supabase.functions.invoke("atlas-chat", {
        body: {
          message: messageText,
          // send last 10 turns for context (backend uses these)
          history: messages.slice(-10),
        },
      });

      if (error) throw new Error(error.message);

      const reply = data?.reply ?? "No response received.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      toast.error("Atlas failed to respond: " + err.message);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I couldn't retrieve your live data right now. Check your Supabase edge function deployment."
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    await (supabase as any).from("chat_messages").delete().eq("map_id", user.id);
    setMessages([]);
    toast.success("Chat cleared");
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] border-l border-border/60 bg-background p-0 flex flex-col h-full overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">Atlas</div>
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Revenue OS · Chief of Staff</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Clear chat"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-5">
              {/* Welcome state */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider">Atlas is ready.</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  I have live access to your pipeline, outreach, and deals. Ask me anything about the business — or tell me what you're thinking.
                </p>
              </div>
              {/* Starter prompts */}
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Quick questions</p>
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/30 hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((msg, i) => (
                <div key={i} className="space-y-1">
                  <div className={`text-[10px] font-semibold uppercase tracking-wider font-mono ${
                    msg.role === "user" ? "text-muted-foreground" : "text-primary"
                  }`}>
                    {msg.role === "user" ? "You" : "Atlas"}
                  </div>
                  <div className={`text-sm leading-relaxed whitespace-pre-wrap rounded-lg px-3 py-2.5 ${
                    msg.role === "user"
                      ? "bg-muted/20 border border-border/40 text-foreground/90"
                      : "bg-primary/5 border border-primary/15 text-foreground"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider font-mono text-primary">Atlas</div>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/15">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">Analysing your data...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-border/40 bg-background/80 shrink-0">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Atlas anything... (Enter to send)"
              disabled={sending || loading}
              rows={2}
              className="w-full resize-none rounded-xl border border-border/60 bg-muted/10 px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
            />
            <Button
              type="submit"
              size="sm"
              disabled={sending || !input.trim() || loading}
              className="absolute right-2.5 bottom-2.5 h-7 w-7 p-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 font-mono">Shift+Enter for new line</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────
// Backward-compatible alias for Home.tsx (old map-based chat)
// Accepts mapId/mapName/onActionExecuted but renders AtlasChat
// ─────────────────────────────────────────────
interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
  mapId?: string;
  mapName?: string;
  onActionExecuted?: (actionType: string) => void;
}

export function ChatDrawer({ open, onClose }: ChatDrawerProps) {
  return <AtlasChat open={open} onClose={onClose} />;
}
