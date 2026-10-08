import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, MapPin, MessageSquare, Star, Briefcase, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rwf } from "@/features/data/demo";
import { catalogQuery, useCatalog } from "@/features/data/catalog";
import { ConnectButton } from "@/features/network/connect-button";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, Card, DemoNotice, Pill, TrustMeter } from "@/features/ui/kit";

export const Route = createFileRoute("/workers/$id")({
  loader: async ({ params, context }) => {
    const c = await context.queryClient.ensureQueryData(catalogQuery);
    const w = c.workers.find((x) => x.id === params.id);
    if (!w) throw notFound();
    return { w };
  },
  head: ({ loaderData }) => {
    const t = loaderData
      ? `${loaderData.w.name} — ${loaderData.w.title} | UmurimoHub`
      : "Worker — UmurimoHub";
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData?.w.bio ?? "Worker profile" },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData?.w.bio ?? "Worker profile" },
      ],
    };
  },
  component: Page,
  errorComponent: () => (
    <div className="container-page py-20 text-center">Couldn't load this profile.</div>
  ),
  notFoundComponent: () => (
    <div className="container-page py-20 text-center">
      Worker not found.{" "}
      <Link to="/workers" className="text-primary">
        Browse workers
      </Link>
    </div>
  ),
});

const vTone = {
  "Self-declared": "muted",
  Certificate: "primary",
  Assessment: "primary",
  Employer: "success",
  Platform: "success",
} as const;

