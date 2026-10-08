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

export const Route = createFileRoute("/businesses/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const { getBusiness } = useCatalog();
  const { user } = useApp();
  const business = getBusiness(id);
  if (!business) throw notFound();
  const canManage = user?.businessIds.includes(id) ?? false;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(business.name);
  const [about, setAbout] = useState(business.about);
  const [services, setServices] = useState(business.services.join(", "));
  const [busy, setBusy] = useState(false);
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
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Business updated"); setEditing(false); window.location.reload(); }
  };
  const remove = async () => {
    if (!window.confirm("Delete this business? This cannot be undone.")) return;
    setBusy(true);
    const { error } = await supabase.from("businesses").delete().eq("id", id);
    setBusy(false);
    if (error) toast.error("This business cannot be deleted while it has opportunities, contracts, or other dependent records.");
    else window.location.href = "/businesses";
  };
  return <div className="container-page py-10">
    <Link to="/businesses" className="text-sm text-muted-foreground">← Businesses</Link>
    <Card className="mt-4 p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar initials={business.name.slice(0,2).toUpperCase()} src={business.avatarUrl} alt={business.name} size="lg" />
          <div>
            <div className="flex items-center gap-2"><Building2 className="size-5 text-primary" /><h1 className="text-3xl font-display font-bold">{business.name}</h1></div>
            <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" />{business.district}</p>
            <Pill className="mt-3">{business.sector}</Pill>
          </div>
        </div>
        {canManage && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel edit" : "Edit business"}</Button><Button size="sm" variant="outline" onClick={remove} disabled={busy}>Delete</Button></div>}
      </div>
      <p className="mt-6 text-muted-foreground">{business.about || "No business description yet."}</p>
      {business.services.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{business.services.map((s) => <Pill key={s}>{s}</Pill>)}</div>}
    </Card>
    {editing && canManage && <Card className="mt-4"><div className="grid gap-3"><label className="text-sm">Business name<input className="mt-1 h-10 w-full rounded-xl border bg-card px-3" value={name} onChange={(e) => setName(e.target.value)} /></label><label className="text-sm">About<textarea rows={4} className="mt-1 w-full rounded-xl border bg-card p-3" value={about} onChange={(e) => setAbout(e.target.value)} /></label><label className="text-sm">Services<input className="mt-1 h-10 w-full rounded-xl border bg-card px-3" value={services} onChange={(e) => setServices(e.target.value)} /></label><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></div></Card>}
    <div className="mt-8">
      <PageHeader eyebrow="Track record" title="Past projects & opportunities" desc="Real work published by this business." />
      {projectsQ.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading projects…</p> : projectsQ.isError ? <p className="mt-4 text-sm text-destructive">Could not load projects. Please try again.</p> : !projectsQ.data?.length ? <p className="mt-4 text-sm text-muted-foreground">No projects yet.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2">{projectsQ.data.map((o) => <Link key={o.id} to="/opportunities/$id" params={{ id: o.id }}><Card><p className="font-semibold">{o.title}</p><p className="mt-1 text-sm text-muted-foreground">{o.summary}</p><Pill className="mt-3">{o.status}</Pill></Card></Link>)}</div>}
    </div>
  </div>;
}
