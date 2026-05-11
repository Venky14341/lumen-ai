import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sparkles,
  Plus,
  LogOut,
  Trash2,
  MessageSquare,
  Send,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Download,
  Pin,
  PinOff,
  Pencil,
  Search,
  MoreHorizontal,
  Square,
  Wand2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "Chat — Lumen AI" }] }),
});

type Conversation = {
  id: string;
  title: string;
  updated_at: string;
  pinned: boolean;
};
type DbMessage = { id: string; role: string; content: string; created_at: string };

const MODELS = [
  { id: "google/gemini-3.1-pro-preview", label: "Lumen Pro (Gemini 3.1)" },
  { id: "google/gemini-3-flash-preview", label: "Lumen Fast (Gemini 3)" },
  { id: "google/gemini-3.1-flash-lite-preview", label: "Lumen Lite" },
  { id: "openai/gpt-5", label: "GPT-5" },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini" },
];

const PERSONAS = [
  { id: "default", label: "Default", icon: "✨" },
  { id: "coder", label: "Coder", icon: "💻" },
  { id: "writer", label: "Writer", icon: "✍️" },
  { id: "tutor", label: "Tutor", icon: "🎓" },
  { id: "brainstorm", label: "Brainstorm", icon: "💡" },
];

const SUGGESTIONS = [
  "Explain quantum entanglement like I'm 12",
  "Draft a polite follow-up email after an interview",
  "Refactor this React component for performance",
  "Plan a 3-day Tokyo itinerary on a budget",
];

