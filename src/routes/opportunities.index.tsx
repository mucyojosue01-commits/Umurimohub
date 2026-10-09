import { createFileRoute, Link } from "@tanstack/react-router";
import { SearchX, SlidersHorizontal } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/search-select";
import { DISTRICTS, SECTORS } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { EmptyState, OpportunityCard, PageHeader } from "@/features/ui/kit";

const search = z.object({
  q: z.string().optional().catch(""),
  district: z.string().optional().catch(""),
  sector: z.string().optional().catch(""),
  type: z.string().optional().catch(""),
  mode: z.string().optional().catch(""),
  team: z.boolean().optional().catch(false),
  actor: z.string().optional().catch(""),
});

export const Route = createFileRoute("/opportunities/")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Opportunities in Rwanda — UmurimoHub" },
      {
        name: "description",
        content: "Jobs, projects, seasonal work and apprenticeships across Rwanda's districts.",
      },
      { property: "og:title", content: "Opportunities — UmurimoHub" },
      {
        property: "og:description",
        content: "Search jobs, projects and seasonal work by district, sector and skill.",
      },
    ],
  }),
  component: Page,
});

const sel = "h-10 rounded-full border bg-card px-3 text-sm";

function Page() {
  const s = Route.useSearch();
  const nav = Route.useNavigate();
  const { user } = useApp();
  const { opportunities: allOpps, loading, error } = useCatalog();
  const ownBusinessIds = new Set(user?.businessIds ?? []);
  const set = (k: string, v: unknown) =>
    nav({ search: (p) => ({ ...p, [k]: v || undefined }), replace: true });
  const list = allOpps.filter(
    (o) => !ownBusinessIds.has(o.businessId) &&
      (!s.q ||
        `${o.title} ${o.skills.join(" ")} ${o.summary}`
          .toLowerCase()
          .includes(s.q.toLowerCase())) &&
      (!s.district || o.district === s.district) &&
      (!s.sector || o.sector === s.sector) &&
      (!s.type || o.type === s.type) &&
      (!s.mode || o.mode === s.mode) &&
      (!s.team || o.teamAllowed) &&
      (!s.actor || (o.eligibleActorTypes ?? ["individual", "team", "business"]).includes(s.actor as "individual" | "team" | "business")),
  );
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Discover"
        title="Opportunities"
        desc="Jobs, projects, gigs, seasonal work and apprenticeships."
        actions={
          <Button asChild>
            <Link to="/opportunities/new">Post opportunity</Link>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <SlidersHorizontal className="ml-1 size-4 text-muted-foreground" />
        <input
          aria-label="Search"
          value={s.q ?? ""}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search skill or title"
          className={`${sel} min-w-48 flex-1`}
        />
        <div className="w-48"><SearchSelect value={s.district ?? ""} onChange={(v) => set("district", v)} placeholder="All districts" options={DISTRICTS.map((d) => ({ value: d, label: d }))} /></div>
        <div className="w-44"><SearchSelect value={s.sector ?? ""} onChange={(v) => set("sector", v)} placeholder="All sectors" options={SECTORS.map((d) => ({ value: d, label: d }))} /></div>
        <div className="w-36"><SearchSelect value={s.type ?? ""} onChange={(v) => set("type", v)} placeholder="Any type" options={["Job", "Project", "Gig", "Seasonal", "Apprenticeship"].map((d) => ({ value: d, label: d }))} /></div>
        <div className="w-40"><SearchSelect value={s.mode ?? ""} onChange={(v) => set("mode", v)} placeholder="Any mode" options={["On-site", "Remote", "Hybrid"].map((d) => ({ value: d, label: d }))} /></div>
        <div className="w-48"><SearchSelect
          value={s.actor ?? ""}
          onChange={(v) => set("actor", v)}
          placeholder="Allowed applicant type"
          options={[
            { value: "individual", label: "Individuals" },
            { value: "team", label: "Teams" },
            { value: "business", label: "Companies" },
          ]}
        /></div>
        <label className="flex items-center gap-2 px-2 text-sm">
          <input
            type="checkbox"
            checked={!!s.team}
            onChange={(e) => set("team", e.target.checked)}
          />
          Teams welcome
        </label>
      </div>
      {loading ? <p className="mt-6 text-sm text-muted-foreground">Loading opportunities…</p> : error ? <p className="mt-6 text-sm text-destructive">Opportunities could not be loaded. Please refresh and try again.</p> : <p className="mt-6 text-sm text-muted-foreground">{list.length} results</p>}
      {!loading && !error && (
      list.length ? (
        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((o) => (
            <OpportunityCard key={o.id} o={o} />
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            icon={SearchX}
            title="No matches yet"
            desc="Try another district or remove a filter."
            action={
              <Button variant="outline" onClick={() => nav({ search: {} })}>
                Clear filters
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
