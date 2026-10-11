import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, MapPin, MessageSquare, Star, Briefcase, Users, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rwf } from "@/features/data/demo";
import { catalogQuery, useCatalog } from "@/features/data/catalog";
import { ConnectButton } from "@/features/network/connect-button";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, Card, DemoNotice, Pill, TrustMeter } from "@/features/ui/kit";
import { EmploymentOffer } from "@/features/recruitment/employment-offer";

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
  const { getTeam, getWorker, workerUserIds, businesses } = useCatalog();
  const { user } = useApp();
  const w = getWorker(loaded.id) ?? loaded;
  const nav = useNavigate();
  const detailQ = useQuery({
    queryKey: ["worker-detail", w.id, workerUserIds[w.id]],
    enabled: !!workerUserIds[w.id],
    queryFn: async () => {
      const uid = workerUserIds[w.id]!;
      const [experiences, trainingExperiences, connections, teams] = await Promise.all([
        supabase.from("verified_experiences").select("id,title,scope,completed_at,amount_rwf,business_id,team_id").eq("worker_id", w.id).order("completed_at", { ascending: false }),
        supabase.from("training_experiences").select("id,training_id,title,description,skills,completed_at,provider_user_id").eq("worker_id", w.id).order("completed_at", { ascending: false }),
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
      const [profiles, connectionWorkers] = await Promise.all([
        otherIds.length
          ? supabase.from("profiles").select("id,display_name,avatar_url").in("id", otherIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string; avatar_url: string | null }[] }),
        otherIds.length
          ? supabase.from("worker_profiles").select("id,user_id,name,avatar_url").in("user_id", otherIds)
          : Promise.resolve({ data: [] as { id: string; user_id: string | null; name: string; avatar_url: string | null }[] }),
      ]);
      return { experiences: experiences.data ?? [], trainingExperiences: trainingExperiences.data ?? [], connections: connections.data ?? [], profiles: profiles.data ?? [], connectionWorkers: connectionWorkers.data ?? [], businesses: businessRows.data ?? [], teams: teamRows.data ?? [] };
    },
  });
  const employmentQ = useQuery({
    queryKey: ["worker-employment", w.id, workerUserIds[w.id]],
    enabled: !!workerUserIds[w.id],
    queryFn: async () => {
      const workerUserId = workerUserIds[w.id]!;
      const [active, offers] = await Promise.all([
        supabase.from("company_employments").select("id,business_id,position_name,employment_type,started_at,status").eq("worker_id", w.id).eq("status", "active").order("started_at", { ascending: false }),
        user?.id === workerUserId
          ? supabase.from("employment_offers").select("id,business_id,position_name,employment_type,details,status,created_at").eq("worker_user_id", workerUserId).eq("status", "pending").order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as { id: string; business_id: string; position_name: string; employment_type: string; details: string; status: string; created_at: string }[] }),
      ]);
      return { active: active.data ?? [], offers: offers.data ?? [] };
    },
  });
  const respondToOffer = async (offerId: string, decision: "accepted" | "declined") => {
    const { error } = await supabase.rpc("respond_to_employment_offer", { _offer_id: offerId, _decision: decision });
    if (error) { toast.error(error.message); return; }
    toast.success(decision === "accepted" ? "Employment accepted. Your profile now shows this position." : "Offer declined.");
    await employmentQ.refetch();
  };

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
              <span className="font-semibold text-primary">{detailQ.data?.experiences.length ?? 0} completed projects</span>
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
          {user && user.businessIds.length > 0 && user.id !== workerUserIds[w.id] && <EmploymentOffer workerId={w.id} workerUserId={workerUserIds[w.id] ?? null} />}
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
            <h2 className="font-bold">Training experience</h2>
            {!detailQ.data?.trainingExperiences.length ? (
              <p className="mt-2 text-sm text-muted-foreground">No completed training recorded yet.</p>
            ) : (
              <ul className="mt-3 divide-y">
                {detailQ.data.trainingExperiences.map((x) => (
                  <li key={x.id} className="py-3">
                    <p className="font-medium">{x.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{x.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Completed {new Date(x.completed_at).toLocaleDateString()}</p>
                    {!!x.skills?.length && <div className="mt-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skills acquired</p><ul className="mt-2 flex flex-wrap gap-2">{x.skills.map((skill: string) => <li key={skill} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs"><CheckCircle2 className="size-3.5 text-primary" />{skill}</li>)}</ul></div>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="font-bold">Employment</h2>
            {!employmentQ.data?.active.length && !employmentQ.data?.offers.length ? <p className="mt-2 text-sm text-muted-foreground">No current company positions recorded.</p> : <div className="mt-3 divide-y">
              {employmentQ.data?.active.map((employment) => { const company = businesses.find((b) => b.id === employment.business_id); return <div key={employment.id} className="py-3"><p className="font-semibold">{employment.position_name}</p><p className="text-sm text-muted-foreground">{company?.name ?? "Company"} · {employment.employment_type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">Since {new Date(employment.started_at).toLocaleDateString()}</p>{company && <Link to="/business/$id" params={{ id: company.id }} className="mt-2 inline-block text-sm text-primary hover:underline">View company</Link>}</div>; })}
              {user?.id === workerUserIds[w.id] && employmentQ.data?.offers.map((offer) => { const company = businesses.find((b) => b.id === offer.business_id); return <div key={offer.id} className="py-3"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Employment offer</p><p className="mt-1 font-semibold">{offer.position_name}</p><p className="text-sm text-muted-foreground">{company?.name ?? "Company"} · {offer.employment_type.replaceAll("_", " ")}</p>{offer.details && <p className="mt-2 text-sm">{offer.details}</p>}<div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void respondToOffer(offer.id, "accepted")}>Accept offer</Button><Button size="sm" variant="outline" onClick={() => void respondToOffer(offer.id, "declined")}>Decline</Button></div></div>; })}
            </div>}
          </Card>
          <Card>
            <h2 className="font-bold">Past verified projects</h2>
            {detailQ.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading projects…</p> : detailQ.isError ? <p className="mt-2 text-sm text-destructive">Could not load projects. Please try again.</p> : !detailQ.data?.experiences.length ? <p className="mt-2 text-sm text-muted-foreground">No verified projects yet.</p> : <ul className="mt-3 divide-y">{detailQ.data.experiences.map((x) => { const business = detailQ.data?.businesses.find((b) => b.id === x.business_id); const team = x.team_id ? detailQ.data?.teams.find((t) => t.id === x.team_id) : undefined; return <li key={x.id} className="py-3"><p className="font-medium">{x.title}</p><p className="mt-1 text-sm text-muted-foreground">{x.scope}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Completed {x.completed_at ? new Date(x.completed_at).toLocaleDateString() : "date not recorded"}</span>{x.amount_rwf != null && <span>· {rwf(x.amount_rwf)}</span>}</div><div className="mt-2 flex flex-wrap gap-2">{business && <Link to="/businesses/$id" params={{ id: business.id }} className="inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs hover:bg-muted"><Avatar initials={business.name.slice(0,2).toUpperCase()} src={business.avatar_url} alt={business.name} size="sm" />{business.name}</Link>}{team && <Link to="/teams/$id" params={{ id: team.id }} className="inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs hover:bg-muted"><Avatar initials={team.name.slice(0,2).toUpperCase()} src={team.avatar_url} alt={team.name} size="sm" />{team.name}</Link>}</div><p className="mt-1 text-xs text-muted-foreground">{new Date(x.completed_at).toLocaleDateString()} · {rwf(x.amount_rwf)}</p></li>; })}</ul>}
          </Card>
          <Card>
            <h2 className="flex items-center gap-2 font-bold">
              <Users className="size-4" />
              Connections
            </h2>
            {detailQ.isLoading ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading connections…</p>
            ) : !detailQ.data?.connections.length ? (
              <p className="mt-2 text-sm text-muted-foreground">No accepted connections yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-3">
                {detailQ.data.connections.map((x) => {
                  const uid = workerUserIds[w.id];
                  const other = detailQ.data?.profiles.find(
                    (p) => p.id === (x.requester === uid ? x.addressee : x.requester),
                  );
                  const otherWorker = detailQ.data?.connectionWorkers.find((worker) => worker.user_id === other?.id);
                  return otherWorker ? (
                    <Link
                      key={x.id}
                      to="/workers/$id"
                      params={{ id: otherWorker.id }}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted"
                    >
                      <Avatar
                        initials={(otherWorker.name ?? other?.display_name ?? "U").slice(0, 2).toUpperCase()}
                        src={otherWorker.avatar_url ?? other?.avatar_url}
                        alt={otherWorker.name ?? other?.display_name ?? "Connection"}
                        size="sm"
                      />
                      {otherWorker.name ?? other?.display_name ?? "Connection"}
                    </Link>
                  ) : (
                    <span key={x.id} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                      <Avatar
                        initials={(other?.display_name ?? "U").slice(0, 2).toUpperCase()}
                        src={other?.avatar_url}
                        alt={other?.display_name ?? "Connection"}
                        size="sm"
                      />
                      {other?.display_name ?? "Connection"}
                    </span>
                  );
                })}
              </div>
            )}
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

