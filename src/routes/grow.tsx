import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, CheckCircle2, GraduationCap, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, Stat } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/grow")({
  head: () => ({ meta: [{ title: "Grow — UmurimoHub" }, { name: "description", content: "Build verified experience, skills and trusted relationships." }] }),
  component: Page,
});

function Page() {
  const { session, user } = useApp();
  const q = useQuery({
    queryKey: ["grow", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const uid = session!.user.id;
      const worker = user?.workerId;
      const [experiences, evidence, applications, teams] = await Promise.all([
        worker
          ? supabase.from("verified_experiences").select("id").eq("worker_id", worker)
          : Promise.resolve({ data: [], error: null }),
        worker
          ? supabase.from("reputation_evidence").select("id,evidence_type").eq("subject_type", "worker").eq("subject_id", worker)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("applications").select("id,status").eq("applicant_user_id", uid),
        supabase.from("team_members").select("team_id,worker_id").eq("worker_id", worker ?? ""),
      ]);
      return {
        experiences: experiences.data?.length ?? 0,
        evidence: evidence.data?.length ?? 0,
        applications: applications.data?.length ?? 0,
        teams: teams.data?.length ?? 0,
      };
    },
  });

  if (!session) {
    return (
      <div className="container-page py-16">
        <PageHeader eyebrow="Grow" title="Build a stronger work record" desc="Sign in to see your real progress." />
        <Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button>
      </div>
    );
  }

  const data = q.data ?? { experiences: 0, evidence: 0, applications: 0, teams: 0 };
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Grow" title="Grow your opportunity" desc="Turn real work into verified experience, evidence and stronger trusted relationships." />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={CheckCircle2} label="Verified projects" value={String(data.experiences)} />
        <Stat icon={Briefcase} label="Applications" value={String(data.applications)} />
        <Stat icon={Users} label="Team relationships" value={String(data.teams)} />
        <Stat icon={GraduationCap} label="Reputation evidence" value={String(data.evidence)} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card><h2 className="font-bold">Verified experience</h2><p className="mt-2 text-sm text-muted-foreground">Completed UmurimoHub contracts become durable evidence you can carry to the next opportunity.</p><Button className="mt-4" asChild><Link to="/dashboard">View dashboard</Link></Button></Card>
        <Card><h2 className="font-bold">Skills & training</h2><p className="mt-2 text-sm text-muted-foreground">Keep building skills and use verified assessments and employer evidence when those programs are available.</p><Button className="mt-4" variant="outline" asChild><Link to="/training">Explore training</Link></Button></Card>
        <Card><h2 className="font-bold">Trusted network</h2><p className="mt-2 text-sm text-muted-foreground">Build relationships from real work, referrals and collaboration instead of starting from zero.</p><Button className="mt-4" variant="outline" asChild><Link to="/network">Open network</Link></Button></Card>
      </div>
    </div>
  );
}
