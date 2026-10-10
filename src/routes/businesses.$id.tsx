import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MapPin, Pencil, Plus, ShieldCheck, Star, BriefcaseBusiness } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { Avatar, Card, PageHeader, Pill } from "@/features/ui/kit";

export const Route = createFileRoute("/businesses/$id")({
  head: () => ({ meta: [{ title: "Business profile — UmurimoHub" }, { name: "description", content: "Business information, active opportunities and work reputation on UmurimoHub." }] }),
  component: BusinessProfilePage,
});

const money = (value: number) => new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(value) + " RWF";

function BusinessProfilePage() {
  const { id } = Route.useParams();
  const { user } = useApp();
  const { businesses, opportunities, loading, error, refresh } = useCatalog();
  const business = businesses.find((item) => item.id === id);
  const isOwner = !!user && user.businessIds.includes(id);
  const businessOpportunities = opportunities.filter((item) => item.businessId === id);

  if (loading) return <div className="container-page py-16 text-sm text-muted-foreground" role="status">Loading business profile…</div>;
  if (error) return <div className="container-page py-12"><Card><h1 className="font-semibold">Business profile could not load</h1><p className="mt-2 text-sm text-muted-foreground">Check your connection and retry. Your business data has not been changed.</p><Button className="mt-4" onClick={() => void refresh()}>Retry</Button><Button className="ml-2 mt-4" variant="outline" asChild><Link to="/businesses">All businesses</Link></Button></Card></div>;
  if (!business) return <div className="container-page py-12"><Card><h1 className="font-semibold">Business not found</h1><p className="mt-2 text-sm text-muted-foreground">This business is unavailable or no longer listed.</p><Button className="mt-4" variant="outline" asChild><Link to="/businesses">Browse businesses</Link></Button></Card></div>;

  return <div className="container-page py-8 md:py-10">
    <Link to="/businesses" className="text-sm text-muted-foreground hover:text-foreground">← All businesses</Link>
    <Card className="mt-4 overflow-hidden p-0">
      <div className="h-2 bg-primary" />
      <div className="p-5 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar initials={business.name.slice(0, 2).toUpperCase()} src={business.avatarUrl} alt={business.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Building2 className="size-5 text-primary" /><h1 className="break-words text-2xl font-display font-bold md:text-3xl">{business.name}</h1>{business.verified && <Pill tone="success"><ShieldCheck className="size-3.5" />Verified business</Pill>}</div>
              <p className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" />{business.district || "Rwanda"} · {business.sector}</p>
            </div>
          </div>
          {isOwner && <div className="flex flex-wrap gap-2"><Button asChild><Link to="/opportunities/new"><Plus className="mr-2 size-4" />Post opportunity</Link></Button><Button variant="outline" asChild><Link to="/businesses/$id/edit" params={{ id }}><Pencil className="mr-2 size-4" />Edit profile</Link></Button></div>}
        </div>
        <p className="mt-6 whitespace-pre-line leading-7 text-muted-foreground">{business.about || "This business has not added an overview yet."}</p>
        {business.services.length > 0 && <div className="mt-5"><p className="mb-2 text-sm font-semibold">Services & capabilities</p><div className="flex flex-wrap gap-2">{business.services.map((service) => <Pill key={service}>{service}</Pill>)}</div></div>}
        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Trust score</p><p className="mt-1 text-2xl font-bold">{Math.round(business.trustScore ?? 0)}<span className="ml-1 text-xs font-normal text-muted-foreground">/ 100</span></p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Business rating</p><p className="mt-1 flex items-center gap-1 text-2xl font-bold"><Star className="size-5 text-amber-500" />{business.rating > 0 ? business.rating.toFixed(1) : "—"}<span className="text-xs font-normal text-muted-foreground">/ 5</span></p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Open opportunities</p><p className="mt-1 text-2xl font-bold">{business.hiring}</p></div>
        </div>
      </div>
    </Card>
    <section className="mt-9">
      <PageHeader eyebrow="Work with this business" title="Open opportunities" desc="Explore current opportunities published by this business." />
      {businessOpportunities.length === 0 ? <Card><div className="flex items-start gap-3"><BriefcaseBusiness className="mt-1 size-5 text-muted-foreground" /><div><h2 className="font-semibold">No open opportunities listed</h2><p className="mt-1 text-sm text-muted-foreground">New opportunities will appear here when this business publishes them.</p></div></div>{isOwner && <Button className="mt-4" asChild><Link to="/opportunities/new"><Plus className="mr-2 size-4" />Create an opportunity</Link></Button>}</Card> : <div className="grid gap-4 md:grid-cols-2">{businessOpportunities.map((item) => <Card key={item.id} className="flex flex-col"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.summary || "See the opportunity for full details."}</p></div><Pill tone="success">Open</Pill></div><div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{item.sector}</span><span>{item.district}</span><span>{money(item.payRwf)} / {item.payUnit}</span></div><div className="mt-4 border-t pt-3"><Button variant="outline" size="sm" asChild><Link to="/opportunities/$id" params={{ id: item.id }}>View opportunity</Link></Button></div></Card>)}</div>}
    </section>
  </div>;
}
