import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, Card, PageHeader, Pill } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/businesses/$id")({
  validateSearch: (search: Record<string, unknown>) => ({ edit: search.edit === "1" || search.edit === true }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { edit } = Route.useSearch();
  const { getBusiness } = useCatalog();
  const { user } = useApp();
  const business = getBusiness(id);
  if (!business) throw notFound();
  const canManage = user?.businessIds.includes(id) ?? false;
  const [editing, setEditing] = useState(edit);
  const [name, setName] = useState(business.name);
  const [about, setAbout] = useState(business.about);
  const [services, setServices] = useState(business.services.join(", "));
  const [busy, setBusy] = useState(false);
  const [businessImage, setBusinessImage] = useState<File | null>(null);
  const projectsQ = useQuery({
    queryKey: ["business-projects", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("id,title,summary,status,created_at").eq("business_id", id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("businesses").update({ name: name.trim(), about: about.trim(), services: services.split(",").map((x) => x.trim()).filter(Boolean) }).eq("id", id);
    if (error) { setBusy(false); toast.error(error.message); return; }
    if (businessImage) {
      if (!businessImage.type.startsWith("image/") || businessImage.size > 5_000_000) {
        setBusy(false);
        toast.error("Business picture must be an image under 5 MB.");
        return;
      }
      const path = user!.id + "/businesses/" + id + "/" + crypto.randomUUID() + "-" + businessImage.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const upload = await supabase.storage.from("avatars").upload(path, businessImage, { upsert: false, contentType: businessImage.type });
      if (upload.error) { setBusy(false); toast.error("Business details saved, but the picture could not be uploaded."); return; }
      const { data: url } = supabase.storage.from("avatars").getPublicUrl(upload.data.path);
      const avatarUpdate = await supabase.from("businesses").update({ avatar_url: url.publicUrl }).eq("id", id);
      if (avatarUpdate.error) { setBusy(false); toast.error("Business details saved, but the picture could not be saved."); return; }
    }
    setBusy(false);
    toast.success("Business updated");
    setEditing(false);
    window.location.reload();
  };
  const remove = async () => {
    if (!window.confirm("Delete this business? This cannot be undone.")) return;
    setBusy(true);
    const { error } = await supabase.from("businesses").delete().eq("id", id);
    setBusy(false);
    if (error) toast.error("This business cannot be deleted while it has opportunities, contracts, or other dependent records.");
    else window.location.href = "/businesses";
  };
  if (editing && canManage) {
    return (
      <div className="container-page max-w-2xl py-10">
        <Link to="/businesses/$id" params={{ id }} search={{ edit: false }} className="text-sm text-muted-foreground">← Back to business</Link>
        <div className="mt-4"><PageHeader eyebrow="Business settings" title={"Edit " + business.name} desc="Only this business is being edited." /></div>
        <Card className="mt-4">
          <div className="grid gap-4">
            <label className="text-sm">Business name<input className="mt-1 h-10 w-full rounded-xl border bg-card px-3" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="text-sm">About<textarea rows={4} className="mt-1 w-full rounded-xl border bg-card p-3" value={about} onChange={(e) => setAbout(e.target.value)} /></label>
            <label className="text-sm">Services<input className="mt-1 h-10 w-full rounded-xl border bg-card px-3" value={services} onChange={(e) => setServices(e.target.value)} /></label>
            <label className="text-sm">Business picture<input type="file" accept="image/*" className="mt-1 block w-full rounded-xl border bg-card p-2 text-sm" onChange={(e) => setBusinessImage(e.target.files?.[0] ?? null)} /><span className="mt-1 block text-xs text-muted-foreground">Upload a new image or keep the current one.</span></label>
            <div className="flex gap-2"><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button><Button variant="outline" onClick={() => { window.location.href = "/businesses/" + id; }}>Cancel</Button></div>
          </div>
        </Card>
      </div>
    );
  }
  return <div className="container-page py-10">
    <Link to="/businesses" className="text-sm text-muted-foreground">← Businesses</Link>
    <Card className="mt-4 p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar initials={business.name.slice(0,2).toUpperCase()} src={business.avatarUrl} alt={business.name} size="lg" />
          <div>
            <div className="flex items-center gap-2"><Building2 className="size-5 text-primary" /><h1 className="text-3xl font-display font-bold">{business.name}</h1></div>
            <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" />{business.district}</p>
            <Pill className="mt-3">{business.sector}</Pill><Pill tone="success" className="mt-3 ml-2">{Math.round(business.trustScore ?? 0)} trust</Pill>
          </div>
        </div>
        {canManage && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel edit" : "Edit business"}</Button><Button size="sm" variant="outline" onClick={remove} disabled={busy}>Delete</Button></div>}
      </div>
      <p className="mt-6 text-muted-foreground">{business.about || "No business description yet."}</p>
      {business.services.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{business.services.map((s) => <Pill key={s}>{s}</Pill>)}</div>}
    </Card>
    {editing && canManage && <Card className="mt-4"><div className="grid gap-3"><label className="text-sm">Business name<input className="mt-1 h-10 w-full rounded-xl border bg-card px-3" value={name} onChange={(e) => setName(e.target.value)} /></label><label className="text-sm">About<textarea rows={4} className="mt-1 w-full rounded-xl border bg-card p-3" value={about} onChange={(e) => setAbout(e.target.value)} /></label><label className="text-sm">Services<input className="mt-1 h-10 w-full rounded-xl border bg-card px-3" value={services} onChange={(e) => setServices(e.target.value)} /></label><label className="text-sm">Business picture<input type="file" accept="image/*" className="mt-1 block w-full rounded-xl border bg-card p-2 text-sm" onChange={(e) => setBusinessImage(e.target.files?.[0] ?? null)} /><span className="mt-1 block text-xs text-muted-foreground">Upload a new image or keep the current one.</span></label><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></div></Card>}
    <div className="mt-8">
      <PageHeader eyebrow="Track record" title="Past projects & opportunities" desc="Real work published by this business." />
      {projectsQ.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading projects…</p> : projectsQ.isError ? <p className="mt-4 text-sm text-destructive">Could not load projects. Please try again.</p> : !projectsQ.data?.length ? <p className="mt-4 text-sm text-muted-foreground">No projects yet.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2">{projectsQ.data.map((o) => <Link key={o.id} to="/opportunities/$id" params={{ id: o.id }}><Card><p className="font-semibold">{o.title}</p><p className="mt-1 text-sm text-muted-foreground">{o.summary}</p><Pill className="mt-3">{o.status}</Pill></Card></Link>)}</div>}
    </div>
  </div>;
}
