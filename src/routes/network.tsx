import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/store/app-store";
import { Card, PageHeader, Pill } from "@/features/ui/kit";

export const Route = createFileRoute("/network")({
  head: () => ({ meta: [{ title: "My trusted network — UmurimoHub" }, { name: "description", content: "Connections, referrals and recommendations from people you've worked with." }, { property: "og:title", content: "Trusted network — UmurimoHub" }, { property: "og:description", content: "Your connections and referrals." }] }),
  component: Page,
});

function Page() {
  const { session, authReady } = useApp();
  const qc = useQueryClient();
  const me = session?.user.id;
  const q = useQuery({
    queryKey: ["network", me], enabled: !!me,
    queryFn: async () => {
      const [c, r] = await Promise.all([
        supabase.from("connections").select("*").order("created_at", { ascending: false }),
        supabase.from("referrals").select("*").order("created_at", { ascending: false }),
      ]);
      return { connections: c.data ?? [], referrals: r.data ?? [] };
    },
  });
  if (!authReady) return <div className="container-page py-20 text-center text-muted-foreground">Loading…</div>;
  if (!me) return <div className="container-page py-20 text-center"><p>Sign in to see your trusted network.</p><Button className="mt-4" asChild><Link to="/login">Sign in</Link></Button></div>;
  const respond = async (id: string, status: "accepted" | "blocked") => {
    const { error } = await supabase.from("connections").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(status === "accepted" ? "Connected" : "Declined"); void qc.invalidateQueries({ queryKey: ["network"] }); }
  };
  const cons = q.data?.connections ?? [];
  return (
    <div className="container-page max-w-3xl py-10">
      <PageHeader eyebrow="Trust" title="My trusted network" desc="Connect with people you've worked with. Connections unlock recommendations and referrals." />
      <Card><h2 className="font-bold">Connections</h2>
        {!cons.length ? <p className="mt-2 text-sm text-muted-foreground">No connections yet. Open a <Link to="/workers" className="text-primary">worker profile</Link> and tap Connect.</p> :
          <ul className="mt-3 divide-y">{cons.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="text-sm">{c.requester === me ? "You sent a request" : "Request received"} · {c.relation.replace("_", " ")}</span>
              <span className="flex gap-2"><Pill tone={c.status === "accepted" ? "success" : "muted"}>{c.status}</Pill>
                {c.addressee === me && c.status === "pending" && <><Button size="sm" onClick={() => respond(c.id, "accepted")}>Accept</Button><Button size="sm" variant="outline" onClick={() => respond(c.id, "blocked")}>Decline</Button></>}</span>
            </li>))}</ul>}
      </Card>
      <Card className="mt-6"><h2 className="font-bold">Referrals</h2>
        {!q.data?.referrals.length ? <p className="mt-2 text-sm text-muted-foreground">Refer someone from any opportunity page.</p> :
          <ul className="mt-3 divide-y">{q.data.referrals.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-3 text-sm"><Link to="/opportunities/$id" params={{ id: r.opportunity_id }} className="hover:text-primary">{r.referrer === me ? "You referred someone" : "You were referred"}</Link><Pill>{r.status}</Pill></li>))}</ul>}
      </Card>
    </div>
  );
}
