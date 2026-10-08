import { db } from "@/lib/pending-db";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, FileText, Milestone, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, Stat } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/company")({
  head: () => ({ meta: [{ title: "Company — UmurimoHub" }, { name: "description", content: "Manage your businesses, opportunities, applicants and projects." }] }),
  component: Page,
});

function Page() {
  const { session, user } = useApp();
  const q = useQuery({
    queryKey: ["company", session?.user.id, user?.businessIds],
    enabled: !!session && !!user?.businessIds.length,
    queryFn: async () => {
      const ids = user!.businessIds;
      const [businesses, opportunities, applications, contracts, milestones] = await Promise.all([
        supabase.from("businesses").select("*").in("id", ids),
        supabase.from("opportunities").select("id,status").in("business_id", ids),
        supabase.from("applications").select("id,status,opportunity_id").in("opportunity_id",
          (await supabase.from("opportunities").select("id").in("business_id", ids)).data?.map((x) => x.id) ?? []),
        supabase.from("contracts").select("id,status,business_id").in("business_id", ids),
        db.from("milestones").select("id,status,contract_id").in("contract_id",
          (await supabase.from("contracts").select("id").in("business_id", ids)).data?.map((x) => x.id) ?? []),
      ]);
      return {
        businesses: businesses.data ?? [],
        opportunities: opportunities.data ?? [],
        applications: applications.data ?? [],
        contracts: contracts.data ?? [],
        milestones: milestones.data ?? [],
      };
    },
  });

  if (!session) return <div className="container-page py-16"><PageHeader title="Company" desc="Sign in to manage your business." /><Button className="mt-4" asChild><Link to="/login">Sign in</Link></Button></div>;
  if (!user?.businessIds.length) return <div className="container-page py-16"><PageHeader eyebrow="Company" title="Create your business" desc="A business profile is required before you can publish opportunities or manage hiring." /><Button className="mt-4" asChild><Link to="/register">Create business profile</Link></Button></div>;

  const data = q.data;
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Company" title="Your business workspace" desc="Manage real hiring activity, applicants, contracts and milestones." actions={<Button asChild><Link to="/opportunities/new">Post opportunity</Link></Button>} />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Briefcase} label="Open opportunities" value={String(data?.opportunities.filter((x) => x.status === "open").length ?? 0)} />
        <Stat icon={Users} label="Applications" value={String(data?.applications.length ?? 0)} />
        <Stat icon={FileText} label="Contracts" value={String(data?.contracts.length ?? 0)} />
        <Stat icon={Milestone} label="Milestones" value={String(data?.milestones.length ?? 0)} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {(data?.businesses ?? []).map((b) => (
          <Card key={b.id}>
            <h2 className="text-lg font-bold">{b.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{b.sector} · {b.district}</p>
            <p className="mt-3 text-sm">{b.about || "No company description yet."}</p>
          </Card>
        ))}
        <Card>
          <h2 className="font-bold">Hiring workspace</h2>
          <p className="mt-2 text-sm text-muted-foreground">Review applications, create contracts, define milestones and complete projects from your dashboard.</p>
          <Button className="mt-4" asChild><Link to="/dashboard">Open dashboard</Link></Button>
        </Card>
      </div>
    </div>
  );
}
