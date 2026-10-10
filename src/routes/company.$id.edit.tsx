import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/company/$id/edit")({ component: CompanyEditorPage });

function CompanyEditorPage() {
  const { id } = Route.useParams();
  const { user, authReady } = useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [services, setServices] = useState("");
  const [saving, setSaving] = useState(false);

  const businessQuery = useQuery({
    queryKey: ["company-editor", id],
    enabled: authReady,
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("id,name,about,services").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const business = businessQuery.data;
  const isOwner = !!user && user.businessIds.includes(id);

  useEffect(() => {
    if (!business) return;
    setName(business.name ?? "");
    setAbout(business.about ?? "");
    setServices((business.services ?? []).join(", "));
  }, [business?.id, business?.name, business?.about, business?.services]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business || !user || !isOwner || saving) return;
    const cleanName = name.trim();
    if (!cleanName) { toast.error("Company name is required."); return; }
    setSaving(true);
    try {
      const cleanServices = services.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 30);
      const { data, error } = await supabase.from("businesses").update({ name: cleanName, about: about.trim(), services: cleanServices }).eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No changes were saved. Check your company membership and permissions.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["company-editor", id] }),
        queryClient.invalidateQueries({ queryKey: ["company", user.id] }),
      ]);
      toast.success("Company profile saved.");
      await navigate({ to: "/company/$id", params: { id }, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the company profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!authReady || businessQuery.isLoading) return <div className="container-page py-16 text-sm text-muted-foreground" role="status">Loading company settings…</div>;
  if (businessQuery.isError) return <div className="container-page py-12"><Card><h1 className="font-semibold">Company settings could not load</h1><p className="mt-2 text-sm text-muted-foreground">{businessQuery.error instanceof Error ? businessQuery.error.message : "Check your connection and retry."}</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => void businessQuery.refetch()}>Retry</Button><Button variant="outline" asChild><Link to="/company/businesses">Company directory</Link></Button></div></Card></div>;
  if (!business) return <div className="container-page py-12"><Card><h1 className="font-semibold">Company not found</h1><p className="mt-2 text-sm text-muted-foreground">This company is unavailable or no longer listed.</p><Button className="mt-4" variant="outline" asChild><Link to="/company/businesses">Browse companies</Link></Button></Card></div>;
  if (!user || !isOwner) return <div className="container-page py-12"><Card><h1 className="font-semibold">Company owner access required</h1><p className="mt-2 text-sm text-muted-foreground">Sign in with an account that belongs to this company to edit its profile.</p><div className="mt-4 flex flex-wrap gap-2"><Button asChild><Link to="/login">Sign in</Link></Button><Button variant="outline" asChild><Link to="/company/$id" params={{ id }}>Return to company profile</Link></Button></div></Card></div>;

  return <div className="container-page max-w-2xl py-10">
    <Link to="/company/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">← Back to company profile</Link>
    <div className="mt-4"><PageHeader eyebrow="Company settings" title="Edit company profile" desc="Keep your public company information accurate and useful." /></div>
    <Card className="mt-5"><form className="grid gap-5" onSubmit={(event) => void save(event)}>
      <label className="grid gap-1.5 text-sm font-medium">Company name<input required maxLength={120} className="h-11 rounded-xl border bg-card px-3 font-normal" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="grid gap-1.5 text-sm font-medium">About the company<textarea rows={5} maxLength={4000} className="rounded-xl border bg-card p-3 font-normal" value={about} onChange={(event) => setAbout(event.target.value)} /></label>
      <label className="grid gap-1.5 text-sm font-medium">Services and capabilities<input maxLength={1200} className="h-11 rounded-xl border bg-card px-3 font-normal" value={services} onChange={(event) => setServices(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">Separate services with commas.</span></label>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button><Button type="button" variant="outline" asChild><Link to="/company/$id" params={{ id }}>Cancel</Link></Button></div>
    </form></Card>
  </div>;
}
