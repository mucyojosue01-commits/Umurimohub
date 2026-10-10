import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, CheckCircle2, Wallet, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { MyApplications, MyOpportunities, TeamInvites } from "@/features/dashboard/panels";
import { ContractsPanel, useContracts } from "@/features/contracts/panels";
import { Avatar, Card, OpportunityCard, PageHeader, Stat } from "@/features/ui/kit";
import { useCatalog } from "@/features/data/catalog";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — UmurimoHub" },
      { name: "description", content: "Your applications, projects and payments." },
      { property: "og:title", content: "Dashboard — UmurimoHub" },
      { property: "og:description", content: "Your work at a glance." },
    ],
  }),
  component: Page,
});

function Page() {
  const { user, applications, allOpps, authReady } = useApp();
  const contractsQuery = useContracts();
  const { businesses, teams } = useCatalog();
  const [menu, setMenu] = useState<string | null>(null);
  if (!authReady)
    return <div className="container-page py-20 text-center text-muted-foreground">Loading…</div>;
  if (!user)
    return (
      <div className="container-page py-20 text-center">
        <p>Please sign in to see your dashboard.</p>
        <Button className="mt-4" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  if (!user.onboarded)
    return (
      <div className="container-page py-20 text-center">
        <p>Finish setting up your profile to use your dashboard.</p>
        <Button className="mt-4" asChild>
          <Link to="/register">Complete profile</Link>
        </Button>
      </div>
    );
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow={user.roles.map((r) => r.replace("_", " ")).join(" · ") + " dashboard"} title={"Muraho, " + user.name.split(" ")[0]} />
      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={Briefcase} label="Applications" value={String(applications.length)} />
        <Stat icon={CheckCircle2} label="Contracts & projects" value={String(contractsQuery.data?.length ?? 0)} />
        <Stat icon={Wallet} label="Payment status" value="Not enabled yet" hint="Payments come after project verification." />
      </div>
      <TeamInvites />
      <MyOpportunities />
      <MyApplications />
      <ContractsPanel />
            <Card className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-bold">My businesses & teams</h2><p className="mt-1 text-sm text-muted-foreground">Manage the entities you own from one place.</p></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" asChild><a href="/register?create=business">+ Business</a></Button><Button size="sm" variant="outline" asChild><a href="/register?create=team">+ Team</a></Button></div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Businesses</p>
            {businesses.filter((b) => user.businessIds.includes(b.id)).length ? businesses.filter((b) => user.businessIds.includes(b.id)).map((b) => (
              <div key={b.id} className="relative flex items-center gap-3 rounded-xl border p-3 transition hover:border-primary/40 hover:bg-muted/40">
                <a href={"/company/" + b.id} className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Avatar initials={b.name.slice(0,2).toUpperCase()} src={b.avatarUrl} alt={b.name} size="sm" />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{b.name}</p><p className="text-xs text-muted-foreground">{b.district} · {b.sector}</p></div>
                </a>
                <Button size="icon" variant="ghost" aria-label={"Business actions for " + b.name} onClick={() => setMenu(menu === "b:" + b.id ? null : "b:" + b.id)}><MoreVertical className="size-4" /></Button>
                {menu === "b:" + b.id && <div className="absolute right-2 top-12 z-30 w-44 rounded-2xl border bg-popover p-1 shadow-xl">
                  <a href={"/businesses/" + b.id} className="block rounded-xl px-3 py-2 text-sm hover:bg-muted" onClick={() => setMenu(null)}>View profile</a>
                  <a href={"/company/" + b.id + "/edit"} className="block rounded-xl px-3 py-2 text-sm hover:bg-muted" onClick={() => setMenu(null)}>Edit business</a>
                  <button className="block w-full rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-muted" onClick={async () => { setMenu(null); if (!window.confirm("Delete this business? This may be blocked if it has opportunities or contracts.")) return; const { error } = await supabase.from("businesses").delete().eq("id", b.id); if (error) toast.error("This business cannot be deleted while dependent work exists."); else { toast.success("Business deleted"); window.location.reload(); } }}>Delete business</button>
                </div>}
              </div>
            )) : <p className="text-sm text-muted-foreground">No businesses yet.</p>}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teams</p>
            {teams.filter((t) => user.leadTeamIds.includes(t.id)).length ? teams.filter((t) => user.leadTeamIds.includes(t.id)).map((t) => (
              <div key={t.id} className="relative flex items-center gap-3 rounded-xl border p-3">
                <Avatar initials={t.name.slice(0,2).toUpperCase()} src={t.avatarUrl} alt={t.name} size="sm" />
                <Link to="/teams/$id" params={{ id: t.id }} className="min-w-0 flex-1"><p className="truncate font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{t.sector} · {t.memberIds.length} members</p></Link>
                <Button size="icon" variant="ghost" aria-label="Team actions" onClick={() => setMenu(menu === "t:" + t.id ? null : "t:" + t.id)}><MoreVertical className="size-4" /></Button>
                {menu === "t:" + t.id && <div className="absolute right-2 top-12 z-30 w-40 rounded-2xl border bg-popover p-1 shadow-xl">
                  <Link to="/teams/$id" params={{ id: t.id }} className="block rounded-xl px-3 py-2 text-sm hover:bg-muted" onClick={() => setMenu(null)}>Info</Link>
                  <Link to="/teams/$id" params={{ id: t.id }} search={{ edit: true }} className="block rounded-xl px-3 py-2 text-sm hover:bg-muted" onClick={() => setMenu(null)}>Edit</Link>
                  <button className="block w-full rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-muted" onClick={async () => { setMenu(null); if (!window.confirm("Delete this team?")) return; const { error } = await supabase.from("teams").delete().eq("id", t.id); if (error) toast.error("This team cannot be deleted while it has dependent work or members."); else { toast.success("Team deleted"); window.location.reload(); } }}>Delete</button>
                </div>}
              </div>
            )) : <p className="text-sm text-muted-foreground">No teams yet.</p>}
          </div>
        </div>
      </Card>
      <h2 className="mt-10 text-xl font-bold">Recommended for you</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allOpps.filter((o) => o.createdBy !== user.id && !user.businessIds.includes(o.businessId)).slice(0, 3).map((o) => (
          <OpportunityCard key={o.id} o={o} />
        ))}
      </div>
    </div>
  );
}