function Page() {
  const { w: loaded } = Route.useLoaderData();
  const { getTeam, getWorker, workerUserIds } = useCatalog();
  const w = getWorker(loaded.id) ?? loaded;
  const { send } = useApp();
  const nav = useNavigate();
  const detailQ = useQuery({
    queryKey: ["worker-detail", w.id, workerUserIds[w.id]],
    enabled: !!workerUserIds[w.id],
    queryFn: async () => {
      const uid = workerUserIds[w.id]!;
      const [experiences, connections, teams] = await Promise.all([
        supabase.from("verified_experiences").select("id,title,scope,completed_at,amount_rwf,business_id,team_id").eq("worker_id", w.id).order("completed_at", { ascending: false }),
        supabase.from("connections").select("*").or("requester.eq." + uid + ",addressee.eq." + uid).eq("status", "accepted"),
        supabase.from("team_members").select("team_id,role,status").eq("worker_id", w.id).eq("status", "active"),
      ]);
      const businessIds = [] as string[];
      const teamIds = [...new Set([...(teams.data ?? []).map((x) => x.team_id), ...(experiences.data ?? []).map((x) => x.team_id).filter(Boolean)])];
      const experienceBusinessIds = [...new Set((experiences.data ?? []).map((x) => x.business_id).filter(Boolean))];
      const allBusinessIds = [...new Set([...businessIds, ...experienceBusinessIds])];
      const [businessRows, teamRows] = await Promise.all([
        allBusinessIds.length ? supabase.from("businesses").select("id,name,avatar_url").in("id", allBusinessIds) : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null }[] }),
        teamIds.length ? supabase.from("teams").select("id,name,avatar_url").in("id", teamIds) : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null }[] }),
      ]);
      const otherIds = (connections.data ?? []).map((x) => x.requester === uid ? x.addressee : x.requester);
      const profiles = otherIds.length
        ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", otherIds)
        : { data: [] as { id: string; display_name: string; avatar_url: string | null }[] };
      return { experiences: experiences.data ?? [], connections: connections.data ?? [], profiles: profiles.data ?? [], businesses: businessRows.data ?? [], teams: teamRows.data ?? [] };
    },
  });
  return (
    <div className="container-page py-10">
      <Card className="p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <Avatar initials={w.initials} src={w.avatarUrl} alt={w.name} size="lg" />
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-3xl font-extrabold">
              {w.name}
              {w.verified && <BadgeCheck className="size-6 text-primary" />}
            </h1>
            <p className="text-muted-foreground">{w.title}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-1">
                <MapPin className="size-4" />
                {w.district}
              </span>
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-accent text-accent" />
                {w.rating} · {w.reviews} reviews
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="size-4" />
                {w.years} yrs
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                const targetUser = workerUserIds[w.id];
                if (!targetUser) {
                  toast.error("This member is not available for messaging yet.");
                  return;
                }
                nav({ to: "/messages", search: { user: targetUser } });
              }}
            >
              <MessageSquare />
              Message
            </Button>
            <ConnectButton userId={workerUserIds[w.id] ?? null} name={w.name} />
            <Button onClick={() => toast.success(`Invitation sent to ${w.name}`)}>
              Invite to opportunity
            </Button>
          </div>
        </div>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="font-bold">About</h2>
            <p className="mt-2 text-muted-foreground">{w.bio}</p>
            <p className="mt-3 font-semibold">
              {rwf(w.rateRwf)} / {w.rateUnit} ·{" "}
              {w.available ? (
                <span className="text-success">Available now</span>
              ) : (
                "Currently booked"
              )}
            </p>
          </Card>
          <Card>
            <h2 className="font-bold">Skills & verification</h2>
            <ul className="mt-3 divide-y">
              {w.skills.map((s) => (
                <li key={s.name} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.level}</div>
                  </div>
                  <Pill tone={vTone[s.verification]}>{s.verification}</Pill>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-bold">Past verified projects</h2>
            {detailQ.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading projects…</p> : detailQ.isError ? <p className="mt-2 text-sm text-destructive">Could not load projects. Please try again.</p> : !detailQ.data?.experiences.length ? <p className="mt-2 text-sm text-muted-foreground">No verified projects yet.</p> : <ul className="mt-3 divide-y">{detailQ.data.experiences.map((x) => { const business = detailQ.data?.businesses.find((b) => b.id === x.business_id); const team = x.team_id ? detailQ.data?.teams.find((t) => t.id === x.team_id) : undefined; return <li key={x.id} className="py-3"><p className="font-medium">{x.title}</p><p className="text-sm text-muted-foreground">{x.scope}</p><div className="mt-2 flex flex-wrap gap-2">{business && <Link to="/businesses/$id" params={{ id: business.id }} className="inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs hover:bg-muted"><Avatar initials={business.name.slice(0,2).toUpperCase()} src={business.avatar_url} alt={business.name} size="sm" />{business.name}</Link>}{team && <Link to="/teams/$id" params={{ id: team.id }} className="inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs hover:bg-muted"><Avatar initials={team.name.slice(0,2).toUpperCase()} src={team.avatar_url} alt={team.name} size="sm" />{team.name}</Link>}</div><p className="mt-1 text-xs text-muted-foreground">{new Date(x.completed_at).toLocaleDateString()} · {rwf(x.amount_rwf)}</p></li>; })}</ul>}
          </Card>
          <Card>
            <h2 className="flex items-center gap-2 font-bold"><Users className="size-4" />Connections</h2>
            {detailQ.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading connections…</p> : !detailQ.data?.connections.length ? <p className="mt-2 text-sm text-muted-foreground">No accepted connections yet.</p> : <div className="mt-3 flex flex-wrap gap-3">{detailQ.data.connections.map((x) => { const uid = workerUserIds[w.id]; const other = detailQ.data?.profiles.find((p) => p.id === (x.requester === uid ? x.addressee : x.requester)); return <div key={x.id} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><Avatar initials={(other?.display_name ?? "U").slice(0,2).toUpperCase()} src={other?.avatar_url} alt={other?.display_name ?? "Connection"} size="sm" />{other?.display_name ?? "Connection"}</div>; })}</div>}
          </Card>
          <Card>
            <h2 className="font-bold">Teams & companies</h2>
            <div className="mt-3 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teams</p>
                <div className="mt-2 flex flex-wrap gap-2">{(detailQ.data?.teams ?? []).length ? detailQ.data?.teams.map((t) => <Link key={t.id} to="/teams/$id" params={{ id: t.id }} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted"><Avatar initials={t.name.slice(0,2).toUpperCase()} src={t.avatar_url} alt={t.name} size="sm" />{t.name}</Link>) : <span className="text-sm text-muted-foreground">No team history yet.</span>}</div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Companies worked with</p>
                <div className="mt-2 flex flex-wrap gap-2">{(detailQ.data?.businesses ?? []).length ? detailQ.data?.businesses.map((b) => <Link key={b.id} to="/businesses/$id" params={{ id: b.id }} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted"><Avatar initials={b.name.slice(0,2).toUpperCase()} src={b.avatar_url} alt={b.name} size="sm" />{b.name}</Link>) : <span className="text-sm text-muted-foreground">No company history yet.</span>}</div>
              </div>
            </div>
          </Card>
          <DemoNotice />
        </div>
        <Card>
          <TrustMeter w={w} />
        </Card>
      </div>
    </div>
  );
}
