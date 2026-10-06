import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, Calendar, Clock, MapPin, Users, Wallet, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OPPORTUNITIES, TEAMS, getBusiness, rwf } from "@/features/data/demo";
import { useApp, type Application } from "@/features/store/app-store";
import { Card, DemoNotice, Pill } from "@/features/ui/kit";

export const Route = createFileRoute("/opportunities/$id")({
  head: ({ params }) => {
    const o = OPPORTUNITIES.find((x) => x.id === params.id);
    const t = o ? `${o.title} — UmurimoHub` : "Opportunity — UmurimoHub";
    return { meta: [{ title: t }, { name: "description", content: o?.summary ?? "Opportunity details" }, { property: "og:title", content: t }, { property: "og:description", content: o?.summary ?? "Opportunity details" }] };
  },
  component: Page,
  notFoundComponent: () => <div className="container-page py-20 text-center">Opportunity not found. <Link to="/opportunities" className="text-primary">Browse all</Link></div>,
});

function Page() {
  const { id } = Route.useParams();
  const { allOpps, apply, applications, user } = useApp();
  const o = allOpps.find((x) => x.id === id);
  const [kind, setKind] = useState<Application["kind"] | null>(null);
  const [note, setNote] = useState("");
  if (!o) throw notFound();
  const b = getBusiness(o.businessId);
  const applied = applications.find((a) => a.oppId === o.id);

  return (
    <div className="container-page py-10">
      <Link to="/opportunities" className="text-sm text-muted-foreground hover:text-foreground">← Opportunities</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="flex flex-wrap gap-2"><Pill tone="primary">{o.type}</Pill><Pill>{o.sector}</Pill>{o.teamAllowed && <Pill tone="accent"><Users className="size-3" />Team of {o.teamSize}</Pill>}</div>
          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">{o.title}</h1>
          <p className="mt-2 flex items-center gap-1 text-muted-foreground">{b?.name}{b?.verified && <BadgeCheck className="size-4 text-primary" />} · rated {b?.rating}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[[Wallet, `${rwf(o.payRwf)} / ${o.payUnit}`], [MapPin, `${o.district} · ${o.mode}`], [Clock, o.duration], [Calendar, `Apply by ${o.deadline}`]].map(([I, t], i) => { const Icon = I as typeof Wallet; return <Card key={i} className="p-4"><Icon className="size-4 text-primary" /><div className="mt-2 text-sm font-semibold">{t as string}</div></Card>; })}
          </div>
          <section className="mt-8"><h2 className="text-lg font-bold">About this opportunity</h2><p className="mt-2 text-muted-foreground">{o.summary}</p></section>
          <section className="mt-6"><h2 className="text-lg font-bold">Responsibilities</h2><ul className="mt-2 space-y-2">{o.responsibilities.map((r) => <li key={r} className="flex gap-2 text-sm"><CheckCircle2 className="size-4 text-primary" />{r}</li>)}</ul></section>
          <section className="mt-6"><h2 className="text-lg font-bold">Requirements</h2><ul className="mt-2 space-y-2">{o.requirements.map((r) => <li key={r} className="flex gap-2 text-sm"><CheckCircle2 className="size-4 text-muted-foreground" />{r}</li>)}</ul></section>
          <section className="mt-6"><h2 className="text-lg font-bold">Skills</h2><div className="mt-2 flex flex-wrap gap-2">{o.skills.map((s) => <Pill key={s}>{s}</Pill>)}</div></section>
          <DemoNotice className="mt-8" />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            {applied ? (
              <div className="text-center"><CheckCircle2 className="mx-auto size-8 text-success" /><p className="mt-2 font-semibold">Applied ({applied.kind})</p><p className="text-sm text-muted-foreground">Status: {applied.status}</p><Button variant="outline" className="mt-4 w-full" asChild><Link to="/dashboard">Track in dashboard</Link></Button></div>
            ) : (
              <div className="space-y-2">
                <Button className="w-full" size="lg" onClick={() => setKind("Individual")}>Apply</Button>
                {o.teamAllowed && <Button className="w-full" variant="accent" size="lg" onClick={() => setKind("Team")}><Users />Apply as team</Button>}
                <Button className="w-full" variant="outline" onClick={() => setKind("Referral")}>Refer someone you trust</Button>
                {!user && <p className="pt-1 text-center text-xs text-muted-foreground"><Link to="/login" className="text-primary">Sign in</Link> to save your application history.</p>}
              </div>
            )}
          </Card>
          <Card><h3 className="text-sm font-semibold">Your network here</h3><p className="mt-2 text-sm text-muted-foreground">2 people you know have worked with {b?.name}. Jean Bosco H. completed a verified project with them.</p></Card>
        </aside>
      </div>

      <Dialog open={!!kind} onOpenChange={(v) => !v && setKind(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>{kind === "Team" ? "Apply as a team" : kind === "Referral" ? "Refer a trusted person" : "Apply"}</DialogTitle></DialogHeader>
          {kind === "Team" && <label className="text-sm">Team<select className="mt-1 h-10 w-full rounded-xl border bg-card px-3">{TEAMS.map((t) => <option key={t.id}>{t.name}</option>)}</select></label>}
          <label className="text-sm">{kind === "Referral" ? "Who and why?" : "Short note to the employer"}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border bg-card p-3" placeholder={kind === "Referral" ? "Name, phone, and how you've worked together" : "Your relevant experience and availability"} /></label>
          <Button onClick={() => { apply({ oppId: o.id, kind: kind!, note }); toast.success("Application sent"); setKind(null); setNote(""); }}>Submit</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
