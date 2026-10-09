import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { PageHeader, TeamCard } from "@/features/ui/kit";

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
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Discover"
        title="Teams"
        desc="Hire a crew that has already delivered together."
        actions={user ? <Button asChild><Link to="/register" search={{ create: "team" }}>+ Create team</Link></Button> : undefined}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{teams.length === 0 && <p className="col-span-full py-12 text-center text-sm text-muted-foreground">No teams have joined yet.</p>}
        {teams.map((t) => (
          <div key={t.id} className="min-w-0">
            <TeamCard t={t} />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild><Link to="/teams/$id" params={{ id: t.id }}>View team</Link></Button>
              {user?.leadTeamIds.includes(t.id) && <Button size="sm" variant="secondary" asChild><Link to="/teams/$id" params={{ id: t.id }} search={{ edit: true }}>Edit team</Link></Button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
