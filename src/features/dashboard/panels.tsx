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
import { MoreVertical } from "lucide-react";

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
                {a.acceptedAt && a.status === "Accepted" && (
                  <span className="text-xs text-muted-foreground">
                    Accepted {new Date(a.acceptedAt).toLocaleString()}
                  </span>
                )}
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
  const { user, session } = useApp();
  const qc = useQueryClient();
  const ids = user?.businessIds ?? [];
  const q = useQuery({
    queryKey: ["incoming", ids],
    enabled: !!user && !!session,
    queryFn: async () => {
      let opportunitiesQuery = supabase.from("opportunities").select("id,title,status,created_by,business_id");
      opportunitiesQuery = ids.length
        ? opportunitiesQuery.or("created_by.eq." + session!.user.id + ",business_id.in.(" + ids.join(",") + ")")
        : opportunitiesQuery.eq("created_by", session!.user.id);
      const { data: opps } = await opportunitiesQuery;
      const oppIds = (opps ?? []).map((o) => o.id);
      if (!oppIds.length) return { opps: opps ?? [], apps: [] };
      const { data: apps } = await supabase.from("applications").select("*").in("opportunity_id", oppIds).order("created_at", { ascending: true });
      const rows = apps ?? [];
      const userIds = [...new Set(rows.map((a) => a.applicant_user_id).filter(Boolean))];
      const businessIds = [...new Set(rows.map((a) => a.applicant_business_id).filter(Boolean))];
      const teamIds = [...new Set(rows.map((a) => a.applicant_team_id).filter(Boolean))];
      const referrerIds = [...new Set(rows.map((a) => a.referred_by).filter(Boolean))];
      const [profiles, workers, businesses, teams, contracts, referrerProfiles, referrerWorkers, connections] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id,display_name,avatar_url").in("id", userIds) : Promise.resolve({ data: [] as { id: string; display_name: string; avatar_url: string | null }[] }),
        userIds.length ? supabase.from("worker_profiles").select("id,user_id,name,avatar_url,trust_score,years,rep").in("user_id", userIds) : Promise.resolve({ data: [] as { id: string; user_id: string | null; name: string; avatar_url: string | null }[] }),
        businessIds.length ? supabase.from("businesses").select("id,name,avatar_url").in("id", businessIds) : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null }[] }),
        teamIds.length ? supabase.from("teams").select("id,name,avatar_url").in("id", teamIds) : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null }[] }),
        supabase.from("contracts").select("id,application_id,opportunity_id").in("opportunity_id", oppIds),
        referrerIds.length ? supabase.from("profiles").select("id,display_name,avatar_url").in("id", referrerIds) : Promise.resolve({ data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] }),
        referrerIds.length ? supabase.from("worker_profiles").select("id,user_id,name,avatar_url").in("user_id", referrerIds) : Promise.resolve({ data: [] as { id: string; user_id: string | null; name: string; avatar_url: string | null }[] }),
        supabase.from("connections").select("id,requester,addressee,status").or("requester.eq." + user.id + ",addressee.eq." + user.id),
      ]);
      return { opps: opps ?? [], apps: rows, profiles: profiles.data ?? [], workers: workers.data ?? [], businesses: businesses.data ?? [], teams: teams.data ?? [], contracts: contracts.data ?? [], referrerProfiles: referrerProfiles.data ?? [], referrerWorkers: referrerWorkers.data ?? [], connections: connections.data ?? [] };
    },
  });
  const [contractApplication, setContractApplication] = useState<string | null>(null);
  if (!user || !session) return null;
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
                {apps.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No applicants yet. Applications and referrals will appear here.</p> : <div className="mt-4 space-y-4">
                  {groups.map(([kind, label, group]) => group.length ? (
                    <div key={kind}>
                      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{label}</h3>
                      <ul className="divide-y rounded-xl border">
                        {group.slice().sort((a, b) => {
                          const connected = (id: string) => q.data!.connections.some((x) => x.status === "accepted" && ((x.requester === user.id && x.addressee === id) || (x.addressee === user.id && x.requester === id)));
                          const aConnected = connected(a.applicant_user_id);
                          const bConnected = connected(b.applicant_user_id);
                          if (aConnected !== bConnected) return aConnected ? -1 : 1;
                          const aw = q.data!.workers.find((w) => w.user_id === a.applicant_user_id);
                          const bw = q.data!.workers.find((w) => w.user_id === b.applicant_user_id);
                          const trustDiff = Number(bw?.trust_score ?? 0) - Number(aw?.trust_score ?? 0);
                          if (trustDiff) return trustDiff;
                          const experienceDiff = Number(bw?.years ?? 0) - Number(aw?.years ?? 0);
                          if (experienceDiff) return experienceDiff;
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        }).map((a) => {
                          const profile = q.data.profiles.find((x) => x.id === a.applicant_user_id);
                          const worker = q.data.workers.find((x) => x.user_id === a.applicant_user_id);
                          const business = a.applicant_business_id ? q.data.businesses.find((x) => x.id === a.applicant_business_id) : undefined;
                          const team = a.applicant_team_id ? q.data.teams.find((x) => x.id === a.applicant_team_id) : undefined;
                          const displayName = business?.name ?? team?.name ?? worker?.name ?? profile?.display_name ?? "Applicant";
                          const avatar = business?.avatar_url ?? team?.avatar_url ?? worker?.avatar_url ?? profile?.avatar_url;
                          return (
                            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="relative">
                                  <Avatar initials={displayName.slice(0, 2).toUpperCase()} src={avatar} alt={displayName} size="md" />
                                  {a.referred_by && (() => {
                                    const rp = q.data.referrerProfiles.find((x) => x.id === a.referred_by);
                                    const rw = q.data.referrerWorkers.find((x) => x.user_id === a.referred_by);
                                    const connected = q.data.connections.some((x) => x.status === "accepted" && ((x.requester === user?.id && x.addressee === a.referred_by) || (x.addressee === user?.id && x.requester === a.referred_by)));
                                    return (
                                      <span
                                        title={(connected ? "Connected with " : "Not connected with ") + (rw?.name ?? rp?.display_name ?? "referrer")}
                                        className={"absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border-2 border-card text-[9px] font-bold " + (connected ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")}
                                      >
                                        {connected ? "↔" : "?"}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium">{displayName}</p>
                                  <p className="text-xs text-muted-foreground">{a.applicant_type ?? a.kind} · {a.status}</p>
                                  {a.note && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.note}</p>}
                                  {a.referred_by && (() => {
                                    const rp = q.data.referrerProfiles.find((x) => x.id === a.referred_by);
                                    const rw = q.data.referrerWorkers.find((x) => x.user_id === a.referred_by);
                                    const referrerName = rw?.name ?? rp?.display_name ?? "Trusted referrer";
                                    return <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Avatar initials={referrerName.slice(0, 2).toUpperCase()} src={rw?.avatar_url ?? rp?.avatar_url} alt={referrerName} size="sm" /><span>Referred by {referrerName}</span></div>;
                                  })()}
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
                </div>}
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


export function MyOpportunities() {
  const { user, session } = useApp();
  const qc = useQueryClient();
  const [menuId, setMenuId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["my-opportunities", session?.user.id, user?.businessIds],
    enabled: !!session && !!user,
    queryFn: async () => {
      if (!session || !user) return [];
      const businessIds = user.businessIds;
      let request = supabase.from("opportunities")
        .select("id,title,status,created_at,deadline,business_id")
        .order("created_at", { ascending: false })
        .limit(200);
      request = businessIds.length
        ? request.or("created_by.eq." + session.user.id + ",business_id.in.(" + businessIds.join(",") + ")")
        : request.eq("created_by", session.user.id);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!user || !session) return null;

  const changeStatus = async (id: string, status: string) => {
    const action = status === "closed" ? "end this opportunity" : status === "paused" ? "hide this opportunity temporarily" : "reopen this opportunity";
    if (!window.confirm("Are you sure you want to " + action + "?")) return;
    const { error } = await supabase.from("opportunities").update({ status }).eq("id", id);
    if (error) toast.error("Could not update opportunity: " + error.message);
    else {
      toast.success(status === "open" ? "Opportunity is visible again" : status === "closed" ? "Opportunity ended" : "Opportunity hidden temporarily");
      setMenuId(null);
      await Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: ["catalog"] })]);
    }
  };
  const removeOpportunity = async (id: string, title: string) => {
    if (!window.confirm('Delete "' + title + '"? This cannot be undone.')) return;
    const { error } = await supabase.from("opportunities").delete().eq("id", id);
    if (error) toast.error("Could not delete opportunity: " + error.message);
    else {
      toast.success("Opportunity deleted");
      setMenuId(null);
      await Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: ["catalog"] })]);
    }
  };

  return (
    <section className="mt-6" id="my-opportunities">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">My opportunities</h2>
            <p className="mt-1 text-sm text-muted-foreground">Manage postings, review applicants, and control visibility.</p>
          </div>
          <Button size="sm" asChild><Link to="/opportunities/new">Post opportunity</Link></Button>
        </div>
        {q.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading your opportunities…</p> :
         q.isError ? <p className="mt-4 text-sm text-destructive">Could not load your opportunities.</p> :
         !q.data?.length ? <p className="mt-4 text-sm text-muted-foreground">You have not posted any opportunities yet.</p> :
         <ul className="mt-3 divide-y">
           {q.data.map((o) => (
             <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
               <div className="min-w-0">
                 <Link to="/opportunities/$id" params={{ id: o.id }} className="font-medium hover:text-primary">{o.title}</Link>
                 <p className="mt-1 text-xs text-muted-foreground">Posted {new Date(o.created_at).toLocaleDateString()} · Deadline {o.deadline} · {o.status}</p>
               </div>
               <div className="flex items-center gap-2">
                 <Button size="sm" variant="outline" asChild><Link to="/opportunities/$id" params={{ id: o.id }}>Info & applicants</Link></Button>
                 <div className="relative">
                   <Button size="icon" variant="ghost" aria-label={"Actions for " + o.title} onClick={() => setMenuId(menuId === o.id ? null : o.id)}><MoreVertical className="size-4" /></Button>
                   {menuId === o.id && <div className="absolute right-0 top-10 z-30 w-48 rounded-2xl border bg-popover p-1 shadow-xl">
                     <Link to="/opportunities/$id/edit" params={{ id: o.id }} className="block rounded-xl px-3 py-2 text-sm hover:bg-muted" onClick={() => setMenuId(null)}>Edit</Link>
                     {o.status === "open" ? <>
                       <button className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => void changeStatus(o.id, "paused")}>Hide temporarily</button>
                       <button className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => void changeStatus(o.id, "closed")}>End posting</button>
                     </> : <>
                       <button className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => void changeStatus(o.id, "open")}>Publish / show again</button>
                     </>}
                     <button className="block w-full rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-muted" onClick={() => void removeOpportunity(o.id, o.title)}>Delete</button>
                   </div>}
                 </div>
               </div>
             </li>
           ))}
         </ul>}
      </Card>
      <div className="mt-4">
        <IncomingApplications />
      </div>
    </section>
  );
}
