import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, Pill } from "@/features/ui/kit";
import { DISTRICTS } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/training")({
  head: () => ({ meta: [{ title: "Skills & training — UmurimoHub" }] }),
  component: Page,
});

function Page() {
  const { session } = useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", district: "", provider_type: "business" });
  const q = useQuery({
    queryKey: ["training-programs", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_programs").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const openCreate = () => {
    setEditing("new");
    setForm({ title: "", description: "", district: "", provider_type: "business" });
  };
  const openEdit = (x: { id: string; title: string; description: string; district: string; provider_type: string }) => {
    setEditing(x.id);
    setForm({ title: x.title, description: x.description, district: x.district, provider_type: x.provider_type });
  };
  const save = async () => {
    if (!session) return;
    if (form.title.trim().length < 3 || !form.district) {
      toast.error("Enter a training title and district.");
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      district: form.district,
      provider_type: form.provider_type,
      created_by: session.user.id,
      updated_at: new Date().toISOString(),
    };
    const result =
      editing === "new"
        ? await supabase.from("training_programs").insert(payload)
        : await supabase.from("training_programs").update(payload).eq("id", editing);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(editing === "new" ? "Training published" : "Training updated");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["training-programs"] });
    }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Delete this training program?")) return;
    const { error } = await supabase.from("training_programs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Training deleted");
      void qc.invalidateQueries({ queryKey: ["training-programs"] });
    }
  };

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="UmurimoHub"
        title="Skills & training"
        desc="Learn, practice, get assessed, get verified, then get work."
        actions={session ? <Button onClick={openCreate}>+ Create training</Button> : undefined}
      />
      {editing && session && (
        <Card className="mb-6">
          <h2 className="font-bold">{editing === "new" ? "Create training" : "Edit training"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">Title<input className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="text-sm">District<select className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}><option value="">Choose district</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></label>
            <label className="text-sm md:col-span-2">Description<textarea rows={5} className="mt-1 w-full rounded-xl border bg-card p-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label className="text-sm">Provider type<select className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.provider_type} onChange={(e) => setForm({ ...form, provider_type: e.target.value })}><option value="business">Business</option><option value="institution">Institution</option><option value="team">Team</option><option value="community">Community</option></select></label>
          </div>
          <div className="mt-4 flex gap-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
        </Card>
      )}
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading training programs…</p> : q.isError ? <p className="text-sm text-destructive">Could not load training programs. Please try again.</p> : !q.data?.length ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No training programs yet. Create the first real one.</div> : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((x) => (
            <Card key={x.id}>
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{x.title}</h2><p className="mt-1 text-sm text-muted-foreground">{x.district} · {x.provider_type}</p></div><Pill>{x.status}</Pill></div>
              <p className="mt-3 text-sm text-muted-foreground">{x.description}</p>
              {session?.user.id === x.created_by && <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(x)}>Edit</Button><Button size="sm" variant="outline" onClick={() => void remove(x.id)}>Delete</Button></div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
