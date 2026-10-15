import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, MapPin, Plus, Search, ShieldCheck, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { Avatar, Card, PageHeader, Pill } from "@/features/ui/kit";
import { supabase } from "@/integrations/supabase/client";
import { DISTRICTS, SECTORS } from "@/features/data/demo";

export const Route = createFileRoute("/business")({
  head: () => ({ meta: [{ title: "Business directory — UmurimoHub" }, { name: "description", content: "Find businesses, employers and cooperatives on UmurimoHub." }] }),
  component: BusinessDirectoryPage,
});

type SearchBusiness = { id: string; name: string; sector: string; district: string; verified: boolean; rating: number; about: string | null; avatar_url: string | null; open_count: number; total_count: number };

function BusinessDirectoryPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname.replace(/\/+$/, "") || "/" });
  const { user } = useApp();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [district, setDistrict] = useState("");
  const [verified, setVerified] = useState("all");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<SearchBusiness[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const pageSize = 30;
  const userDistrict = (user as (typeof user & { district?: string }) | null)?.district?.trim().toLowerCase() ?? "";

  useEffect(() => {
    if (pathname !== "/business") return;
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const { data, error: requestError } = await supabase.rpc("search_businesses", {
        _q: query.trim() || null,
        _sector: sector || null,
        _district: district || null,
        _verified: verified === "all" ? null : verified === "verified",
        _limit: pageSize,
        _offset: page * pageSize,
      });
      if (!active) return;
      if (requestError) {
        setError(requestError.message);
        setRows([]);
        setTotal(0);
      } else {
        const found = (data ?? []) as SearchBusiness[];
        found.sort((a, b) =>
          Number(b.verified) - Number(a.verified) ||
          Number(b.rating ?? 0) - Number(a.rating ?? 0) ||
          Number((b.district ?? "").trim().toLowerCase() === userDistrict) - Number((a.district ?? "").trim().toLowerCase() === userDistrict) ||
          a.name.localeCompare(b.name)
        );
        setRows(found);
        setTotal(Number(found[0]?.total_count ?? 0));
        setError("");
      }
      setLoading(false);
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [pathname, query, sector, district, verified, page, retryCount, userDistrict]);

  const resetFilters = () => { setQuery(""); setSector(""); setDistrict(""); setVerified("all"); setPage(0); };

  return <>
    {pathname === "/business" && <div className="container-page py-10">
      <PageHeader eyebrow="Business directory" title="Businesses" desc="Search and filter company profiles, verified status, capabilities and current hiring activity." actions={user ? <Button asChild><Link to="/register" search={{ create: "business" }}><Plus className="mr-2 size-4" />Add business</Link></Button> : undefined} />
      <Card className="mt-6 space-y-4 p-4 md:p-5">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search businesses" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Search company name or description" className="h-11 w-full rounded-xl border bg-background pl-9 pr-3" /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">Sector<select className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={sector} onChange={e => { setSector(e.target.value); setPage(0); }}><option value="">All sectors</option>{SECTORS.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
          <label className="text-sm">District<select className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={district} onChange={e => { setDistrict(e.target.value); setPage(0); }}><option value="">All districts</option>{DISTRICTS.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
          <label className="text-sm">Verification<select className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={verified} onChange={e => { setVerified(e.target.value); setPage(0); }}><option value="all">All companies</option><option value="verified">Verified only</option><option value="unverified">Not yet verified</option></select></label>
          <div className="flex items-end"><Button className="w-full" variant="outline" onClick={resetFilters}>Clear filters</Button></div>
        </div>
      </Card>
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground" role="status">Searching businesses…</p> : error ? <Card className="mt-5"><h2 className="font-semibold">Businesses could not be loaded</h2><p className="mt-1 text-sm text-muted-foreground">The search request failed. Please retry.</p><Button className="mt-4" onClick={() => setRetryCount(count => count + 1)}>Retry</Button></Card> : rows.length === 0 ? <Card className="mt-5"><h2 className="font-semibold">No matching businesses</h2><p className="mt-1 text-sm text-muted-foreground">Try another search or clear some filters.</p></Card> : <>
        <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">{query.trim() ? total.toLocaleString() + " matching businesses · Showing " + (page * pageSize + 1) + "–" + Math.min((page + 1) * pageSize, total) : total.toLocaleString() + " businesses · Showing the top " + Math.min(pageSize, total) + " ranked companies. Search to find more."}</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{rows.map(business => <Link key={business.id} to="/business/$id" params={{ id: business.id }} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lift"><div className="flex items-start gap-3"><Avatar initials={business.name.slice(0, 2).toUpperCase()} src={business.avatar_url ?? undefined} alt={business.name} size="md" /><div className="min-w-0"><h2 className="break-words font-semibold">{business.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />{business.district || "Rwanda"} · {business.sector}</p></div></div><p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{business.about || "Business overview not provided."}</p><div className="mt-3 flex flex-wrap gap-2">{business.verified && <Pill tone="success"><ShieldCheck className="size-3.5" />Verified</Pill>}<Pill>{Number(business.open_count ?? 0)} open listings</Pill></div><div className="mt-4 flex items-center justify-between border-t pt-3 text-sm"><span className="flex items-center gap-1 text-muted-foreground"><Building2 className="size-4" />View business</span><span className="flex items-center gap-1 font-medium"><Star className="size-4 text-amber-500" />{Number(business.rating) > 0 ? Number(business.rating).toFixed(1) : "—"}</span></div></Card></Link>)}</div>
        <div className="mt-6 flex items-center justify-between gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}><ChevronLeft className="mr-1 size-4" />Previous</Button><span className="text-sm text-muted-foreground">Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}</span><Button variant="outline" disabled={!query.trim() || (page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next<ChevronRight className="ml-1 size-4" /></Button></div>
      </>}
    </div>}
    <Outlet />
  </>;
}
