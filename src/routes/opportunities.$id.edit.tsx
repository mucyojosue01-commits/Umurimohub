import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DISTRICTS, SECTORS } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { Card, PageHeader } from "@/features/ui/kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/opportunities/$id/edit")({
  component: Page,
  errorComponent: () => <div className="container-page py-20 text-center">Could not load this opportunity. Please try again.</div>,
});

function Page() {
  const { id } = Route.useParams();
  const { user } = useApp();
  const [form, setForm] = useState({ title: "", summary: "", pay_rwf: "", deadline: "", district: "", sector: "", status: "open" });
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.from("opportunities").select("id,title,summary,pay_rwf,deadline,district,sector,status,created_by,business_id").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) { toast.error(error.message); return; }
      if (!data) { throw notFound(); }
      if (data.created_by !== user?.id && (!data.business_id || !user?.businessIds.includes(data.business_id))) { toast.error("You are not allowed to edit this opportunity."); return; }
      setForm({ title: data.title, summary: data.summary, pay_rwf: String(data.pay_rwf), deadline: data.deadline, district: data.district, sector: data.sector, status: data.status });
      setLoaded(true);
    });
    return () => { active = false; };
  }, [id, user?.id, user?.businessIds]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("opportunities").update({
      title: form.title.trim(),
      summary: form.summary.trim(),
      pay_rwf: Number(form.pay_rwf),
      deadline: form.deadline,
      district: form.district,
      sector: form.sector,
      status: form.status,
    }).eq("id", id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Opportunity updated. Interacting applicants have been notified.");
    window.location.href = "/opportunities/" + id;
  };

  const remove = async () => {
    if (!window.confirm("Delete this opportunity? This cannot be undone.")) return;
    setBusy(true);
    const { error } = await supabase.from("opportunities").delete().eq("id", id);
    setBusy(false);
    if (error) { toast.error("This opportunity cannot be deleted while it has dependent records. Close or complete its active work first."); return; }
    toast.success("Opportunity deleted");
    window.location.href = "/opportunities";
  };

  if (!user) return <div className="container-page py-16 text-center"><PageHeader title="Edit opportunity" desc="Sign in to manage your opportunity." /><Button asChild><Link to="/login">Sign in</Link></Button></div>;
  if (!loaded) return <div className="container-page py-16"><p className="text-sm text-muted-foreground">Loading opportunity…</p></div>;

  return <div className="container-page max-w-3xl py-10">
    <PageHeader eyebrow="Manage" title="Edit opportunity" desc="Changes are recorded and active applicants are notified." />
    <Card>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm md:col-span-2">Title<input className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></label>
        <label className="text-sm">Pay (RWF)<input type="number" className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.pay_rwf} onChange={(e)=>setForm({...form,pay_rwf:e.target.value})}/></label>
        <label className="text-sm">Deadline<input type="date" className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.deadline} onChange={(e)=>setForm({...form,deadline:e.target.value})}/></label>
        <label className="text-sm">District<select className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.district} onChange={(e)=>setForm({...form,district:e.target.value})}>{DISTRICTS.map((d)=><option key={d}>{d}</option>)}</select></label>
        <label className="text-sm">Sector<select className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.sector} onChange={(e)=>setForm({...form,sector:e.target.value})}>{SECTORS.map((d)=><option key={d}>{d}</option>)}</select></label>
        <label className="text-sm">Status<select className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="open">Open</option><option value="closed">Closed</option></select></label>
        <label className="text-sm md:col-span-2">Description<textarea rows={7} className="mt-1 w-full rounded-xl border bg-card p-3" value={form.summary} onChange={(e)=>setForm({...form,summary:e.target.value})}/></label>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button>
        <Button disabled={busy} variant="outline" onClick={remove}>Delete opportunity</Button>
        <Button variant="ghost" asChild><Link to="/opportunities/$id" params={{id}}>Cancel</Link></Button>
      </div>
    </Card>
  </div>;
}
