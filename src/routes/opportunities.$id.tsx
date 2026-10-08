import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, Calendar, Clock, MapPin, Users, Wallet, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/search-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { rwf } from "@/features/data/demo";
import { useCatalog } from "@/features/data/catalog";
import { supabase } from "@/integrations/supabase/client";
import { mapOpportunity } from "@/features/data/mappers";
import { useApp, type Application } from "@/features/store/app-store";
import { Avatar, Card, Pill } from "@/features/ui/kit";

export const Route = createFileRoute("/opportunities/$id")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", params.id)
      .eq("is_demo", false)
      .maybeSingle();
    if (error) throw error;
    return { o: data ? mapOpportunity(data) : null };
  },
  head: ({ loaderData }) => {
    const o = loaderData?.o;
    const t = o ? `${o.title} — UmurimoHub` : "Opportunity — UmurimoHub";
    return {
      meta: [
        { title: t },
        { name: "description", content: o?.summary ?? "Opportunity details" },
        { property: "og:title", content: t },
        { property: "og:description", content: o?.summary ?? "Opportunity details" },
      ],
    };
  },
  component: Page,
  errorComponent: () => (
    <div className="container-page py-20 text-center">Couldn't load this opportunity.</div>
  ),
  notFoundComponent: () => (
    <div className="container-page py-20 text-center">
      Opportunity not found.{" "}
      <Link to="/opportunities" className="text-primary">
        Browse all
      </Link>
    </div>
  ),
});

