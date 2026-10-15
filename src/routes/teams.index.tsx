import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { Card, PageHeader, TeamCard } from "@/features/ui/kit";
import { DISTRICTS, SECTORS } from "@/features/data/demo";

function teamField(team: unknown, key: string): unknown {
  return (team as Record<string, unknown>)[key];
}

export const Route = createFileRoute("/teams/")({
  head: () => ({
    meta: [
      { title: "Hire proven teams — UmurimoHub" },
      { name: "description", content: "Crews and teams with shared project history across Rwanda." },
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
  const [district, setDistrict] = useState("");
  const [sector, setSector] = useState("");
  const [verification, setVerification] = useState("all");
  const userDistrict = (user as (typeof user & { district?: string }) | null)?.district?.trim().toLowerCase() ?? "";
  const rankedTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter((team) => {
      const name = String(teamField(team, "name") ?? "");
      const description = String(teamField(team, "about") ?? teamField(team, "description") ?? "");
      const teamDistrict = String(teamField(team, "district") ?? "");
      const teamSector = String(teamField(team, "sector") ?? "");
      const verified = Boolean(teamField(team, "verified"));
      const matchesText = !q || [name, description, teamDistrict, teamSector].join(" ").toLowerCase().includes(q);
      return matchesText && (!district || teamDistrict === district) && (!sector || teamSector === sector) &&
        (verification === "all" || (verification === "verified" ? verified : !verified));
    }).sort((a, b) => {
      const trust = Number(Boolean(teamField(b, "verified"))) - Number(Boolean(teamField(a, "verified")));
      const scoreA = Number(teamField(a, "trust_score") ?? teamField(a, "score") ?? teamField(a, "rating") ?? 0);
      const scoreB = Number(teamField(b, "trust_score") ?? teamField(b, "score") ?? teamField(b, "rating") ?? 0);
      const localA = String(teamField(a, "district") ?? "").trim().toLowerCase() === userDistrict;
      const localB = String(teamField(b, "district") ?? "").trim().toLowerCase() === userDistrict;
      return trust || scoreB - scoreA || Number(localB) - Number(localA) || String(teamField(a, "name") ?? "").localeCompare(String(teamField(b, "name") ?? ""));
    }).slice(0, 30);
  }, [teams, query, district, sector, verification, userDistrict]);
  const reset = () => { setQuery(""); setDistrict(""); setSector(""); setVerification("all"); };
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Discover"
        title="Teams"
        desc="Discover trusted teams ranked by verification and score, with nearby teams used as a secondary sort. Search to find more than the first 30."
        actions={user ? <Button asChild><Link to="/register" search={{ create: "team" }}>+ Create team</Link></Button> : undefined}
      />
      <Card className="mt-6 space-y-4 p-4 md:p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Search teams" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team name, skills, sector or district" className="h-11 w-full rounded-xl border bg-background pl-9 pr-3" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">Sector<select className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={sector} onChange={(e) => setSector(e.target.value)}><option value="">All sectors</option>{SECTORS.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          <label className="text-sm">District<select className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={district} onChange={(e) => setDistrict(e.target.value)}><option value="">All districts</option>{DISTRICTS.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          <label className="text-sm">Verification<select className="mt-1 h-11 w-full rounded-xl border bg-background px-3" value={verification} onChange={(e) => setVerification(e.target.value)}><option value="all">All teams</option><option value="verified">Verified only</option><option value="unverified">Not yet verified</option></select></label>
          <div className="flex items-end"><Button className="w-full" variant="outline" onClick={reset}>Clear filters</Button></div>
        </div>
      </Card>
      <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">Showing {rankedTeams.length} of {teams.length} teams. Refine the search to find other teams.</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rankedTeams.length === 0 ? <p className="col-span-full py-12 text-center text-sm text-muted-foreground">No matching teams. Try another search or clear some filters.</p> : rankedTeams.map((t) => <div key={t.id} className="min-w-0"><TeamCard t={t} /></div>)}
      </div>
    </div>
  );
}
