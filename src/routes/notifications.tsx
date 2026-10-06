import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { Card, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — UmurimoHub" }, { name: "description", content: "Matches, invitations, payments and recommendations." }, { property: "og:title", content: "Notifications — UmurimoHub" }, { property: "og:description", content: "Stay on top of your work." }] }),
  component: Page,
});

function Page() {
  const { notifications, markAllRead } = useApp();
  return (
    <div className="container-page max-w-2xl py-10">
      <PageHeader title="Notifications" actions={<Button variant="outline" onClick={markAllRead}>Mark all read</Button>} />
      <Card className="divide-y p-0">{notifications.map((n) => <div key={n.id} className="flex items-center gap-3 px-5 py-4">{!n.read && <span className="size-2 rounded-full bg-accent" />}<span className="flex-1 text-sm">{n.text}</span><span className="text-xs text-muted-foreground">{n.at}</span></div>)}</Card>
    </div>
  );
}
