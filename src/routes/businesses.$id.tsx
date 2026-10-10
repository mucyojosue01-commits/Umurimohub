import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, ShieldCheck, Star, BriefcaseBusiness, Users, CalendarDays, Pencil, Plus, ExternalLink, CheckCircle2, Clock3 } from "lucide-react";
import { Avatar, Card, PageHeader, Pill } from "@/features/ui/kit";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/businesses/$id")({ component: Page });

const money = (value: number | null | undefined) => value == null ? "Not specified" : new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(value) + " RWF";
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const label = (value: string | null | undefined) => (value ?? "unknown").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

function Page() {
  const { id } = Route.useParams();
  const { user } = useApp();
  const businessQ = useQuery({
    queryKey: ["business-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const opportunitiesQ = useQuery({
    queryKey: ["business-profile-opportunities", id],
    enabled: !!businessQ.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("id,title,summary,status,type,district,pay_rwf,pay_unit,deadline,created_at").eq("business_id", id).eq("is_demo", false).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const contractsQ = useQuery({
    queryKey: ["business-profile-contracts", id],
    enabled: !!businessQ.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("id,title,scope,status,amount_rwf,start_date,end_date,completed_at,created_at,opportunity_id").eq("business_id", id).eq("is_demo", false).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const experiencesQ = useQuery({
    queryKey: ["business-profile-experiences", id],
    enabled: !!businessQ.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("verified_experiences").select("id,title,scope,amount_rwf,start_date,end_date,completed_at,verified_at,worker_id,team_id,opportunity_id").eq("business_id", id).order("completed_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const ratingsQ = useQuery({
    queryKey: ["business-profile-ratings", id],
    enabled: !!businessQ.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_ratings").select("id,score,review,created_at,subject_type").eq("subject_id", id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const business = businessQ.data;
  const isOwner = !!user && (user.businessIds ?? []).includes(id);
  const opportunities = opportunitiesQ.data ?? [];
  const contracts = contractsQ.data ?? [];
  const experiences = experiencesQ.data ?? [];
  const ratings = ratingsQ.data ?? [];
  const openOpportunities = opportunities.filter((o) => o.status === "open");
  const completedContracts = contracts.filter((c) => c.status === "completed" || !!c.completed_at);
  const averageRating = ratings.length ? ratings.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / ratings.length : Number(business?.rating ?? 0);

  if (businessQ.isLoading) return <div className="container-page py-16 text-sm text-muted-foreground">Loading business profile…</div>;
  if (businessQ.isError) return <div className="container-page py-16"><Card><h1 className="font-bold">Business profile could not load</h1><p className="mt-2 text-sm text-muted-foreground">{businessQ.error instanceof Error ? businessQ.error.message : "Check your connection and try again."}</p><Button className="mt-4" onClick={() => void businessQ.refetch()}>Retry loading profile</Button></Card></div>;
  if (!business) return <div className="container-page py-16"><Card><h1 className="font-bold">Business not found</h1><p className="mt-2 text-sm text-muted-foreground">This business may have been removed or is not available.</p><Button className="mt-4" variant="outline" asChild><Link to="/businesses">Browse businesses</Link></Button></Card></div>;

  return <div className="container-page py-8 md:py-10">
    <Link to="/businesses" className="text-sm text-muted-foreground hover:text-foreground">← All businesses</Link>
    <Card className="mt-4 overflow-hidden p-0">
      <div className="h-2 bg-primary" />
      <div className="p-5 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar initials={(business.name ?? "B").slice(0, 2).toUpperCase()} src={business.avatar_url} alt={business.name ?? "Business"} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Building2 className="size-5 text-primary" /><h1 className="break-words text-2xl font-display font-bold md:text-3xl">{business.name}</h1>{business.verified && <Pill tone="success"><ShieldCheck className="mr-1 inline size-3.5" />Verified business</Pill>}</div>
              <p className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" />{[business.district, business.sector].filter(Boolean).join(", ") || "Rwanda"} <span>·</span> {business.sector || "Business"}</p>
              <p className="mt-2 text-xs text-muted-foreground">On UmurimoHub since {date(business.created_at)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOwner && <Button asChild><a href={"/opportunities/new?business_id=" + encodeURIComponent(id)}><Plus className="mr-2 size-4" />Post opportunity</a></Button>}
            {isOwner && <Button variant="outline" asChild><a href={"/businesses/" + encodeURIComponent(id) + "/edit"}><Pencil className="mr-2 size-4" />Edit business</a></Button>}
            <Button variant="outline" asChild><a href="#opportunities">View opportunities</a></Button>
          </div>
        </div>
        <p className="mt-6 whitespace-pre-line leading-7 text-muted-foreground">{business.about || "This business has not added an overview yet."}</p>
        {(business.services ?? []).length > 0 && <div className="mt-5"><p className="mb-2 text-sm font-semibold">Services & capabilities</p><div className="flex flex-wrap gap-2">{business.services.map((service: string) => <Pill key={service}>{service}</Pill>)}</div></div>}
        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Trust score</p><p className="mt-1 text-2xl font-bold">{business.trust_score == null ? "—" : Math.round(Number(business.trust_score))}<span className="ml-1 text-xs font-normal text-muted-foreground">/ 100</span></p><p className="mt-1 text-xs text-muted-foreground">Platform trust signal</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Rating</p><p className="mt-1 flex items-center gap-1 text-2xl font-bold"><Star className="size-5 fill-current text-amber-500" />{averageRating > 0 ? averageRating.toFixed(1) : "—"}<span className="text-xs font-normal text-muted-foreground">/ 5</span></p><p className="mt-1 text-xs text-muted-foreground">{ratings.length || Number(business.rating ? 1 : 0)} rating records</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Opportunities</p><p className="mt-1 text-2xl font-bold">{opportunitiesQ.isLoading ? "…" : opportunities.length}</p><p className="mt-1 text-xs text-muted-foreground">{openOpportunities.length} currently open</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Completed work</p><p className="mt-1 text-2xl font-bold">{experiencesQ.isLoading || contractsQ.isLoading ? "…" : Math.max(experiences.length, completedContracts.length)}</p><p className="mt-1 text-xs text-muted-foreground">Verified experiences / completed contracts</p></div>
        </div>
      </div>
    </Card>

    <section id="opportunities" className="mt-9 scroll-mt-6">
      <PageHeader eyebrow="Work with this business" title="Opportunities" desc="Open roles and projects, plus previous listings for context." />
      {opportunitiesQ.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading opportunities…</p> : opportunitiesQ.isError ? <Card className="mt-4"><p className="text-sm text-destructive">Opportunities could not be loaded.</p><Button variant="outline" className="mt-3" onClick={() => void opportunitiesQ.refetch()}>Retry opportunities</Button></Card> : opportunities.length === 0 ? <Card className="mt-4"><p className="font-medium">No opportunities listed yet</p><p className="mt-1 text-sm text-muted-foreground">New opportunities published by this business will appear here.</p>{isOwner && <Button className="mt-4" asChild><a href={"/opportunities/new?business_id=" + encodeURIComponent(id)}><Plus className="mr-2 size-4" />Create first opportunity</a></Button>}</Card> : <div className="mt-4 grid gap-3 md:grid-cols-2">{opportunities.map((o) => <Card key={o.id} className="flex flex-col p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{o.title}</h3><p className="mt-1 text-sm text-muted-foreground">{o.summary || "Details available on the opportunity page."}</p></div><Pill tone={o.status === "open" ? "success" : "neutral"}>{label(o.status)}</Pill></div><div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{label(o.type)}</span>{o.district && <span><MapPin className="mr-1 inline size-3.5" />{o.district}</span>}{o.pay_rwf != null && <span>{money(o.pay_rwf)}{o.pay_unit ? " / " + o.pay_unit : ""}</span>}{o.deadline && <span><CalendarDays className="mr-1 inline size-3.5" />Due {date(o.deadline)}</span>}</div><div className="mt-4 border-t pt-3"><Button size="sm" variant="outline" asChild><Link to="/opportunities/$id" params={{id:o.id}}>View opportunity <ExternalLink className="ml-2 size-3.5" /></Link></Button></div></Card>)}</div>}
    </section>

    <section className="mt-10">
      <PageHeader eyebrow="Track record" title="Past experience" desc="Completed work recorded against this business. Verified records are distinguished from contract status." />
      {experiencesQ.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading verified experience…</p> : experiencesQ.isError ? <Card className="mt-4"><p className="text-sm text-destructive">Verified experience could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => void experiencesQ.refetch()}>Retry experience</Button></Card> : experiences.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{experiences.map((e) => <Card key={e.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{e.title}</h3><p className="mt-1 text-sm text-muted-foreground">{e.scope || "Completed project"}</p></div><Pill tone="success"><CheckCircle2 className="mr-1 inline size-3.5" />Verified</Pill></div><div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">{e.amount_rwf != null && <span>{money(e.amount_rwf)}</span>}<span>{date(e.start_date)} – {date(e.end_date || e.completed_at)}</span><span>Verified {date(e.verified_at)}</span></div></Card>)}</div> : <Card className="mt-4"><p className="font-medium">No verified past experiences recorded yet</p><p className="mt-1 text-sm text-muted-foreground">Once work is completed and verified, its experience record will appear here.</p></Card>}
    </section>

    <section className="mt-10">
      <PageHeader eyebrow="Engagement history" title="Contracts & projects" desc="A transparent view of project status and completed engagements." />
      {contractsQ.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading contracts…</p> : contractsQ.isError ? <Card className="mt-4"><p className="text-sm text-destructive">Contract history could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => void contractsQ.refetch()}>Retry contracts</Button></Card> : contracts.length ? <div className="mt-4 overflow-hidden rounded-2xl border">{contracts.map((c, i) => <div key={c.id} className={"flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between " + (i ? "border-t" : "")}><div><p className="font-medium">{c.title}</p><p className="mt-1 text-sm text-muted-foreground">{c.scope || "Project contract"} · {c.amount_rwf == null ? "Amount not disclosed" : money(c.amount_rwf)}</p><p className="mt-1 text-xs text-muted-foreground">Started {date(c.start_date || c.created_at)}{c.completed_at ? " · Completed " + date(c.completed_at) : c.end_date ? " · Planned end " + date(c.end_date) : ""}</p></div><Pill tone={c.status === "completed" ? "success" : "neutral"}>{label(c.status)}</Pill></div>)}</div> : <Card className="mt-4"><p className="font-medium">No contract history available</p><p className="mt-1 text-sm text-muted-foreground">Contracts appear here when projects are formally agreed through UmurimoHub.</p></Card>}
    </section>

    <section className="mt-10">
      <PageHeader eyebrow="Reputation" title="Ratings & feedback" desc="Ratings submitted through completed contract workflows." />
      {ratingsQ.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading feedback…</p> : ratingsQ.isError ? <Card className="mt-4"><p className="text-sm text-destructive">Ratings could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => void ratingsQ.refetch()}>Retry ratings</Button></Card> : ratings.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{ratings.map((r) => <Card key={r.id} className="p-5"><div className="flex items-center justify-between"><p className="flex items-center gap-1 font-semibold"><Star className="size-4 fill-current text-amber-500" />{r.score}/5</p><span className="text-xs text-muted-foreground">{date(r.created_at)}</span></div><p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{r.review || "Rating submitted without written feedback."}</p></Card>)}</div> : <Card className="mt-4"><p className="font-medium">No written feedback yet</p><p className="mt-1 text-sm text-muted-foreground">Feedback will appear after a participant rates a completed contract.</p></Card>}
    </section>
    <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-5"><div><p className="font-semibold">Business information</p><p className="mt-1 text-sm text-muted-foreground">Profile created {date(business.created_at)} · {business.verified ? "Verification recorded" : "Not yet verified"}</p></div>{isOwner && <Button variant="outline" asChild><a href={"/businesses/" + encodeURIComponent(id) + "/edit"}><Pencil className="mr-2 size-4" />Manage profile</a></Button>}</footer>
  </div>;
}
