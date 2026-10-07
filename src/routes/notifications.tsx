import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { Card, PageHeader } from "@/features/ui/kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — UmurimoHub" },
      { name: "description", content: "Live notifications for your UmurimoHub activity." },
    ],
  }),
  component: Page,
});

function Page() {
  const { notifications, markAllRead, session } = useApp();
  const [busy, setBusy] = useState<string | null>(null);

  const markOne = async (id: string) => {
    if (!session) return;
    setBusy(id);
    try {
      const { error } = await supabase.rpc("mark_notification_read", { _notification_id: id });
      if (error) throw error;
    } catch (e) {
      toast.error((e as Error).message || "Couldn't mark notification as read.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container-page max-w-2xl py-10">
      <PageHeader
        title="Notifications"
        actions={
          <Button variant="outline" onClick={markAllRead} disabled={!notifications.some((n) => !n.read)}>
            Mark all read
          </Button>
        }
      />
      <Card className="divide-y p-0">
        {!notifications.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No notifications yet.</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={"flex items-start gap-3 px-5 py-4 " + (!n.read ? "bg-muted/20" : "")}>
              {!n.read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" /> : <span className="mt-2 size-2 shrink-0" />}
              <div className="min-w-0 flex-1">
                {n.link ? (
                  <Link to={n.link as never} className="text-sm hover:underline">{n.text}</Link>
                ) : (
                  <span className="text-sm">{n.text}</span>
                )}
                <div className="mt-1 text-xs text-muted-foreground">{n.at}</div>
              </div>
              {!n.read && (
                <Button size="sm" variant="ghost" disabled={busy === n.id} onClick={() => void markOne(n.id)}>
                  {busy === n.id ? "…" : "Mark read"}
                </Button>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
