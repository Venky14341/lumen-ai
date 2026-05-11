import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquare, Zap, Shield } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Lumen AI — Your private AI chat assistant" },
      {
        name: "description",
        content:
          "A fast, minimal AI chat assistant powered by frontier models. Sign in to start chatting and save your conversations.",
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-surface)" }}
      />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div
            className="grid size-8 place-items-center rounded-lg"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <span>Lumen AI</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 pt-20 pb-32 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="size-1.5 rounded-full bg-primary" />
          Powered by Lovable AI
        </div>
        <h1 className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-7xl">
          Think faster.
          <br />
          Chat smarter.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          A minimal, lightning-fast AI assistant that remembers every
          conversation. Sign in and start a new chat in seconds.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="shadow-[var(--shadow-glow)]">
              Start chatting free
            </Button>
          </Link>
        </div>

        <div className="mt-24 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Zap, title: "Streaming responses", desc: "Real-time token streaming for instant answers." },
            { icon: MessageSquare, title: "Saved history", desc: "Every conversation is stored to your account." },
            { icon: Shield, title: "Private & secure", desc: "Your chats are scoped to your user only." },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card/40 p-5 text-left backdrop-blur"
            >
              <Icon className="size-5 text-primary" />
              <div className="mt-3 font-medium">{title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
