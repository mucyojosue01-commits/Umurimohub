import { createFileRoute, Link } from "@tanstack/react-router";
import { SearchX, SlidersHorizontal } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DISTRICTS, SECTORS } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { DemoNotice, EmptyState, OpportunityCard, PageHeader } from "@/features/ui/kit";

const search = z.object({
  q: z.string().optional().catch(""),
  district: z.string().optional().catch(""),
  sector: z.string().optional().catch(""),
  type: z.string().optional().catch(""),
  mode: z.string().optional().catch(""),
  team: z.boolean().optional().catch(false),
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
  const { allOpps } = useApp();
  const set = (k: string, v: unknown) =>
    nav({ search: (p) => ({ ...p, [k]: v || undefined }), replace: true });
  const list = allOpps.filter(
    (o) =>
      (!s.q ||
        `${o.title} ${o.skills.join(" ")} ${o.summary}`
          .toLowerCase()
          .includes(s.q.toLowerCase())) &&
      (!s.district || o.district === s.district) &&
      (!s.sector || o.sector === s.sector) &&
      (!s.type || o.type === s.type) &&
      (!s.mode || o.mode === s.mode) &&
      (!s.team || o.teamAllowed),
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
        <select
          aria-label="District"
          value={s.district ?? ""}
          onChange={(e) => set("district", e.target.value)}
          className={sel}
        >
          <option value="">All districts</option>
          {DISTRICTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          aria-label="Sector"
          value={s.sector ?? ""}
          onChange={(e) => set("sector", e.target.value)}
          className={sel}
        >
          <option value="">All sectors</option>
          {SECTORS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          aria-label="Type"
          value={s.type ?? ""}
          onChange={(e) => set("type", e.target.value)}
          className={sel}
        >
          <option value="">Any type</option>
          {["Job", "Project", "Gig", "Seasonal", "Apprenticeship"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          aria-label="Mode"
          value={s.mode ?? ""}
          onChange={(e) => set("mode", e.target.value)}
          className={sel}
        >
          <option value="">On-site / remote</option>
          {["On-site", "Remote", "Hybrid"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-2 text-sm">
          <input
            type="checkbox"
            checked={!!s.team}
            onChange={(e) => set("team", e.target.checked)}
          />
          Teams welcome
        </label>
      </div>
      <DemoNotice className="mt-4" />
      <p className="mt-6 text-sm text-muted-foreground">{list.length} results</p>
      {list.length ? (
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
