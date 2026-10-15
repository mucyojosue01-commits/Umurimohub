import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";
import { DISTRICTS, SECTORS, type Team } from "@/features/data/demo";
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
  const { user } = useApp();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sector, setSector] = useState("");
  const [district, setDistrict] = useState("");
  const [availability, setAvailability] = useState("all");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const teamsQ = useQuery({
    queryKey: ["team-directory", debouncedQuery, sector, district, availability, user?.district],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_teams", {
        _q: debouncedQuery || null,
        _sector: sector || null,
        _district: district || null,
        _available: availability === "all" ? null : availability === "available",
        _preferred_district: user?.district || null,
        _limit: 30,
      });
      if (error) throw error;
      const rows = data ?? [];
      const mapped: Team[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        avatarUrl: row.avatar_url,
        trustScore: Number(row.trust_score ?? 0),
        leadId: row.lead_id ?? "",
        memberIds: row.member_ids ?? [],
        sector: row.sector as Team["sector"],
        areas: row.areas ?? [],
        rating: Number(row.rating ?? 0),
        projects: Number(row.projects ?? 0),
        available: row.available,
        summary: row.summary ?? "",
        skills: row.skills ?? [],
      }));
      return { teams: mapped, total: Number(rows[0]?.total_count ?? 0) };
    },
  });

  const resetFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setSector("");
    setDistrict("");
    setAvailability("all");
  };

  const teams = teamsQ.data?.teams ?? [];
  const total = teamsQ.data?.total ?? 0;

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Discover"
        title="Teams"
        desc="Find proven teams ranked by trust and ratings, with your district used as a secondary ranking signal."
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
        {teamsQ.isLoading ? "Searching teams…" : `Showing ${teams.length} of ${total} matching teams (maximum 30). Search or refine filters to find others.`}
      </p>
      {teamsQ.isError ? (
        <Card className="mt-4">
          <h2 className="font-semibold">Teams could not be loaded</h2>
          <p className="mt-1 text-sm text-muted-foreground">The directory search failed. Please retry.</p>
          <Button className="mt-4" onClick={() => void teamsQ.refetch()}>Retry</Button>
        </Card>
      ) : teamsQ.isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground" role="status">Loading ranked teams…</div>
      ) : teams.length === 0 ? (
        <Card className="mt-4"><h2 className="font-semibold">No teams match these filters</h2><p className="mt-1 text-sm text-muted-foreground">Try another search or clear some filters.</p></Card>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <div key={team.id} className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-2">
                <Pill tone="success">{Math.round(team.trustScore ?? 0)} trust</Pill>
                <Pill>{Number(team.rating ?? 0) > 0 ? Number(team.rating).toFixed(1) + " rating" : "Not rated yet"}</Pill>
              </div>
              <TeamCard t={team} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
