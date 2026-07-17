import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CompassLoader } from "@/pages/app/Home";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
  mapId: string;
  mapName?: string;
  onActionExecuted?: (actionType: string) => void;
}

export function ChatDrawer({ open, onClose, mapId, mapName, onActionExecuted }: ChatDrawerProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputMsg, setInputMsg] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !mapId) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("chat_messages")
          .select("id, role, content, created_at")
          .eq("map_id", mapId)
          .order("created_at", { ascending: true })
          .limit(50);

        if (error) throw error;
        if (data) {
          setMessages(data as Message[]);
        }
      } catch (err: any) {
        console.error("[ChatDrawer] Error loading chat history:", err.message);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [open, mapId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = inputMsg.trim();
    if (!messageText || !user || !mapId || sending) return;

    setInputMsg("");
    setSending(true);

    const userMessage: Message = { role: "user", content: messageText };
    setMessages(prev => [...prev, userMessage]);

    try {
      // 1. Save user message to database
      const { error: dbErr } = await (supabase as any)
          .from("chat_messages")
        .insert({
          map_id: mapId,
          user_id: user.id,
          role: "user",
          content: messageText,
        });

      if (dbErr) throw dbErr;

      // 2. Call atlas-chat edge function
      const { data, error } = await supabase.functions.invoke("atlas-chat", {
        body: { map_id: mapId, message: messageText },
      });

      if (error) throw error;

      if (data) {
        const assistantReply: Message = {
          role: "assistant",
          content: data.reply || "No reply content received."
        };
        setMessages(prev => [...prev, assistantReply]);

        // Trigger action callback if agent took tool actions
        if (data.action && onActionExecuted) {
          const actionType = data.action.type;
          toast.success(`Atlas took action: ${actionType.replace(/_/g, " ")}`);
          onActionExecuted(actionType);
        }
      }
    } catch (err: any) {
      console.error("[ChatDrawer] Error sending message:", err);
      toast.error("Failed to get response from Atlas: " + (err.message || err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg border-l border-border/60 bg-background/98 backdrop-blur-sm p-0 flex flex-col h-full overflow-hidden grain">
        
        {/* Header */}
        <div className="p-6 border-b border-border/40 shrink-0">
          <SheetHeader>
            <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-primary uppercase mb-1">
              <MessageSquare className="h-3.5 w-3.5" /> Discuss Strategy
            </div>
            <SheetTitle className="font-display text-2xl font-semibold leading-tight text-foreground">
              {mapName || "Ask Atlas"}
            </SheetTitle>
          </SheetHeader>
        </div>

        {/* Scrollable Conversation Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
          {loading ? (
            <div className="py-20 flex justify-center">
              <CompassLoader />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground/80 max-w-xs mx-auto space-y-2">
              <Sparkles className="h-5 w-5 mx-auto text-primary/60 animate-pulse" />
              <p>No chat logs for this map. Ask Atlas about the reasoning behind your current move or argue against it.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((msg, i) => (
                <div key={i} className="text-sm leading-relaxed animate-slide-up">
                  <div className="font-display font-semibold text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1.5">
                    {msg.role === "user" ? "You" : "Atlas"}
                  </div>
                  <div className="font-sans text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="text-sm leading-relaxed animate-pulse">
                  <div className="font-display font-semibold text-[10px] uppercase tracking-wider text-primary mb-1.5">
                    Atlas
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    Formulating strategy...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prompt Input Form */}
        <div className="p-4 border-t border-border/40 bg-background shrink-0">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <Input
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Ask Atlas why this move is recommended..."
              disabled={sending || loading}
              className="flex-1 bg-muted/20 border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40 font-sans text-sm h-11"
            />
            <Button
              type="submit"
              disabled={sending || !inputMsg.trim() || loading}
              className="bg-primary text-primary-foreground hover:bg-primary/95 h-11 px-4 shadow-sm shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>

      </SheetContent>
    </Sheet>
  );
}
