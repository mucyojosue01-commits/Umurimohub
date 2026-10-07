import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, CheckCircle2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rwf } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { IncomingApplications, MyApplications, TeamInvites } from "@/features/dashboard/panels";
import { ContractsPanel, useContracts } from "@/features/contracts/panels";
import { MilestonesPanel } from "@/features/milestones/panels";
import { Card, OpportunityCard, PageHeader, Pill, Stat } from "@/features/ui/kit";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — UmurimoHub" },
      { name: "description", content: "Your applications, projects and payments." },
      { property: "og:title", content: "Dashboard — UmurimoHub" },
      { property: "og:description", content: "Your work at a glance." },
    ],
  }),
  component: Page,
});

function Page() {
  const { user, applications, allOpps, milestones, advanceMilestone, authReady } = useApp();
  const contractsQuery = useContracts();
  if (!authReady)
    return <div className="container-page py-20 text-center text-muted-foreground">Loading…</div>;
  if (!user)
    return (
      <div className="container-page py-20 text-center">
        <p>Please sign in to see your dashboard.</p>
        <Button className="mt-4" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  if (!user.onboarded)
    return (
      <div className="container-page py-20 text-center">
        <p>Finish setting up your profile to use your dashboard.</p>
        <Button className="mt-4" asChild>
          <Link to="/register">Complete profile</Link>
        </Button>
      </div>
    );
  const paid = milestones.filter((m) => m.status === "Paid").reduce((s, m) => s + m.amount, 0);
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow={`${user.roles.map((r) => r.replace("_", " ")).join(" · ")} dashboard`}
        title={`Muraho, ${user.name.split(" ")[0]}`}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={Briefcase} label="Applications" value={String(applications.length)} />
        <Stat
          icon={CheckCircle2}
          label="Milestones done"
          value={`${milestones.filter((m) => m.status === "Paid").length}/${milestones.length}`}
        />
        <Stat
          icon={Wallet}
          label="Received (demo)"
          value={rwf(paid)}
          hint="Paid via licensed partner (future)"
        />
      </div>
      <TeamInvites />
      <IncomingApplications />
      <MyApplications />
      <ContractsPanel />
      <MilestonesPanel contracts={contractsQuery.data ?? []} />
      <Card className="mt-6">
        <h2 className="font-bold">Project: 4-unit housing block (demo)</h2>
        <ul className="mt-3 divide-y">
          {milestones.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span>
                {m.title} · {rwf(m.amount)}
              </span>
              <span className="flex items-center gap-2">
                <Pill tone={m.status === "Paid" ? "success" : "muted"}>{m.status}</Pill>
                {m.status !== "Paid" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      advanceMilestone(m.id);
                      toast("Milestone updated");
                    }}
                  >
                    Advance
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <h2 className="mt-10 text-xl font-bold">Recommended for you</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allOpps.slice(0, 3).map((o) => (
          <OpportunityCard key={o.id} o={o} />
        ))}
      </div>
    </div>
  );
}
