import { createFileRoute, Link } from "@tanstack/react-router";
import { BriefcaseBusiness } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/features/data/catalog";
import { useApp } from "@/features/store/app-store";
import { OpportunityCard, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/positions/")({
  head: () => ({
    meta: [
      { title: "Open Positions — UmurimoHub" },
      { name: "description", content: "Browse company positions and apply directly to roles across Rwanda." },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = useApp();
  const { opportunities, loading, error } = useCatalog();
  const ownedBusinessIds = new Set(user?.businessIds ?? []);
  const positions = opportunities.filter((o) =>
    o.type.toLowerCase() === "job" &&
    o.status === "open" &&
    !ownedBusinessIds.has(o.businessId) &&
    new Date(o.deadline + "T23:59:59") >= new Date()
  );

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Jobs"
        title="Open positions"
        desc="A dedicated directory of company roles. Apply directly or receive an employment offer from the employer."
        actions={<Button asChild><Link to="/opportunities/new" search={{ type: "Job" }}><BriefcaseBusiness className="mr-2 size-4"/>Post position</Link></Button>}
      />
      {loading ? <div className="py-16 text-center text-muted-foreground">Loading positions…</div> :
        error ? <div role="alert" className="mt-6 rounded-xl border p-5 text-sm text-destructive">Positions could not be loaded. Please retry shortly.</div> :
        positions.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{positions.map(o => <OpportunityCard key={o.id} o={o}/>)}</div> :
        <div className="mt-8 rounded-2xl border p-8 text-center"><BriefcaseBusiness className="mx-auto size-8 text-muted-foreground"/><h2 className="mt-3 text-lg font-semibold">No open positions yet</h2><p className="mt-1 text-sm text-muted-foreground">New positions published by businesses will appear here.</p><Button variant="outline" className="mt-4" asChild><Link to="/opportunities">Explore all opportunities</Link></Button></div>}
    </div>
  );
}
