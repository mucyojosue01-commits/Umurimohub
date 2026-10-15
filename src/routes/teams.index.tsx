import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { DISTRICTS, SECTORS } from "@/features/data/demo";
import { Card, PageHeader, Pill, TeamCard } from "@/features/ui/kit";

export const Route = createFileRoute("/teams/")({
  head: () => ({
    meta: [
      { title: "Hire proven teams — UmurimoHub" },
      {
        name: "description",
        content: "Crews and teams with shared project history across Rwanda.",
      },
      { property: "og:title", content: "Teams — UmurimoHub" },
      { property: "og:description", content: "Hire a team that has delivered together before." },
    ],
  }),
  component: Page,
});

function Page() {
  const { teams } = useCatalog();
  const { user } = useApp();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [district, setDistrict] = useState("");
  const [availability, setAvailability] = useState("all");

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams
      .filter((team) => {
        const searchable = [team.name, team.sector, team.summary, ...team.areas, ...team.skills].join(" ").toLowerCase();
        const matchesQuery = !q || searchable.includes(q);
        const matchesSector = !sector || team.sector === sector;
        const matchesDistrict = !district || team.areas.some((area) => area.toLowerCase().includes(district.toLowerCase()));
        const matchesAvailability = availability === "all" || (availability === "available" ? team.available : !team.available);
        return matchesQuery && matchesSector && matchesDistrict && matchesAvailability;
      })
      .sort((a, b) => {
        const trust = Number(b.trustScore ?? 0) - Number(a.trustScore ?? 0);
        if (trust) return trust;
        const rating = Number(b.rating ?? 0) - Number(a.rating ?? 0);
        if (rating) return rating;
        const userDistrict = user?.district.trim().toLowerCase();
        if (userDistrict) {
          const aNearby = a.areas.some((area) => area.toLowerCase().includes(userDistrict));
          const bNearby = b.areas.some((area) => area.toLowerCase().includes(userDistrict));
          if (aNearby !== bNearby) return aNearby ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, 30);
  }, [teams, query, sector, district, availability, user?.district]);

  const resetFilters = () => {
    setQuery("");
    setSector("");
    setDistrict("");
    setAvailability("all");
  };

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Discover"
        title="Teams"
        desc="Find proven teams ranked by trust and ratings, with teams in your district prioritized when scores are comparable."
        actions={user ? <Button asChild><Link to="/register" search={{ create: "team" }}>+ Create team</Link></Button> : undefined}
      />
      <Card className="mt-6 space-y-4 p-4 md:p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Search teams" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team name, skills, or work area" className="h-11 w-full rounded-xl border bg-background pl-9 pr-3" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">Sector
            <select className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={sector} onChange={(event) => setSector(event.target.value)}>
              <option value="">All sectors</option>{SECTORS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm">District / work area
            <select className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={district} onChange={(event) => setDistrict(event.target.value)}>
              <option value="">All districts</option>{DISTRICTS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm">Availability
            <select className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={availability} onChange={(event) => setAvailability(event.target.value)}>
              <option value="all">All teams</option><option value="available">Available</option><option value="unavailable">Unavailable</option>
            </select>
          </label>
          <div className="flex items-end"><Button className="w-full" variant="outline" onClick={resetFilters}>Clear filters</Button></div>
        </div>
      </Card>
      <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
        Showing {filteredTeams.length} top-ranked {filteredTeams.length === 1 ? "team" : "teams"} (maximum 30). Refine the search or filters to find others.
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTeams.length === 0 ? (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">No teams match these filters. Try another search or clear some filters.</p>
        ) : filteredTeams.map((team) => (
          <div key={team.id} className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Pill tone="success">{Math.round(team.trustScore ?? 0)} trust</Pill>
              <Pill>{Number(team.rating ?? 0) > 0 ? Number(team.rating).toFixed(1) + " rating" : "Not rated yet"}</Pill>
            </div>
            <TeamCard t={team} />
          </div>
        ))}
      </div>
    </div>
  );
}
