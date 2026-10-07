import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import {
  getOrCreateDirectConversation,
  listConversations,
  listMessages,
  markMessagesRead,
  sendMessage,
  type Conversation,
  type Message,
} from "@/features/messaging/service";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — UmurimoHub" }, { name: "description", content: "Live conversations on UmurimoHub." }] }),
  component: Page,
});

function Page() {
  const { session } = useApp();
  const { workers, workerUserIds } = useCatalog();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  const active = conversations.find((c) => c.id === activeId);
  const availableWorkers = useMemo(
    () => workers.filter((w) => workerUserIds[w.id] && workerUserIds[w.id] !== session?.user.id),
    [workers, workerUserIds, session?.user.id],
  );

  const reloadConversations = async () => {
    if (!session) return;
    const data = await listConversations(session.user.id);
    setConversations(data);
    if (!activeId && data[0]) setActiveId(data[0].id);
  };

  const reloadMessages = async () => {
    if (!session || !activeId) return;
    const data = await listMessages(activeId, session.user.id);
    setMessages(data);
    const unread = data.filter((m) => m.sender_id !== session.user.id && !m.read).map((m) => m.id);
    if (unread.length) {
      await markMessagesRead(unread);
      setMessages((current) => current.map((m) => (unread.includes(m.id) ? { ...m, read: true } : m)));
    }
  };

  useEffect(() => {
    if (!session) {
      setConversations([]);
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void reloadConversations().finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    if (!activeId || !session) return;
    void reloadMessages();
    const channel = supabase
      .channel("conversation-" + activeId)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: "conversation_id=eq." + activeId }, () => void reloadMessages())
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reads" }, () => void reloadMessages())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [activeId, session]);

  if (!session) {
    return (
      <div className="container-page py-20 text-center">
        <PageHeader title="Messages" desc="Sign in to use live messaging." />
        <Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button>
      </div>
    );
  }

  const startConversation = async (otherUserId: string) => {
    try {
      const id = await getOrCreateDirectConversation(otherUserId);
      await reloadConversations();
      setActiveId(id);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't start conversation.");
    }
  };

  const send = async () => {
    if (!activeId || !text.trim()) return;
    try {
      await sendMessage(activeId, session.user.id, text);
      setText("");
      await reloadMessages();
      await reloadConversations();
    } catch (e) {
      toast.error((e as Error).message || "Couldn't send message.");
    }
  };

  return (
    <div className="container-page py-10">
      <PageHeader title="Messages" desc="Persistent, real-time conversations with UmurimoHub members." />
      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        <Card className="p-3">
          <div className="mb-3">
            <p className="text-sm font-semibold">Start a conversation</p>
            <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-auto">
              {availableWorkers.slice(0, 20).map((worker) => (
                <Button key={worker.id} size="sm" variant="outline" onClick={() => void startConversation(workerUserIds[worker.id]!)}>
                  {worker.name}
                </Button>
              ))}
              {!availableWorkers.length && <p className="text-xs text-muted-foreground">No other registered workers yet.</p>}
            </div>
          </div>
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setActiveId(conversation.id)}
                className={cn("w-full rounded-xl px-3 py-3 text-left", activeId === conversation.id ? "bg-secondary" : "hover:bg-muted")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{conversation.otherName}</span>
                  {conversation.unreadCount > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{conversation.unreadCount}</span>}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{conversation.lastMessage?.body ?? "No messages yet"}</p>
              </button>
            ))}
            {!conversations.length && !loading && <p className="py-8 text-center text-sm text-muted-foreground">No conversations yet.</p>}
          </div>
        </Card>

        <Card className="flex min-h-[28rem] flex-col">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Choose a conversation to begin.</div>
          ) : (
            <>
              <div className="border-b pb-3 font-semibold">{active.otherName}</div>
              <div className="flex-1 space-y-2 overflow-y-auto py-4">
                {messages.map((message) => (
                  <div key={message.id} className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", message.sender_id === session.user.id ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")}>
                    {message.body}
                    <div className="mt-1 text-[10px] opacity-70">
                      {new Date(message.created_at).toLocaleString()}
                      {message.sender_id === session.user.id && " · " + (message.read ? "Read" : "Sent")}
                    </div>
                  </div>
                ))}
                {!messages.length && <p className="text-center text-sm text-muted-foreground">No messages yet. Say hello.</p>}
              </div>
              <form className="flex gap-2 border-t pt-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                <input aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} className="h-10 flex-1 rounded-full border bg-card px-4" placeholder="Write a message" />
                <Button type="submit" disabled={!text.trim()}>Send</Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