function Page() {
  const { id } = Route.useParams();
  const { allOpps, apply, refer, applications, user } = useApp();
  const { getBusiness, teams, workers, workerUserIds, businesses } = useCatalog();
  const o = allOpps.find((x) => x.id === id);
  const [teamId, setTeamId] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [refWorker, setRefWorker] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; file_name: string; storage_path: string }>>([]);
  const myTeams = user ? teams.filter((t) => user.leadTeamIds.includes(t.id)) : teams;
  useEffect(() => {
    let active = true;
    void supabase.from("opportunity_attachments").select("id,file_name,storage_path").eq("opportunity_id", id).order("created_at").then(({ data }) => {
      if (active) setAttachments(data ?? []);
    });
    return () => { active = false; };
  }, [id]);
  const [kind, setKind] = useState<Application["kind"] | null>(null);
  const [note, setNote] = useState("");
  if (!o) throw notFound();
  const b = getBusiness(o.businessId);
  const author = o.authorType === "user" ? workers.find((w) => workerUserIds[w.id] === o.createdBy) : undefined;
  const applied = applications.filter((a) => a.oppId === o.id);
  const audience = o.eligibleActorTypes ?? ["individual", "team", "business"];

  return (
    <div className="container-page py-10">
      <Link to="/opportunities" className="text-sm text-muted-foreground hover:text-foreground">
        ← Opportunities
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="primary">{o.type}</Pill>
            <Pill>{o.sector}</Pill>
            {o.teamAllowed && (
              <Pill tone="accent">
                <Users className="size-3" />
                Team of {o.teamSize}
              </Pill>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">{o.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Avatar initials={(author?.initials ?? b?.name ?? "U").slice(0, 2).toUpperCase()} src={author?.avatarUrl ?? b?.avatarUrl} alt={author?.name ?? b?.name ?? "Publisher"} size="sm" /><span>{author?.name ?? b?.name ?? "UmurimoHub member"}</span>{b?.verified && <BadgeCheck className="size-4 text-primary" />}{b && <span>· rated {b.rating}</span>}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Allowed applicants</span>
            {audience.map((type) => <Pill key={type}>{type === "individual" ? "Individuals" : type === "team" ? "Teams" : "Companies"}</Pill>)}
            <span className="text-xs text-muted-foreground">· Posted {o.posted} ago</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [Wallet, `${rwf(o.payRwf)} / ${o.payUnit}`],
              [MapPin, `${o.district} · ${o.mode}`],
              [Clock, o.duration],
              [Calendar, `Apply by ${o.deadline}`],
            ].map(([I, t], i) => {
              const Icon = I as typeof Wallet;
              return (
                <Card key={i} className="p-4">
                  <Icon className="size-4 text-primary" />
                  <div className="mt-2 text-sm font-semibold">{t as string}</div>
                </Card>
              );
            })}
          </div>
          <section className="mt-8">
            <h2 className="text-lg font-bold">About this opportunity</h2>
            <p className="mt-2 text-muted-foreground">{o.summary}</p>
          </section>
          <section className="mt-6">
            <h2 className="text-lg font-bold">Responsibilities</h2>
            <ul className="mt-2 space-y-2">
              {o.responsibilities.map((r) => (
                <li key={r} className="flex gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-primary" />
                  {r}
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-6">
            <h2 className="text-lg font-bold">Requirements</h2>
            <ul className="mt-2 space-y-2">
              {o.requirements.map((r) => (
                <li key={r} className="flex gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-muted-foreground" />
                  {r}
                </li>
              ))}
            </ul>
          </section>
          {attachments.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-bold">Attachments</h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {attachments.map((file) => (
                  <button key={file.id} className="rounded-xl border p-3 text-left text-sm hover:bg-muted" onClick={async () => {
                    const { data, error } = await supabase.storage.from("opportunity-attachments").createSignedUrl(file.storage_path, 300);
                    if (error || !data?.signedUrl) { toast.error("Couldn't open this attachment."); return; }
                    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                  }}>
                    <span className="font-medium">{file.file_name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Open attachment</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="mt-6">
            <h2 className="text-lg font-bold">Skills</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {o.skills.map((s) => (
                <Pill key={s}>{s}</Pill>
              ))}
            </div>
          </section>
            <p className="mt-8 text-xs text-muted-foreground">All opportunities shown here are published by UmurimoHub members.</p>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            {applied.length > 0 && (
              <div className="space-y-3">
                {applied.map((application) => <div key={application.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-semibold">Applied as {application.kind}</p><p className="text-sm text-muted-foreground">Status: {application.status}</p></div><CheckCircle2 className="size-5 text-success" /></div>)}
                <Button variant="outline" className="w-full" asChild><Link to="/dashboard">Track applications</Link></Button>
              </div>
            )}
            <div className="space-y-2">
              {audience.includes("individual") && !applied.some((a) => a.kind === "Individual" || a.kind === "Business") && (
                <Button className="w-full" size="lg" onClick={() => setKind("Individual")}>Apply as individual</Button>
              )}
              {audience.includes("team") && o.teamAllowed && !applied.some((a) => a.kind === "Team") && (
                <Button className="w-full" variant="accent" size="lg" onClick={() => setKind("Team")}><Users />Apply as team</Button>
              )}
              {audience.includes("business") && user?.businessIds.length && !applied.some((a) => a.kind === "Business") ? (
                <Button className="w-full" variant="outline" size="lg" onClick={() => setKind("Business")}>Apply as company</Button>
              ) : null}
              {!audience.includes("individual") && !audience.includes("team") && !audience.includes("business") && <p className="text-sm text-muted-foreground">This opportunity has no eligible applicant type configured.</p>}
              <Button className="w-full" variant="outline" onClick={() => setKind("Referral")}>Refer someone you trust</Button>
              {!user && <p className="pt-1 text-center text-xs text-muted-foreground"><Link to="/login" className="text-primary">Sign in</Link> to apply for this opportunity.</p>}
            </div>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold">Your network here</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Refer someone you've worked with — referrals are recorded in your trusted network.{" "}
              <Link to="/network" className="text-primary">
                View network
              </Link>
            </p>
          </Card>
        </aside>
      </div>

      <Dialog open={!!kind} onOpenChange={(v) => !v && setKind(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {kind === "Team"
                ? "Apply as a team"
                : kind === "Business"
                  ? "Apply as company"
                  : kind === "Referral"
                  ? "Refer a trusted person"
                  : "Apply"}
            </DialogTitle>
          </DialogHeader>
          {kind === "Team" &&
            (user && !myTeams.length ? (
              <p className="text-sm text-muted-foreground">
                Only team leaders can apply as a team.{" "}
                <Link to="/register" className="text-primary">
                  Create a team
                </Link>
              </p>
            ) : (
              <label className="text-sm">
                Team
                <SearchSelect
                  value={teamId}
                  onChange={setTeamId}
                  options={myTeams.map((t) => ({ value: t.id, label: t.name, description: t.areas.join(", "), avatarUrl: t.avatarUrl, initials: t.name.slice(0, 2).toUpperCase() }))}
                  placeholder="Search your team…"
                />
              </label>
            ))}
          {kind === "Business" && user && <label className="text-sm">Company
            <SearchSelect
              value={businessId}
              onChange={setBusinessId}
              options={businesses.filter((b) => user.businessIds.includes(b.id)).map((b) => ({ value: b.id, label: b.name, description: b.district + " · " + b.sector, avatarUrl: b.avatarUrl, initials: b.name.slice(0, 2).toUpperCase() }))}
              placeholder="Search your company…"
            />
          </label>}
          {kind === "Referral" &&
            (user ? (
              <label className="text-sm">
                Person you trust
                <SearchSelect
                  value={refWorker}
                  onChange={setRefWorker}
                  options={workers.filter((w) => workerUserIds[w.id] && w.id !== user.workerId).map((w) => ({ value: w.id, label: w.name, description: w.title + " · " + w.district, avatarUrl: w.avatarUrl, initials: w.initials }))}
                  placeholder="Search a registered worker…"
                />
              </label>
            ) : (
              <p className="text-sm text-muted-foreground">
                <Link to="/login" className="text-primary">
                  Sign in
                </Link>{" "}
                to refer someone from your network.
              </p>
            ))}
          <label className="text-sm">
            {kind === "Referral" ? "Who and why?" : "Short note to the employer"}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl border bg-card p-3"
              placeholder={
                kind === "Referral"
                  ? "Name, phone, and how you've worked together"
                  : "Your relevant experience and availability"
              }
            />
          </label>
          <Button
            disabled={
              busy || (kind === "Referral" && (!user || !refWorker)) || (kind === "Team" && !teamId)
            }
            onClick={async () => {
              setBusy(true);
              const r =
                kind === "Referral"
                  ? await refer(o.id, refWorker, note)
                  : await apply({
                      oppId: o.id,
                      kind: kind!,
                      note,
                      teamId: kind === "Team" && user ? teamId : null,
                      businessId: kind === "Business" && user ? businessId : null,
                    });
              setBusy(false);
              if (!r.ok) {
                toast.error(r.error ?? "Couldn't submit");
                return;
              }
              toast.success(
                kind === "Referral"
                  ? "Referral sent"
                  : user
                    ? "Application sent"
                    : "Application sent",
              );
              setKind(null);
              setNote("");
              setRefWorker("");
              setTeamId("");
              setBusinessId("");
            }}
          >
            {busy ? "Sending…" : "Submit"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
