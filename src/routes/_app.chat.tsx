import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Plus, LogOut, Trash2, MessageSquare, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "Chat — Lumen AI" }] }),
});

type Conversation = { id: string; title: string; updated_at: string };
type DbMessage = { id: string; role: string; content: string; created_at: string };

function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    setConversations(data ?? []);
  };

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  useEffect(() => {
    if (!activeId) {
      setInitialMessages([]);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    supabase
      .from("messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", activeId)
      .order("created_at")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        const msgs: UIMessage[] = (data ?? []).map((m: DbMessage) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          parts: [{ type: "text", text: m.content }],
        }));
        setInitialMessages(msgs);
        setHydrated(true);
      });
  }, [activeId]);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const chatId = activeId ?? "new";

  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onError: (err) => toast.error(err.message || "Something went wrong"),
    onFinish: async ({ message }) => {
      if (!user) return;
      const convId = activeIdRef.current;
      if (!convId) return;
      const text = message.parts
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
      await supabase.from("messages").insert({
        conversation_id: convId,
        user_id: user.id,
        role: "assistant",
        content: text,
      });
      loadConversations();
    },
  });

  useEffect(() => {
    if (hydrated) setMessages(initialMessages);
  }, [hydrated, initialMessages, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setInput("");
  };

  const deleteConv = async (id: string) => {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeId === id) newChat();
    loadConversations();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user || isLoading) return;
    setInput("");

    let convId = activeId;
    if (!convId) {
      const title = text.slice(0, 60);
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      if (error || !data) return toast.error(error?.message ?? "Failed");
      convId = data.id;
      setActiveId(convId);
    }

    await supabase.from("messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content: text,
    });

    sendMessage({ text });
  };

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-72 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center justify-between p-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div
              className="grid size-7 place-items-center rounded-lg"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Sparkles className="size-3.5 text-primary-foreground" />
            </div>
            Lumen AI
          </Link>
        </div>
        <div className="px-3">
          <Button onClick={newChat} className="w-full justify-start gap-2" variant="secondary">
            <Plus className="size-4" /> New chat
          </Button>
        </div>
        <ScrollArea className="mt-4 flex-1 px-2">
          <div className="space-y-1 pb-4">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
                  activeId === c.id && "bg-accent"
                )}
              >
                <button
                  onClick={() => setActiveId(c.id)}
                  className="flex flex-1 items-center gap-2 truncate text-left"
                >
                  <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.title || "Untitled"}</span>
                </button>
                <button
                  onClick={() => deleteConv(c.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No chats yet.</p>
            )}
          </div>
        </ScrollArea>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 truncate px-2 text-xs text-muted-foreground">{user?.email}</div>
          <Button onClick={signOut} variant="ghost" size="sm" className="w-full justify-start gap-2">
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl px-4 py-8">
            {messages.length === 0 ? (
              <div className="grid min-h-[60vh] place-items-center text-center">
                <div>
                  <div
                    className="mx-auto grid size-14 place-items-center rounded-2xl shadow-[var(--shadow-glow)]"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <Sparkles className="size-6 text-primary-foreground" />
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold">How can I help you today?</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Ask anything. I'll remember it next time.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m) => {
                  const text = m.parts
                    .map((p) => (p.type === "text" ? p.text : ""))
                    .join("");
                  return (
                    <div key={m.id} className="flex gap-3">
                      <div
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg text-xs font-medium",
                          m.role === "user"
                            ? "bg-secondary text-secondary-foreground"
                            : "text-primary-foreground"
                        )}
                        style={
                          m.role === "assistant"
                            ? { background: "var(--gradient-primary)" }
                            : undefined
                        }
                      >
                        {m.role === "user" ? "You" : <Sparkles className="size-4" />}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-card prose-pre:border prose-pre:border-border">
                          <ReactMarkdown>{text || " "}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {status === "submitted" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Thinking…
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border bg-background/80 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <div className="relative rounded-2xl border border-border bg-card shadow-[var(--shadow-elegant)]">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message Lumen AI…"
                rows={1}
                className="min-h-[56px] resize-none border-0 bg-transparent pr-14 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute bottom-2 right-2 size-9"
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              AI can make mistakes. Verify important info.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
