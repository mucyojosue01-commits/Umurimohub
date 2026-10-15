import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BriefcaseBusiness, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/features/data/catalog";
import { useApp } from "@/features/store/app-store";
import { Card, PageHeader, Pill } from "@/features/ui/kit";
import { rwf } from "@/features/data/demo";

export const Route = createFileRoute("/positions/")({
  head: () => ({ meta: [
    { title: "Open Positions — UmurimoHub" },
    { name: "description", content: "Browse company positions and apply directly to roles across Rwanda." },
  ] }),
  component: Page,
});

function Page() {
  const { user } = useApp();
  const { opportunities, loading, error } = useCatalog();
  const [filledPositionIds, setFilledPositionIds] = useState<string[]>([]);
  const [employmentCheckDone, setEmploymentCheckDone] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.from("company_employments").select("opportunity_id").eq("status", "active").not("opportunity_id", "is", null).then(({ data, error: employmentError }) => {
      if (!active) return;
      if (employmentError) {
        // The database also closes filled positions; this query is a defensive display safeguard.
        setFilledPositionIds([]);
      } else {
        setFilledPositionIds([...new Set((data ?? []).map((row) => row.opportunity_id).filter((value): value is string => !!value))]);
      }
      setEmploymentCheckDone(true);
    });
    return () => { active = false; };
  }, []);
  const positions = opportunities.filter((o) => o.opportunityType === "company_position" && o.type.toLowerCase() === "job" && o.status === "open" && !filledPositionIds.includes(o.id) && new Date(o.deadline + "T23:59:59") >= new Date());
  return <div className="container-page py-10">
    <PageHeader eyebrow="Jobs" title="Open positions" desc="Explore employment listings, review each full position profile, and apply before the deadline."
      actions={<Button asChild><Link to="/positions/new"><BriefcaseBusiness className="mr-2 size-4"/>Post position</Link></Button>} />
    {loading || !employmentCheckDone ? <div className="py-16 text-center text-muted-foreground">Loading positions…</div> :
      error ? <div role="alert" className="mt-6 rounded-xl border p-5 text-sm text-destructive">Positions could not be loaded. Please retry shortly.</div> :
      positions.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{positions.map(o => {
        const own = o.createdBy === user?.id || (!!o.businessId && user?.businessIds.includes(o.businessId));
        return <Link key={o.id} to="/positions/$id" params={{id:o.id}} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex flex-wrap items-center gap-2"><Pill tone="primary">Position</Pill><Pill>{o.sector}</Pill>{own && <Pill tone="accent">Your listing</Pill>}</div>
            <h2 className="mt-4 text-lg font-bold">{o.title}</h2><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{o.summary}</p>
            <div className="mt-4 grid gap-2 text-sm text-muted-foreground"><span className="flex items-center gap-2"><MapPin className="size-4"/>{o.district}, Rwanda</span><span className="flex items-center gap-2"><BriefcaseBusiness className="size-4"/>{rwf(o.payRwf)} / {o.payUnit}</span>
              <span className="flex items-center gap-2"><CalendarDays className="size-4"/>Apply by {o.deadline}</span></div>
          </Card>
        </Link>;
      })}</div> :
      <div className="mt-8 rounded-2xl border p-8 text-center"><BriefcaseBusiness className="mx-auto size-8 text-muted-foreground"/><h2 className="mt-3 text-lg font-semibold">No open positions yet</h2><p className="mt-1 text-sm text-muted-foreground">Published positions appear here. Every position has a closing deadline.</p><Button className="mt-4" asChild><Link to="/positions/new">Post a position</Link></Button></div>}
  </div>;
}
