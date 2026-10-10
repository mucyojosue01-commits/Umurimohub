import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, Pencil, Plus, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, Card, PageHeader, Pill } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/businesses/$id")({ component: BusinessProfilePage });

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const formatMoney = (value?: number | null) => value == null ? "Not specified" : new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(value) + " RWF";
const formatLabel = (value?: string | null) => (value || "Not specified").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

function BusinessProfilePage() {
  const { id } = Route.useParams();
  const { user } = useApp();
  const businessQuery = useQuery({
    queryKey: ["business-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const opportunitiesQuery = useQuery({
    queryKey: ["business-profile-opportunities", id],
    enabled: !!businessQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("id,title,summary,status,type,district,pay_rwf,pay_unit,deadline,created_at").eq("business_id", id).eq("is_demo", false).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const contractsQuery = useQuery({
    queryKey: ["business-profile-contracts", id],
    enabled: !!businessQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("id,title,scope,status,amount_rwf,start_date,end_date,completed_at,created_at").eq("business_id", id).eq("is_demo", false).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const experiencesQuery = useQuery({
    queryKey: ["business-profile-experiences", id],
    enabled: !!businessQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("verified_experiences").select("id,title,scope,amount_rwf,start_date,end_date,completed_at,verified_at").eq("business_id", id).order("completed_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const ratingsQuery = useQuery({
    queryKey: ["business-profile-ratings", id],
    enabled: !!businessQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_ratings").select("id,score,review,created_at").eq("subject_id", id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const business = businessQuery.data;
  const isOwner = !!user && (user.businessIds ?? []).includes(id);
  const opportunities = opportunitiesQuery.data ?? [];
  const contracts = contractsQuery.data ?? [];
  const experiences = experiencesQuery.data ?? [];
  const ratings = ratingsQuery.data ?? [];
  const rating = ratings.length ? ratings.reduce((total, item) => total + Number(item.score || 0), 0) / ratings.length : Number(business?.rating || 0);

  if (businessQuery.isLoading) return <div className="container-page py-16 text-sm text-muted-foreground">Loading business profile…</div>;
  if (businessQuery.isError) return <div className="container-page py-12"><Card><h1 className="font-semibold">Business profile could not load</h1><p className="mt-2 text-sm text-muted-foreground">{businessQuery.error instanceof Error ? businessQuery.error.message : "Check your connection and try again."}</p><div className="mt-4 flex gap-2"><Button onClick={() => void businessQuery.refetch()}>Retry</Button><Button variant="outline" asChild><Link to="/businesses">All businesses</Link></Button></div></Card></div>;
  if (!business) return <div className="container-page py-12"><Card><h1 className="font-semibold">Business not found</h1><p className="mt-2 text-sm text-muted-foreground">This business may have been removed or is not available.</p><Button className="mt-4" variant="outline" asChild><Link to="/businesses">Browse businesses</Link></Button></Card></div>;

  return <div className="container-page py-8 md:py-10">
    <Link to="/businesses" className="text-sm text-muted-foreground hover:text-foreground">← All businesses</Link>
    <Card className="mt-4 overflow-hidden p-0">
      <div className="h-2 bg-primary" />
      <div className="p-5 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar initials={(business.name || "B").slice(0, 2).toUpperCase()} src={business.avatar_url} alt={business.name || "Business"} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Building2 className="size-5 text-primary" /><h1 className="break-words text-2xl font-display font-bold md:text-3xl">{business.name}</h1>{business.verified && <Pill tone="success"><ShieldCheck className="mr-1 inline size-3.5" />Verified business</Pill>}</div>
              <p className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" />{[business.district, business.sector].filter(Boolean).join(", ") || "Rwanda"}</p>
              <p className="mt-1 text-xs text-muted-foreground">On UmurimoHub since {formatDate(business.created_at)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOwner && <Button asChild><Link to="/opportunities/new" search={{ business_id: id }}><Plus className="mr-2 size-4" />Post opportunity</Link></Button>}
            {isOwner && <Button variant="outline" asChild><Link to="/businesses/$id/edit" params={{ id }}><Pencil className="mr-2 size-4" />Edit business</Link></Button>}
          </div>
        </div>
        <p className="mt-6 whitespace-pre-line leading-7 text-muted-foreground">{business.about || "This business has not added an overview yet."}</p>
        {(business.services ?? []).length > 0 && <div className="mt-5"><p className="mb-2 text-sm font-semibold">Services & capabilities</p><div className="flex flex-wrap gap-2">{business.services.map((service: string) => <Pill key={service}>{service}</Pill>)}</div></div>}
        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Trust score</p><p className="mt-1 text-2xl font-bold">{business.trust_score == null ? "—" : Math.round(Number(business.trust_score))}<span className="ml-1 text-xs font-normal text-muted-foreground">/ 100</span></p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Rating</p><p className="mt-1 flex items-center gap-1 text-2xl font-bold"><Star className="size-5 text-amber-500" />{rating > 0 ? rating.toFixed(1) : "—"}<span className="text-xs font-normal text-muted-foreground">/ 5</span></p><p className="mt-1 text-xs text-muted-foreground">{ratings.length} review(s)</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Opportunities</p><p className="mt-1 text-2xl font-bold">{opportunitiesQuery.isLoading ? "…" : opportunities.length}</p><p className="mt-1 text-xs text-muted-foreground">{opportunities.filter((item) => item.status === "open").length} open</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Completed work</p><p className="mt-1 text-2xl font-bold">{experiencesQuery.isLoading || contractsQuery.isLoading ? "…" : Math.max(experiences.length, contracts.filter((item) => item.status === "completed" || !!item.completed_at).length)}</p><p className="mt-1 text-xs text-muted-foreground">Experience and contracts</p></div>
        </div>
      </div>
    </Card>

    <section id="opportunities" className="mt-9 scroll-mt-6">
      <PageHeader eyebrow="Work with this business" title="Opportunities" desc="Current and previous opportunities published by this business." />
      {opportunitiesQuery.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading opportunities…</p> : opportunitiesQuery.isError ? <Card className="mt-4"><p className="text-sm text-destructive">Opportunities could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => void opportunitiesQuery.refetch()}>Retry opportunities</Button></Card> : opportunities.length === 0 ? <Card className="mt-4"><p className="font-medium">No opportunities listed yet</p><p className="mt-1 text-sm text-muted-foreground">New opportunities published by this business will appear here.</p>{isOwner && <Button className="mt-4" asChild><Link to="/opportunities/new" search={{ business_id: id }}><Plus className="mr-2 size-4" />Create first opportunity</Link></Button>}</Card> : <div className="mt-4 grid gap-3 md:grid-cols-2">{opportunities.map((item) => <Card key={item.id} className="flex flex-col p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.summary || "Details available on the opportunity page."}</p></div><Pill tone={item.status === "open" ? "success" : "muted"}>{formatLabel(item.status)}</Pill></div><div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{formatLabel(item.type)}</span>{item.district && <span>{item.district}</span>}{item.pay_rwf != null && <span>{formatMoney(item.pay_rwf)}{item.pay_unit ? " / " + item.pay_unit : ""}</span>}{item.deadline && <span>Due {formatDate(item.deadline)}</span>}</div><div className="mt-4 border-t pt-3"><Button size="sm" variant="outline" asChild><Link to="/opportunities/$id" params={{ id: item.id }}>View opportunity</Link></Button></div></Card>)}</div>}
    </section>

    <section className="mt-10"><PageHeader eyebrow="Track record" title="Past experience" desc="Completed work recorded against this business." />
      {experiencesQuery.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading experience…</p> : experiencesQuery.isError ? <Card className="mt-4"><p className="text-sm text-destructive">Experience could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => void experiencesQuery.refetch()}>Retry experience</Button></Card> : experiences.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{experiences.map((item) => <Card key={item.id} className="p-5"><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.scope || "Completed project"}</p><p className="mt-3 text-xs text-muted-foreground">{item.amount_rwf == null ? "Amount not disclosed" : formatMoney(item.amount_rwf)} · {formatDate(item.start_date)} – {formatDate(item.end_date || item.completed_at)} · Verified {formatDate(item.verified_at)}</p><Pill tone="success">Verified experience</Pill></Card>)}</div> : <Card className="mt-4"><p className="font-medium">No verified past experiences recorded yet</p><p className="mt-1 text-sm text-muted-foreground">Verified records will appear here after completed work is confirmed.</p></Card>}
    </section>

    <section className="mt-10"><PageHeader eyebrow="Engagement history" title="Contracts & projects" desc="A view of formal engagements and their status." />
      {contractsQuery.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading contracts…</p> : contractsQuery.isError ? <Card className="mt-4"><p className="text-sm text-destructive">Contracts could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => void contractsQuery.refetch()}>Retry contracts</Button></Card> : contracts.length ? <div className="mt-4 overflow-hidden rounded-2xl border">{contracts.map((item, index) => <div key={item.id} className={"flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between " + (index ? "border-t" : "")}><div><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.scope || "Project contract"} · {item.amount_rwf == null ? "Amount not disclosed" : formatMoney(item.amount_rwf)}</p><p className="mt-1 text-xs text-muted-foreground">Started {formatDate(item.start_date || item.created_at)}{item.completed_at ? " · Completed " + formatDate(item.completed_at) : item.end_date ? " · Planned end " + formatDate(item.end_date) : ""}</p></div><Pill tone={item.status === "completed" ? "success" : "muted"}>{formatLabel(item.status)}</Pill></div>)}</div> : <Card className="mt-4"><p className="font-medium">No contract history available</p><p className="mt-1 text-sm text-muted-foreground">Contracts appear here when work is formally agreed through UmurimoHub.</p></Card>}
    </section>

    <section className="mt-10"><PageHeader eyebrow="Reputation" title="Ratings & feedback" desc="Feedback recorded through completed contract workflows." />
      {ratingsQuery.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading feedback…</p> : ratingsQuery.isError ? <Card className="mt-4"><p className="text-sm text-destructive">Ratings could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => void ratingsQuery.refetch()}>Retry ratings</Button></Card> : ratings.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{ratings.map((item) => <Card key={item.id} className="p-5"><div className="flex items-center justify-between"><p className="font-semibold"><Star className="mr-1 inline size-4 text-amber-500" />{item.score}/5</p><span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span></div><p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{item.review || "Rating submitted without written feedback."}</p></Card>)}</div> : <Card className="mt-4"><p className="font-medium">No written feedback yet</p><p className="mt-1 text-sm text-muted-foreground">Feedback will appear here when submitted.</p></Card>}
    </section>
  </div>;
}