function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(
    () => localStorage.getItem("lumen.model") ?? MODELS[0].id
  );
  const [persona, setPersona] = useState<string>(
    () => localStorage.getItem("lumen.persona") ?? "default"
  );
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Conversation | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem("lumen.model", model);
  }, [model]);
  useEffect(() => {
    localStorage.setItem("lumen.persona", persona);
  }, [persona]);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("id,title,updated_at,pinned")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    setConversations((data ?? []) as Conversation[]);
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

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ model, persona }),
      }),
    [model, persona]
  );
  const chatId = activeId ?? "new";

  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const { messages, sendMessage, status, setMessages, stop } = useChat({
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
    stopSpeak();
  };

  const stopSpeak = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  };

  const speak = (id: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Text-to-speech not supported in this browser");
      return;
    }
    if (speakingId === id) {
      stopSpeak();
      return;
    }
    stopSpeak();
    const utter = new SpeechSynthesisUtterance(text);
    utter.onend = () => setSpeakingId(null);
    utter.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utter);
  };

  const toggleVoice = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input not supported in this browser");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setInput((prev) => (prev ? prev + " " : "") + txt.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const deleteConv = async (id: string) => {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeId === id) newChat();
    loadConversations();
    toast.success("Chat deleted");
  };

  const togglePin = async (c: Conversation) => {
    const { error } = await supabase
      .from("conversations")
      .update({ pinned: !c.pinned })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    loadConversations();
  };

  const renameConv = async (id: string, title: string) => {
    const { error } = await supabase
      .from("conversations")
      .update({ title: title.trim() || "Untitled" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setRenamingId(null);
    loadConversations();
  };

  const exportChat = () => {
    if (messages.length === 0) return toast.error("Nothing to export");
    const md = messages
      .map((m) => {
        const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
        return `### ${m.role === "user" ? "You" : "Lumen"}\n\n${text}`;
      })
      .join("\n\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumen-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const sendText = async (text: string) => {
    if (!text || !user || isLoading) return;
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

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendText(text);
  };

  const regenerate = async () => {
    if (isLoading) return;
    // find last user message
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;
    const userMsg = messages[lastUserIdx];
    const userText = userMsg.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

    // Drop assistant messages after the last user message from DB and UI
    const toDelete = messages.slice(lastUserIdx + 1).filter((m) => m.role === "assistant");
    if (activeId && toDelete.length > 0) {
      await supabase
        .from("messages")
        .delete()
        .in(
          "id",
          toDelete.map((m) => m.id)
        );
    }
    setMessages(messages.slice(0, lastUserIdx + 1));
    sendMessage({ text: userText });
  };

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const filteredConvs = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

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
            <span className="text-gradient">Lumen AI</span>
          </Link>
        </div>
        <div className="space-y-2 px-3">
          <Button onClick={newChat} className="w-full justify-start gap-2" variant="secondary">
            <Plus className="size-4" /> New chat
          </Button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="mt-3 flex-1 px-2">
          <div className="space-y-1 pb-4">
            {filteredConvs.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent",
                  activeId === c.id && "bg-accent"
                )}
              >
                {renamingId === c.id ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => renameConv(c.id, renameValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameConv(c.id, renameValue);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="h-7 text-sm"
                  />
                ) : (
                  <button
                    onClick={() => setActiveId(c.id)}
                    className="flex flex-1 items-center gap-2 truncate text-left"
                  >
                    {c.pinned ? (
                      <Pin className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{c.title || "Untitled"}</span>
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
                      <MoreHorizontal className="size-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => togglePin(c)}>
                      {c.pinned ? (
                        <>
                          <PinOff className="mr-2 size-3.5" /> Unpin
                        </>
                      ) : (
                        <>
                          <Pin className="mr-2 size-3.5" /> Pin
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setRenamingId(c.id);
                        setRenameValue(c.title);
                      }}
                    >
                      <Pencil className="mr-2 size-3.5" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setConfirmDelete(c)}
                    >
                      <Trash2 className="mr-2 size-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            {filteredConvs.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {conversations.length === 0 ? "No chats yet." : "No matches."}
              </p>
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
        <header className="glass sticky top-0 z-10 flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-9 w-[200px] border-0 bg-transparent text-sm font-medium hover:bg-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={persona} onValueChange={setPersona}>
              <SelectTrigger className="h-9 w-[150px] border-0 bg-transparent text-sm hover:bg-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERSONAS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="mr-2">{p.icon}</span>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={exportChat}
              disabled={messages.length === 0}
              className="gap-1.5"
            >
              <Download className="size-4" /> Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={regenerate}
              disabled={messages.length === 0 || isLoading}
              className="gap-1.5"
            >
              <RefreshCw className="size-4" /> Regenerate
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl px-4 py-8">
            {messages.length === 0 ? (
              <div className="grid min-h-[60vh] place-items-center text-center">
                <div className="w-full max-w-xl">
                  <div
                    className="mx-auto grid size-14 place-items-center rounded-2xl shadow-[var(--shadow-glow)]"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <Sparkles className="size-6 text-primary-foreground" />
                  </div>
                  <h2 className="mt-6 text-3xl font-semibold tracking-tight">
                    How can I help you <span className="text-gradient">today</span>?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pick a model, choose a persona, or try one of these:
                  </p>
                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendText(s)}
                        className="glass rounded-xl border border-border px-4 py-3 text-left text-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-glow)]"
                      >
                        <Wand2 className="mb-1.5 size-3.5 text-primary" />
                        <div>{s}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m) => {
                  const text = m.parts
                    .map((p) => (p.type === "text" ? p.text : ""))
                    .join("");
                  return (
                    <MessageRow
                      key={m.id}
                      id={m.id}
                      role={m.role}
                      text={text}
                      speaking={speakingId === m.id}
                      onSpeak={() => speak(m.id, text)}
                    />
                  );
                })}
                {status === "submitted" && (
                  <div className="flex items-center gap-2 pl-11 text-sm text-muted-foreground">
                    <span className="typing-dot">•</span>
                    <span className="typing-dot">•</span>
                    <span className="typing-dot">•</span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border bg-background/80 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <div className="relative rounded-2xl border border-border bg-card shadow-[var(--shadow-elegant)] transition-shadow focus-within:shadow-[var(--shadow-glow)]">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message Lumen AI…  (Shift+Enter for newline)"
                rows={1}
                className="min-h-[56px] resize-none border-0 bg-transparent pr-24 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleVoice}
                  className={cn("size-9", listening && "text-destructive")}
                  title="Voice input"
                >
                  {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </Button>
                {isLoading ? (
                  <Button size="icon" variant="destructive" onClick={() => stop()} className="size-9" title="Stop">
                    <Square className="size-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="size-9"
                  >
                    <Send className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              AI can make mistakes. Verify important info.
            </p>
          </div>
        </div>
      </main>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) deleteConv(confirmDelete.id);
                setConfirmDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MessageRow({
  id,
  role,
  text,
  speaking,
  onSpeak,
}: {
  id: string;
  role: string;
  text: string;
  speaking: boolean;
  onSpeak: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div key={id} className="msg-in group flex gap-3">
      <div
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg text-xs font-medium",
          role === "user"
            ? "bg-secondary text-secondary-foreground"
            : "text-primary-foreground"
        )}
        style={
          role === "assistant" ? { background: "var(--gradient-primary)" } : undefined
        }
      >
        {role === "user" ? "You" : <Sparkles className="size-4" />}
      </div>
      <div className="flex-1 pt-1">
        <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-card prose-pre:border prose-pre:border-border">
          <ReactMarkdown>{text || " "}</ReactMarkdown>
        </div>
        <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={copy}>
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          {role === "assistant" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={onSpeak}
            >
              {speaking ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
              {speaking ? "Stop" : "Speak"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
