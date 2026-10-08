import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, Pill, Avatar } from "@/features/ui/kit";
import { DISTRICTS } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/training")({
  head: () => ({ meta: [{ title: "Skills & training — UmurimoHub" }] }),
  component: Page,
});

type Training = {
  id: string;
  created_by: string;
  title: string;
  description: string;
  district: string;
  provider_type: string;
  status: string;
};

type TrainingApplication = {
  id: string;
  training_id: string;
  applicant_user_id: string;
  worker_id: string;
  status: string;
  note: string;
};

function Page() {
  const { session, user } = useApp();
  const { workers } = useCatalog();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", district: "", provider_type: "business" });

  const programsQ = useQuery({
    queryKey: ["training-programs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_programs").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Training[];
    },
  });

  const applicationsQ = useQuery({
    queryKey: ["training-applications", session?.user.id, programsQ.data?.map((p) => p.id).join(",")],
    enabled: !!session && !!programsQ.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("training_applications").select("*").order("applied_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingApplication[];
    },
  });

  const profileIds = useMemo(() => [...new Set((applicationsQ.data ?? []).map((a) => a.applicant_user_id))], [applicationsQ.data]);
  const profilesQ = useQuery({
    queryKey: ["training-applicant-profiles", profileIds.join(",")],
    enabled: profileIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", profileIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const openCreate = () => {
    setEditing("new");
    setForm({ title: "", description: "", district: "", provider_type: "business" });
  };

  const openEdit = (x: Training) => {
    setEditing(x.id);
    setForm({ title: x.title, description: x.description, district: x.district, provider_type: x.provider_type });
  };

  const save = async () => {
    if (!session) return;
    if (form.title.trim().length < 3 || !form.district) {
      toast.error("Enter a training title and district.");
      return;
    }
    setBusy("save");
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      district: form.district,
      provider_type: form.provider_type,
      created_by: session.user.id,
      updated_at: new Date().toISOString(),
    };
    const result = editing === "new"
      ? await supabase.from("training_programs").insert(payload)
      : await supabase.from("training_programs").update(payload).eq("id", editing);
    setBusy(null);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(editing === "new" ? "Training published" : "Training updated");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["training-programs"] });
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this training program? Applications will also be removed.")) return;
    setBusy(id);
    const { error } = await supabase.from("training_programs").delete().eq("id", id);
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Training deleted");
      void qc.invalidateQueries({ queryKey: ["training-programs"] });
    }
  };

  const apply = async (trainingId: string) => {
    if (!session) { toast.error("Sign in to apply."); return; }
    setBusy(trainingId);
    const { error } = await supabase.rpc("apply_training", { _training_id: trainingId, _note: "" });
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Training application sent");
      void qc.invalidateQueries({ queryKey: ["training-applications"] });
    }
  };

  const shortlist = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("shortlist_training_application", { _application_id: id });
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Applicant shortlisted");
      void qc.invalidateQueries({ queryKey: ["training-applications"] });
    }
  };

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("respond_training_application", { _application_id: id, _accept: accept, _note: null });
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success(accept ? "Training accepted" : "Training declined");
      void qc.invalidateQueries({ queryKey: ["training-applications"] });
    }
  };

  const complete = async (id: string) => {
    if (!window.confirm("Mark this training as completed? It will be added to the learner's profile experience.")) return;
    setBusy(id);
    const { error } = await supabase.rpc("complete_training_application", { _application_id: id });
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Training completed and profile experience added");
      void qc.invalidateQueries({ queryKey: ["training-applications"] });
    }
  };

  if (!session) {
    return (
      <div className="container-page py-10">
        <PageHeader eyebrow="UmurimoHub" title="Skills & training" desc="Apply, get shortlisted, accept, complete, and build a real training record." />
        <p className="text-sm text-muted-foreground">Sign in to apply for training or publish a program.</p>
      </div>
    );
  }

  const apps = applicationsQ.data ?? [];
  const profileMap = new Map((profilesQ.data ?? []).map((p) => [p.id, p]));
  const workerMap = new Map(workers.map((w) => [w.id, w]));

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="UmurimoHub"
        title="Skills & training"
        desc="Apply, get shortlisted, accept, complete, and add the finished training to your work profile."
        actions={<Button onClick={openCreate}>+ Create training</Button>}
      />

      {editing && (
        <Card className="mb-6">
          <h2 className="font-bold">{editing === "new" ? "Create training" : "Edit training"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm md:col-span-2">Title<input className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="text-sm">District<select className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}><option value="">Choose district</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></label>
            <label className="text-sm">Provider type<select className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.provider_type} onChange={(e) => setForm({ ...form, provider_type: e.target.value })}><option value="business">Business</option><option value="institution">Institution</option><option value="team">Team</option><option value="community">Community</option></select></label>
            <label className="text-sm md:col-span-2">Description<textarea rows={5} className="mt-1 w-full rounded-xl border bg-card p-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          </div>
          <div className="mt-4 flex gap-2"><Button onClick={() => void save()} disabled={busy === "save"}>{busy === "save" ? "Saving…" : "Save"}</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
        </Card>
      )}

      {programsQ.isLoading || applicationsQ.isLoading ? <p className="text-sm text-muted-foreground">Loading training programs and applications…</p> :
       programsQ.isError || applicationsQ.isError ? <Card><p className="text-sm text-destructive">Could not load training workflows. Please try again.</p><Button className="mt-3" variant="outline" onClick={() => { void programsQ.refetch(); void applicationsQ.refetch(); }}>Retry</Button></Card> :
       !programsQ.data?.length ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No training programs yet. Create the first real one.</div> :
       <div className="grid gap-4 md:grid-cols-2">
        {programsQ.data.map((x) => {
          const mine = apps.find((a) => a.training_id === x.id && a.applicant_user_id === session.user.id);
          const provider = x.created_by === session.user.id;
          const candidates = apps.filter((a) => a.training_id === x.id);
          const mineWorker = mine ? workerMap.get(mine.worker_id) : undefined;
          return (
            <Card key={x.id}>
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-bold">{x.title}</h2><p className="mt-1 text-sm text-muted-foreground">{x.district} · {x.provider_type}</p></div>
                <Pill tone={mine?.status === "completed" ? "success" : mine ? "primary" : "muted"}>{mine?.status ?? x.status}</Pill>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{x.description || "No description provided."}</p>

              {!provider && !mine && x.status === "published" && (
                <Button className="mt-4" disabled={busy === x.id} onClick={() => void apply(x.id)}>{busy === x.id ? "Sending…" : "Apply for training"}</Button>
              )}
              {mine && (
                <div className="mt-4 rounded-xl border bg-muted/30 p-3">
                  <p className="text-sm font-medium">Your training path</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs"><Pill>Applied</Pill>{["shortlisted","accepted","completed"].includes(mine.status) && <Pill tone="primary">Shortlisted</Pill>}{["accepted","completed"].includes(mine.status) && <Pill tone="primary">Accepted</Pill>}{mine.status === "completed" && <Pill tone="success">Completed</Pill>}</div>
                  {mine.status === "shortlisted" && <div className="mt-3 flex gap-2"><Button size="sm" disabled={busy === mine.id} onClick={() => void respond(mine.id, true)}>Accept</Button><Button size="sm" variant="outline" disabled={busy === mine.id} onClick={() => void respond(mine.id, false)}>Decline</Button></div>}
                  {mine.status === "accepted" && <Button className="mt-3" size="sm" disabled={busy === mine.id} onClick={() => void complete(mine.id)}>{busy === mine.id ? "Saving…" : "Mark training complete"}</Button>}
                  {mine.status === "completed" && <p className="mt-2 text-xs text-success">Completed training is now part of your profile experience.</p>}
                  {mineWorker && <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Avatar initials={mineWorker.initials} src={mineWorker.avatarUrl} alt={mineWorker.name} size="sm" />{mineWorker.name}</div>}
                </div>
              )}

              {provider && (
                <div className="mt-4 border-t pt-4">
                  <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Applicants</h3><Pill>{candidates.length}</Pill></div>
                  {!candidates.length ? <p className="mt-2 text-xs text-muted-foreground">No applicants yet.</p> : <div className="mt-2 space-y-2">
                    {candidates.map((a) => {
                      const profile = profileMap.get(a.applicant_user_id);
                      const worker = workerMap.get(a.worker_id);
                      const displayName = worker?.name ?? profile?.display_name ?? "Applicant";
                      const avatar = worker?.avatarUrl ?? profile?.avatar_url;
                      return (
                        <div key={a.id} className="rounded-xl border p-3">
                          <div className="flex items-center gap-3"><Avatar initials={displayName.slice(0,2).toUpperCase()} src={avatar} alt={displayName} size="sm" /><div className="min-w-0"><p className="text-sm font-medium">{displayName}</p><p className="text-xs text-muted-foreground">{a.status}</p></div></div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {a.status === "applied" && <Button size="sm" onClick={() => void shortlist(a.id)} disabled={busy === a.id}>Shortlist</Button>}
                            {a.status === "shortlisted" && <span className="text-xs text-muted-foreground">Waiting for candidate acceptance.</span>}
                            {a.status === "accepted" && <Button size="sm" onClick={() => void complete(a.id)} disabled={busy === a.id}>{busy === a.id ? "Saving…" : "Mark complete"}</Button>}
                            {a.status === "completed" && <Pill tone="success">Profile experience added</Pill>}
                          </div>
                        </div>
                      );
                    })}
                  </div>}
                </div>
              )}

              {provider && <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(x)}>Edit</Button><Button size="sm" variant="outline" disabled={busy === x.id} onClick={() => void remove(x.id)}>Delete</Button></div>}
            </Card>
          );
        })}
      </div>}
    </div>
  );
}
