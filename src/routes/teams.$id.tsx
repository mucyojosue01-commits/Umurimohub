import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Star, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mapWorker, mapTeam } from "@/features/data/mappers";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/store/app-store";
import { TeamInvite } from "@/features/network/team-invite";
import { Avatar, Card, DemoNotice, Pill, WorkerCard } from "@/features/ui/kit";

export const Route = createFileRoute("/teams/$id")({
  loader: async ({ params }) => {
    const { data: raw, error } = await supabase.from("teams").select("*").eq("id", params.id).eq("is_demo", false).maybeSingle();
    if (error) throw new Error("Team data could not be loaded: " + error.message);
    if (!raw) throw notFound();
    const { data: members, error: memberError } = await supabase.from("team_members").select("*").eq("team_id", params.id).eq("status", "active");
    if (memberError) throw new Error("Team members could not be loaded: " + memberError.message);
    const workerIds = [...new Set((members ?? []).map((m) => m.worker_id))];
    if (!workerIds.length) return { t: mapTeam(raw, members ?? []), memberWorkers: [] };
    const [workersResult, skillsResult, profilesResult] = await Promise.all([
      supabase.from("worker_profiles").select("*").in("id", workerIds),
      supabase.from("worker_skills").select("*").in("worker_id", workerIds),
      supabase.from("profiles").select("id,avatar_url").limit(500),
    ]);
    if (workersResult.error) throw new Error("Team member profiles could not be loaded: " + workersResult.error.message);
    if (skillsResult.error) throw new Error("Team member skills could not be loaded: " + skillsResult.error.message);
    if (profilesResult.error) throw new Error("Team member pictures could not be loaded: " + profilesResult.error.message);
    const profileAvatars = new Map((profilesResult.data ?? []).map((p) => [p.id, p.avatar_url]));
    const t = {
      ...mapTeam(raw, members ?? []),
      avatarUrl: raw.avatar_url ?? (raw.lead_user_id ? profileAvatars.get(raw.lead_user_id) ?? null : null),
    };
    const memberWorkers = (workersResult.data ?? []).map((w) => {
      const mapped = mapWorker(w, skillsResult.data ?? [], members ?? []);
      return { ...mapped, avatarUrl: mapped.avatarUrl ?? (w.user_id ? profileAvatars.get(w.user_id) ?? null : null) };
    });
    return { t, memberWorkers };
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
  const { t, memberWorkers } = Route.useLoaderData();
  const lead = memberWorkers.find((w) => w.id === t.leadId);
  const { user } = useApp();
  const isLead = user?.leadTeamIds.includes(t.id) ?? false;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(t.name);
  const [summary, setSummary] = useState(t.summary);
  const [areas, setAreas] = useState(t.areas.join(", "));
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); const { error } = await supabase.from("teams").update({ name: name.trim(), summary: summary.trim(), areas: areas.split(",").map((x) => x.trim()).filter(Boolean) }).eq("id", t.id); setBusy(false); if (error) toast.error(error.message); else { toast.success("Team updated"); setEditing(false); window.location.reload(); } };
  const removeMember = async (workerId: string, workerName: string) => { const reason = window.prompt("Reason for removing " + workerName + " from the team:"); if (!reason?.trim()) return; const { error } = await supabase.rpc("remove_team_member", { _team_id: t.id, _worker_id: workerId, _reason: reason.trim() }); if (error) toast.error(error.message); else { toast.success(workerName + " was removed and notified."); window.location.reload(); } };
  const remove = async () => { if (!window.confirm("Delete this team? This cannot be undone.")) return; setBusy(true); const { error } = await supabase.from("teams").delete().eq("id", t.id); setBusy(false); if (error) toast.error("This team cannot be deleted while it has dependent work or members."); else window.location.href = "/teams"; };
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
          <div className="flex flex-wrap gap-2">{isLead && <><Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel edit" : "Edit team"}</Button><Button size="sm" variant="outline" onClick={remove} disabled={busy}>Delete</Button></>}<Button size="lg" onClick={() => toast.success("Hire request sent to " + t.name)} disabled={!t.available}>{t.available ? "Hire team" : "Currently booked"}</Button></div>
        </div>
      </Card>
      {editing && isLead && (
        <Card className="mt-4">
          <div className="grid gap-3">
            <label className="text-sm">Team name<input className="mt-1 h-10 w-full rounded-xl border bg-card px-3" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="text-sm">Summary<textarea className="mt-1 w-full rounded-xl border bg-card p-3" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
            <label className="text-sm">Service areas<input className="mt-1 h-10 w-full rounded-xl border bg-card px-3" value={areas} onChange={(e) => setAreas(e.target.value)} /></label>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
          </div>
        </Card>
      )}
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
          const w = memberWorkers.find((worker) => worker.id === id);
          return w ? (
            <div key={id} className="space-y-2">
              <WorkerCard w={w} />
              {isLead && id !== t.leadId && <Button size="sm" variant="outline" onClick={() => void removeMember(id, w.name)}>Remove from team</Button>}
            </div>
          ) : null;
        })}
      </div>
      <TeamInvite teamId={t.id} memberIds={t.memberIds} />
      <DemoNotice className="mt-6" />
    </div>
  );
}
