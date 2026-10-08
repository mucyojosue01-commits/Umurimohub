import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCatalog } from "@/features/data/catalog";
import { useApp } from "@/features/store/app-store";
import { Avatar, Card, Pill } from "@/features/ui/kit";
import { CreateContractForm } from "@/features/contracts/panels";

type Status = "submitted" | "viewed" | "shortlisted" | "rejected" | "accepted" | "withdrawn";

export function MyApplications() {
  const { applications, allOpps, session, reloadUser } = useApp();
  const actorIds = applications.flatMap((a) => [a.businessId, a.teamId].filter(Boolean) as string[]);
  const actorsQ = useQuery({
    queryKey: ["my-application-actors", actorIds],
    enabled: !!session && applications.length > 0,
    queryFn: async () => {
      const [businesses, teams, profile] = await Promise.all([
        actorIds.length ? supabase.from("businesses").select("id,name,avatar_url").in("id", actorIds) : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null }[] }),
        actorIds.length ? supabase.from("teams").select("id,name,avatar_url").in("id", actorIds) : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null }[] }),
        session ? supabase.from("profiles").select("id,display_name,avatar_url").eq("id", session.user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const worker = session ? await supabase.from("worker_profiles").select("id,user_id,name,avatar_url").eq("user_id", session.user.id).maybeSingle() : { data: null };
      return { businesses: businesses.data ?? [], teams: teams.data ?? [], profile: profile.data ?? null, worker: worker.data ?? null };
    },
  });
  const title = (id: string) => allOpps.find((o) => o.id === id)?.title ?? "Opportunity";
  return (
    <Card className="mt-6">
      <h2 className="font-bold">My applications</h2>
      {!applications.length ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No applications yet.{" "}
          <Link to="/opportunities" className="text-primary">
            Browse opportunities
          </Link>
        </p>
      ) : (
        <ul className="mt-3 divide-y">
          {applications.map((a) => {
            const business = actorsQ.data?.businesses.find((x) => x.id === a.businessId);
            const team = actorsQ.data?.teams.find((x) => x.id === a.teamId);
            const displayName = business?.name ?? team?.name ?? actorsQ.data?.profile?.display_name ?? "Applicant";
            const avatar = business?.avatar_url ?? team?.avatar_url ?? actorsQ.data?.worker?.avatar_url ?? actorsQ.data?.profile?.avatar_url;
            return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar initials={displayName.slice(0, 2).toUpperCase()} src={avatar} alt={displayName} size="md" />
                <Link
                  to="/opportunities/$id"
                  params={{ id: a.oppId }}
                  className="font-medium hover:text-primary"
                >
                  {title(a.oppId)}
                </Link>
              </div>
              <span className="flex items-center gap-2">
                {a.termsVersion && a.acceptedTermsVersion !== undefined && a.termsVersion > a.acceptedTermsVersion && a.status !== "Withdrawn" && a.status !== "Rejected" && (
                  <span className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-2 py-1 text-xs">
                    <span>Terms changed</span>
                    <Button size="sm" onClick={async () => { const { error } = await supabase.rpc("respond_to_opportunity_change", { _application_id: a.id, _accept: true }); if (error) toast.error(error.message); else { toast.success("Updated terms accepted"); await reloadUser(); } }}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={async () => { const { error } = await supabase.rpc("respond_to_opportunity_change", { _application_id: a.id, _accept: false }); if (error) toast.error(error.message); else { toast.success("Updated terms declined; application withdrawn"); await reloadUser(); } }}>Decline</Button>
                  </span>
                )}
                <Pill
                  tone={
                    a.status === "Accepted"
                      ? "success"
                      : a.status === "Shortlisted"
                        ? "primary"
                        : "muted"
                  }
                >
                  {a.status}
                </Pill>
                {session && !["Withdrawn", "Accepted", "Rejected"].includes(a.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const { error } = await supabase
                        .from("applications")
                        .update({ status: "withdrawn" })
                        .eq("id", a.id);
                      if (error) toast.error(error.message);
                      else {
                        toast("Application withdrawn");
                        await reloadUser();
                      }
                    }}
                  >
                    Withdraw
                  </Button>
                )}
              </span>
            </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function IncomingApplications() {
  const { user } = useApp();
  const qc = useQueryClient();
  const ids = user?.businessIds ?? [];
  const q = useQuery({
    queryKey: ["incoming", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data: opps } = await supabase
        .from("opportunities")
        .select("id,title,status")
        .in("business_id", ids);
      const oppIds = (opps ?? []).map((o) => o.id);
      if (!oppIds.length) return { opps: opps ?? [], apps: [] };
      const { data: apps } = await supabase.from("applications").select("*").in("opportunity_id", oppIds).order("created_at", { ascending: false });
      const rows = apps ?? [];
      const userIds = [...new Set(rows.map((a) => a.applicant_user_id).filter(Boolean))];
      const businessIds = [...new Set(rows.map((a) => a.applicant_business_id).filter(Boolean))];
      const teamIds = [...new Set(rows.map((a) => a.applicant_team_id).filter(Boolean))];
      const [profiles, workers, businesses, teams, contracts] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id,display_name,avatar_url").in("id", userIds) : Promise.resolve({ data: [] as { id: string; display_name: string; avatar_url: string | null }[] }),
        userIds.length ? supabase.from("worker_profiles").select("id,user_id,name,avatar_url").in("user_id", userIds) : Promise.resolve({ data: [] as { id: string; user_id: string | null; name: string; avatar_url: string | null }[] }),
        businessIds.length ? supabase.from("businesses").select("id,name,avatar_url").in("id", businessIds) : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null }[] }),
        teamIds.length ? supabase.from("teams").select("id,name,avatar_url").in("id", teamIds) : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null }[] }),
        supabase.from("contracts").select("id,application_id,opportunity_id").in("opportunity_id", oppIds),
      ]);
      return { opps: opps ?? [], apps: rows, profiles: profiles.data ?? [], workers: workers.data ?? [], businesses: businesses.data ?? [], teams: teams.data ?? [], contracts: contracts.data ?? [] };
    },
  });
  const [contractApplication, setContractApplication] = useState<string | null>(null);
  if (!ids.length) return null;
  const setStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Marked ${status}`);
      void qc.invalidateQueries({ queryKey: ["incoming"] });
    }
  };
  return (
    <Card className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Applicants to your opportunities</h2>
        <Button size="sm" asChild>
          <Link to="/opportunities/new">Post new</Link>
        </Button>
      </div>
      {q.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      ) : !q.data?.apps.length ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No applicants yet. You have {q.data?.opps.length ?? 0} posted opportunities.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {(q.data.opps ?? []).map((opp) => {
            const apps = q.data.apps.filter((a) => a.opportunity_id === opp.id);
            if (!apps.length) return null;
            const groups = [
              ["business", "Businesses", apps.filter((a) => a.applicant_type === "business")],
              ["team", "Teams", apps.filter((a) => a.applicant_type === "team")],
              ["individual", "Users", apps.filter((a) => a.applicant_type === "individual" || !a.applicant_type)],
            ] as const;
            return (
              <section key={opp.id} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link to="/opportunities/$id" params={{ id: opp.id }} className="font-semibold hover:text-primary">{opp.title}</Link>
                  <Pill>{apps.length} applicant{apps.length === 1 ? "" : "s"}</Pill>
                </div>
                <div className="mt-4 space-y-4">
                  {groups.map(([kind, label, group]) => group.length ? (
                    <div key={kind}>
                      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{label}</h3>
                      <ul className="divide-y rounded-xl border">
                        {group.map((a) => {
                          const profile = q.data.profiles.find((x) => x.id === a.applicant_user_id);
                          const worker = q.data.workers.find((x) => x.user_id === a.applicant_user_id);
                          const business = a.applicant_business_id ? q.data.businesses.find((x) => x.id === a.applicant_business_id) : undefined;
                          const team = a.applicant_team_id ? q.data.teams.find((x) => x.id === a.applicant_team_id) : undefined;
                          const displayName = business?.name ?? team?.name ?? worker?.name ?? profile?.display_name ?? "Applicant";
                          const avatar = business?.avatar_url ?? team?.avatar_url ?? worker?.avatar_url ?? profile?.avatar_url;
                          return (
                            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <Avatar initials={displayName.slice(0, 2).toUpperCase()} src={avatar} alt={displayName} size="md" />
                                <div className="min-w-0">
                                  <p className="font-medium">{displayName}</p>
                                  <p className="text-xs text-muted-foreground">{a.applicant_type ?? a.kind} · {a.status}</p>
                                  {a.note && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.note}</p>}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Pill tone={a.status === "accepted" ? "success" : a.status === "shortlisted" ? "primary" : "muted"}>{a.status}</Pill>
                                {a.status !== "withdrawn" && (["viewed", "shortlisted", "accepted", "rejected"] as Status[]).filter((s) => s !== a.status).map((s) => (
                                  <Button key={s} size="sm" variant="outline" onClick={() => setStatus(a.id, s)}>{s}</Button>
                                ))}
                                {a.status === "accepted" && (
                                  <Button size="sm" onClick={() => {
                                    const existing = q.data.contracts.find((contract) => contract.opportunity_id === a.opportunity_id);
                                    if (existing && !window.confirm("Are you sure you want to make this other contract?")) return;
                                    setContractApplication(a.id);
                                  }}>
                                    {q.data.contracts.some((contract) => contract.opportunity_id === a.opportunity_id) ? "Create another contract" : "Create contract"}
                                  </Button>
                                )}
                              </div>
                              {a.status === "accepted" && contractApplication === a.id && (
                                <div className="w-full">
                                  <CreateContractForm applicationId={a.id} onDone={() => setContractApplication(null)} />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function TeamInvites() {
  const { user, reloadUser } = useApp();
  const navigate = useNavigate();
  const { getTeam, refresh } = useCatalog();
  const qc = useQueryClient();
  const wid = user?.workerId;
  const q = useQuery({
    queryKey: ["invites", wid],
    enabled: !!wid,
    queryFn: async () =>
      (
        await supabase
          .from("team_members")
          .select("*")
          .eq("worker_id", wid!)
          .eq("status", "invited")
      ).data ?? [],
  });
  if (!q.data?.length) return null;
  const respond = async (teamId: string, accept: boolean) => {
    const r = accept
      ? await supabase.rpc("accept_team_invitation", { _team_id: teamId, _worker_id: wid! })
      : await supabase.from("team_members").delete().eq("team_id", teamId).eq("worker_id", wid!);
    if (r.error) toast.error(r.error.message);
    else {
      toast.success(accept ? "Joined team" : "Invite declined");
      void qc.invalidateQueries({ queryKey: ["invites"] });
      void refresh();
      void reloadUser();
      if (accept) navigate({ to: "/dashboard", hash: "invitations" });
    }
  };
  return (
    <Card id="invitations" className="mt-6">
      <h2 className="font-bold">Team invitations</h2>
      <ul className="mt-3 divide-y">
        {q.data.map((m) => (
          <li key={m.team_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span>{getTeam(m.team_id)?.name ?? "A team"}</span>
            <span className="flex gap-2">
              <Button size="sm" onClick={() => respond(m.team_id, true)}>
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => respond(m.team_id, false)}>
                Decline
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
