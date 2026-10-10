import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MapPin, Plus, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { Avatar, Card, PageHeader, Pill } from "@/features/ui/kit";

export const Route = createFileRoute("/company/businesses")({
  head: () => ({ meta: [{ title: "Company directory — UmurimoHub" }, { name: "description", content: "Find businesses, employers and cooperatives on UmurimoHub." }] }),
  component: CompanyBusinessesPage,
});

function CompanyBusinessesPage() {
  const { businesses, loading, error, refresh } = useCatalog();
  const { user } = useApp();

  return <div className="container-page py-10">
    <PageHeader eyebrow="Company network" title="Businesses" desc="Explore business profiles, verified status, capabilities and current hiring activity." actions={user ? <Button asChild><Link to="/register" search={{ create: "business" }}><Plus className="mr-2 size-4" />Add business</Link></Button> : undefined} />
    {loading ? <p className="py-10 text-center text-sm text-muted-foreground" role="status">Loading businesses…</p> : error ? <Card><h2 className="font-semibold">Businesses could not be loaded</h2><p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p><Button className="mt-4" onClick={() => void refresh()}>Retry</Button></Card> : businesses.length === 0 ? <Card><h2 className="font-semibold">No businesses listed yet</h2><p className="mt-1 text-sm text-muted-foreground">Business profiles will appear here when available.</p></Card> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{businesses.map((business) => <Link key={business.id} to="/company/$id" params={{ id: business.id }} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lift"><div className="flex items-start gap-3"><Avatar initials={business.name.slice(0,2).toUpperCase()} src={business.avatarUrl} alt={business.name} size="md" /><div className="min-w-0"><h2 className="break-words font-semibold">{business.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />{business.district || "Rwanda"} · {business.sector}</p></div></div><p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{business.about || "Business overview not provided."}</p><div className="mt-3 flex flex-wrap gap-2">{business.verified && <Pill tone="success"><ShieldCheck className="size-3.5" />Verified</Pill>}<Pill>{business.hiring} open opportunities</Pill></div><div className="mt-4 flex items-center justify-between border-t pt-3 text-sm"><span className="flex items-center gap-1 text-muted-foreground"><Building2 className="size-4" />View company</span><span className="flex items-center gap-1 font-medium"><Star className="size-4 text-amber-500" />{business.rating > 0 ? business.rating.toFixed(1) : "—"}</span></div></Card></Link>)}</div>}
  </div>;
}
