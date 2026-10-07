import { createFileRoute } from "@tanstack/react-router";
import { useCatalog } from "@/features/data/catalog";
import { DemoNotice, PageHeader, TeamCard } from "@/features/ui/kit";

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
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Discover"
        title="Teams"
        desc="Hire a crew that has already delivered together."
      />
      <DemoNotice />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => (
          <TeamCard key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}
