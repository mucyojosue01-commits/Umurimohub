import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, MapPin, MessageSquare, Star, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WORKERS, getTeam, rwf } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { Avatar, Card, DemoNotice, Pill, TrustMeter } from "@/features/ui/kit";

export const Route = createFileRoute("/workers/$id")({
  loader: ({ params }) => { const w = WORKERS.find((x) => x.id === params.id); if (!w) throw notFound(); return { w }; },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.w.name} — ${loaderData.w.title} | UmurimoHub` : "Worker — UmurimoHub";
    return { meta: [{ title: t }, { name: "description", content: loaderData?.w.bio ?? "Worker profile" }, { property: "og:title", content: t }, { property: "og:description", content: loaderData?.w.bio ?? "Worker profile" }] };
  },
  component: Page,
  errorComponent: () => <div className="container-page py-20 text-center">Couldn't load this profile.</div>,
  notFoundComponent: () => <div className="container-page py-20 text-center">Worker not found. <Link to="/workers" className="text-primary">Browse workers</Link></div>,
});

const vTone = { "Self-declared": "muted", Certificate: "primary", Assessment: "primary", Employer: "success", Platform: "success" } as const;

function Page() {
  const { w } = Route.useLoaderData();
  const { send } = useApp();
  const nav = useNavigate();
  return (
    <div className="container-page py-10">
      <Card className="p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <Avatar initials={w.initials} size="lg" />
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-3xl font-extrabold">{w.name}{w.verified && <BadgeCheck className="size-6 text-primary" />}</h1>
            <p className="text-muted-foreground">{w.title}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm"><span className="flex items-center gap-1"><MapPin className="size-4" />{w.district}</span><span className="flex items-center gap-1"><Star className="size-4 fill-accent text-accent" />{w.rating} · {w.reviews} reviews</span><span className="flex items-center gap-1"><Briefcase className="size-4" />{w.years} yrs</span></div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => { send(w.name, `Hello ${w.name.split(" ")[0]}, I'd like to discuss work.`); nav({ to: "/messages" }); }}><MessageSquare />Message</Button>
            <Button onClick={() => toast.success(`Invitation sent to ${w.name}`)}>Invite to opportunity</Button>
          </div>
        </div>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card><h2 className="font-bold">About</h2><p className="mt-2 text-muted-foreground">{w.bio}</p><p className="mt-3 font-semibold">{rwf(w.rateRwf)} / {w.rateUnit} · {w.available ? <span className="text-success">Available now</span> : "Currently booked"}</p></Card>
          <Card><h2 className="font-bold">Skills & verification</h2><ul className="mt-3 divide-y">{w.skills.map((s) => <li key={s.name} className="flex items-center justify-between py-3"><div><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.level}</div></div><Pill tone={vTone[s.verification]}>{s.verification}</Pill></li>)}</ul></Card>
          <Card><h2 className="font-bold">Teams</h2>{w.teamIds.length ? <div className="mt-3 flex flex-wrap gap-2">{w.teamIds.map((id) => { const t = getTeam(id); return t && <Link key={id} to="/teams/$id" params={{ id }}><Pill tone="primary">{t.name}</Pill></Link>; })}</div> : <p className="mt-2 text-sm text-muted-foreground">Not part of a team yet.</p>}</Card>
          <DemoNotice />
        </div>
        <Card><TrustMeter w={w} /></Card>
      </div>
    </div>
  );
}
