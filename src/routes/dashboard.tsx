import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, CheckCircle2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { IncomingApplications, MyApplications, TeamInvites } from "@/features/dashboard/panels";
import { ContractsPanel, useContracts } from "@/features/contracts/panels";
import { MilestonesPanel } from "@/features/milestones/panels";
import { CompletionPanel } from "@/features/completion/panels";
import { OpportunityCard, PageHeader, Stat } from "@/features/ui/kit";

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
  const { user, applications, allOpps, authReady } = useApp();
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
  return (\n    <div className="container-page py-10">\n      <PageHeader eyebrow={user.roles.map((r) => r.replace("_", " ")).join(" · ") + " dashboard"} title={"Muraho, " + user.name.split(" ")[0]} />\n      <div className="grid gap-4 md:grid-cols-3">\n        <Stat icon={Briefcase} label="Applications" value={String(applications.length)} />\n        <Stat icon={CheckCircle2} label="Contracts & projects" value={String(contractsQuery.data?.length ?? 0)} />\n        <Stat icon={Wallet} label="Payment status" value="Not enabled yet" hint="Payments come after project verification." />\n      </div>\n      <TeamInvites />\n      <IncomingApplications />\n      <MyApplications />\n      <ContractsPanel />\n      <MilestonesPanel contracts={contractsQuery.data ?? []} />\n      <CompletionPanel contracts={contractsQuery.data ?? []} />\n      <h2 className="mt-10 text-xl font-bold">Recommended for you</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allOpps.slice(0, 3).map((o) => (
          <OpportunityCard key={o.id} o={o} />
        ))}
      </div>
    </div>
  );
}
