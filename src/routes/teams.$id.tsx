import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Star, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { catalogQuery, useCatalog } from "@/features/data/catalog";
import { TeamInvite } from "@/features/network/team-invite";
import { Avatar, Card, DemoNotice, Pill, WorkerCard } from "@/features/ui/kit";

export const Route = createFileRoute("/teams/$id")({
  loader: async ({ params, context }) => {
    const c = await context.queryClient.ensureQueryData(catalogQuery);
    const t = c.teams.find((x) => x.id === params.id);
    if (!t) throw notFound();
    return { t };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.t.name} — Team | UmurimoHub` : "Team — UmurimoHub";
    return {
      meta: [
        { title },
        { name: "description", content: loaderData?.t.summary ?? "Team profile" },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData?.t.summary ?? "Team profile" },
      ],
    };
  },
  component: Page,
  errorComponent: () => (
    <div className="container-page py-20 text-center">Couldn't load this team.</div>
  ),
  notFoundComponent: () => (
    <div className="container-page py-20 text-center">
      Team not found.{" "}
      <Link to="/teams" className="text-primary">
        Browse teams
      </Link>
    </div>
  ),
});

function Page() {
  const { t: loaded } = Route.useLoaderData();
  const { getWorker, getTeam } = useCatalog();
  const t = getTeam(loaded.id) ?? loaded;
  const lead = getWorker(t.leadId);
  return (
    <div className="container-page py-10">
      <Card className="p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3"><Avatar initials={t.name.slice(0,2).toUpperCase()} src={t.avatarUrl} alt={t.name} /><div><Pill tone="primary">{t.sector}</Pill><h1 className="mt-2 text-3xl font-extrabold">{t.name}</h1>
            <p className="mt-1 text-muted-foreground">{t.summary}</p></div></div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-accent text-accent" />
                {t.rating}
              </span>
              <span>{t.projects} verified projects</span>
              <span className="flex items-center gap-1">
                <Users className="size-4" />
                Lead: {lead?.name}
              </span>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => toast.success(`Hire request sent to ${t.name}`)}
            disabled={!t.available}
          >
            {t.available ? "Hire team" : "Currently booked"}
          </Button>
        </div>
      </Card>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-bold">Combined skills</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {t.skills.map((s) => (
              <Pill key={s}>{s}</Pill>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold">Service areas</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {t.areas.map((s) => (
              <Pill key={s} tone="primary">
                {s}
              </Pill>
            ))}
          </div>
        </Card>
      </div>
      <h2 className="mt-10 text-xl font-bold">Members</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {t.memberIds.map((id) => {
          const w = getWorker(id);
          return w && <WorkerCard key={id} w={w} />;
        })}
      </div>
      <TeamInvite teamId={t.id} memberIds={t.memberIds} />
      <DemoNotice className="mt-6" />
    </div>
  );
}
