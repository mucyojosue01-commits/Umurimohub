import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, GraduationCap, Handshake, MapPin, Search, Sprout, Store, Users, Briefcase, ShieldCheck, TrendingUp } from "lucide-react";
import { useState } from "react";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { DISTRICTS } from "@/features/data/demo";
import { useCatalog } from "@/features/data/catalog";
import { Card, DemoNotice, OpportunityCard, TeamCard, WorkerCard } from "@/features/ui/kit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UmurimoHub — Turn opportunity into work in Rwanda" },
      { name: "description", content: "Find trusted workers, teams and opportunities across Rwanda. Build verified experience, get paid by milestone, and grow." },
      { property: "og:title", content: "UmurimoHub — Turn opportunity into work" },
      { property: "og:description", content: "Rwanda's trusted network for work, teams, training, agriculture and MSME growth." },
    ],
  }),
  component: Index,
});

const LOOP = ["Demand", "Opportunity", "Trusted teams", "Work", "Payment", "Verified experience", "Reputation", "Growth"];

function Index() {
  const { opportunities, workers, teams } = useCatalog();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [d, setD] = useState("");
  return (
    <>
      <section className="relative overflow-hidden bg-hero text-hero-foreground">
        <div className="absolute inset-0 pattern-imigongo opacity-60" />
        <div className="container-page relative grid gap-10 py-16 md:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-hero-foreground/20 px-3 py-1 text-xs"><ShieldCheck className="size-3.5" />Verified people · Milestone payments · All 30 districts</p>
            <h1 className="text-4xl font-extrabold leading-[1.05] md:text-6xl">Turn opportunity into work.</h1>
            <p className="mt-5 max-w-lg text-lg text-hero-foreground/75">Find trusted workers and teams near you, apply as an individual or a crew, and build a verified record that opens the next door.</p>
            <form onSubmit={(e) => { e.preventDefault(); nav({ to: "/opportunities", search: { q, district: d } }); }} className="mt-8 flex flex-col gap-2 rounded-3xl bg-card p-2 text-card-foreground shadow-lift sm:flex-row">
              <label className="flex flex-1 items-center gap-2 px-3"><Search className="size-4 text-muted-foreground" /><span className="sr-only">Search</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Skill, job or project" className="h-11 w-full bg-transparent outline-none" /></label>
              <label className="flex items-center gap-2 border-t px-3 sm:border-l sm:border-t-0"><MapPin className="size-4 text-muted-foreground" /><span className="sr-only">District</span>
                <select value={d} onChange={(e) => setD(e.target.value)} className="h-11 bg-transparent outline-none"><option value="">All districts</option>{DISTRICTS.map((x) => <option key={x}>{x}</option>)}</select></label>
              <Button type="submit" size="lg">Search</Button>
            </form>
            <div className="mt-6 flex flex-wrap gap-3"><Button variant="hero" asChild><Link to="/register">Join free as a worker</Link></Button><Button variant="heroOutline" asChild><Link to="/opportunities/new">Post an opportunity</Link></Button></div>
          </div>
          <img src={hero} alt="Rwandan mason, coffee farmer and tech worker collaborating on terraced hills" width={1600} height={1008} className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lift" />
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-primary">The UmurimoHub loop</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-2">{LOOP.map((s, i) => <span key={s} className="flex items-center gap-2 text-sm"><span className="rounded-full border bg-card px-4 py-2 font-medium">{s}</span>{i < LOOP.length - 1 && <ArrowRight className="size-4 text-muted-foreground" />}</span>)}</div>
      </section>

      <section className="container-page grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Users, t: "Teams & crews", d: "Hire a proven team, not just a person.", to: "/teams" },
          { icon: Sprout, t: "Agriculture", d: "Seasonal work, supply and market demand.", to: "/agriculture" },
          { icon: GraduationCap, t: "Skills & apprenticeships", d: "Learn, get assessed, get verified, get work.", to: "/training" },
          { icon: Store, t: "MSME growth", d: "Tools for small businesses to hire and manage projects.", to: "/pricing" },
        ].map((x) => (
          <Link key={x.t} to={x.to}><Card className="h-full transition hover:shadow-lift"><x.icon className="size-6 text-primary" /><h3 className="mt-4 font-bold">{x.t}</h3><p className="mt-1 text-sm text-muted-foreground">{x.d}</p></Card></Link>
        ))}
      </section>

      <section className="container-page mt-20">
        <div className="flex items-end justify-between"><h2 className="text-2xl font-extrabold md:text-3xl">Opportunities near you</h2><Link to="/opportunities" className="text-sm font-semibold text-primary">View all</Link></div>
        <DemoNotice className="mt-3" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{opportunities.slice(0, 3).map((o) => <OpportunityCard key={o.id} o={o} />)}</div>
      </section>

      <section className="container-page mt-20 grid gap-10 lg:grid-cols-[1fr_2fr]">
        <div>
          <Handshake className="size-8 text-primary" />
          <h2 className="mt-4 text-2xl font-extrabold md:text-3xl">Work flows through trust.</h2>
          <p className="mt-3 text-muted-foreground">See who has worked together, who recommends whom, and who is verified — with privacy controls on every connection.</p>
          <ul className="mt-6 space-y-3 text-sm">{["Worked together on verified projects", "Recommended by people you trust", "Skills verified by assessment or employer"].map((x) => <li key={x} className="flex gap-2"><ShieldCheck className="size-4 text-primary" />{x}</li>)}</ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">{workers.slice(0, 2).map((w) => <WorkerCard key={w.id} w={w} />)}{teams.slice(0, 2).map((t) => <TeamCard key={t.id} t={t} />)}</div>
      </section>

      <section className="container-page mt-20">
        <Card className="grid gap-6 bg-secondary md:grid-cols-[2fr_1fr] md:items-center md:p-10">
          <div>
            <TrendingUp className="size-7 text-primary" />
            <h2 className="mt-3 text-2xl font-extrabold">Economic impact, measured honestly</h2>
            <p className="mt-2 text-muted-foreground">Workers engaged, worker-days and project value by district will be published here — only from verified platform activity and authoritative sources. No placeholder statistics.</p>
          </div>
          <Button asChild variant="outline"><Link to="/insights">Explore insights</Link></Button>
        </Card>
      </section>

      <section className="container-page mt-20 grid gap-4 md:grid-cols-3">
        {[{ icon: Briefcase, t: "Free for workers", d: "Profiles, applications, training and messaging cost nothing." }, { icon: ShieldCheck, t: "Not a bank", d: "Payments through licensed mobile-money and escrow partners." }, { icon: MapPin, t: "Built for Rwanda", d: "Province → district → sector → cell, RWF, Kinyarwanda-ready." }].map((x) => (
          <div key={x.t} className="flex gap-3"><x.icon className="size-5 shrink-0 text-primary" /><div><h3 className="font-bold">{x.t}</h3><p className="text-sm text-muted-foreground">{x.d}</p></div></div>
        ))}
      </section>
    </>
  );
}
