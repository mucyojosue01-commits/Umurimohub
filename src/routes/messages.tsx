import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { Card, PageHeader } from "@/features/ui/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — UmurimoHub" },
      { name: "description", content: "Chat with employers, workers and teams." },
      { property: "og:title", content: "Messages — UmurimoHub" },
      { property: "og:description", content: "Your conversations." },
    ],
  }),
  component: Page,
});

function Page() {
  const { messages, send } = useApp();
  const threads = [...new Set(messages.map((m) => m.thread))];
  const [active, setActive] = useState(threads[0] ?? "");
  const [text, setText] = useState("");
  return (
    <div className="container-page py-10">
      <PageHeader title="Messages" />
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <Card className="p-2">
          {threads.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={cn(
                "block w-full rounded-xl px-3 py-2.5 text-left text-sm",
                t === active ? "bg-secondary font-semibold" : "hover:bg-muted",
              )}
            >
              {t}
            </button>
          ))}
        </Card>
        <Card className="flex min-h-96 flex-col">
          <div className="flex-1 space-y-2">
            {messages
              .filter((m) => m.thread === active)
              .map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    m.from === "me" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {m.text}
                  <div className="mt-1 text-[10px] opacity-70">{m.at}</div>
                </div>
              ))}
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) {
                send(active, text.trim());
                setText("");
              }
            }}
          >
            <input
              aria-label="Message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              className="h-10 flex-1 rounded-full border bg-card px-4"
              placeholder="Write a message"
            />
            <Button type="submit">Send</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
