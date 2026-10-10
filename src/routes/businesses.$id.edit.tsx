import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/businesses/$id/edit")({ component: BusinessEditorPage });

function BusinessEditorPage() {
  const { id } = Route.useParams();
  const { user, authReady } = useApp();
  const queryClient = useQueryClient();
  const businessQuery = useQuery({
    queryKey: ["business-profile", id],
    enabled: authReady,
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const business = businessQuery.data;
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [services, setServices] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!business) return;
    setName(business.name ?? "");
    setAbout(business.about ?? "");
    setServices((business.services ?? []).join(", "));
  }, [business?.id, business?.name, business?.about, business?.services]);

  const isOwner = !!user && (user.businessIds ?? []).includes(id);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!business || !user || !isOwner || saving) return;
    if (!name.trim()) { toast.error("Business name is required."); return; }
    if (imageFile && (!imageFile.type.startsWith("image/") || imageFile.size > 5_000_000)) {
      toast.error("Choose an image under 5 MB."); return;
    }

    setSaving(true);
    try {
      const { data: updated, error } = await supabase.from("businesses").update({
        name: name.trim(),
        about: about.trim(),
        services: services.split(",").map((value) => value.trim()).filter(Boolean),
      }).eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error("No changes were saved. Verify your business membership and permissions.");

      if (imageFile) {
        const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = user.id + "/businesses/" + id + "/" + crypto.randomUUID() + "-" + safeName;
        const upload = await supabase.storage.from("avatars").upload(path, imageFile, { upsert: false, contentType: imageFile.type });
        if (upload.error) throw new Error("Business details were saved, but image upload failed: " + upload.error.message);
        const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(upload.data.path);
        const avatarUpdate = await supabase.from("businesses").update({ avatar_url: publicUrl.publicUrl }).eq("id", id).select("id").maybeSingle();
        if (avatarUpdate.error) throw avatarUpdate.error;
        if (!avatarUpdate.data) throw new Error("Business details were saved, but the image could not be attached.");
      }

      await queryClient.invalidateQueries({ queryKey: ["business-profile", id] });
      await queryClient.invalidateQueries({ queryKey: ["businesses"] });
      toast.success("Business profile saved.");
      window.location.assign("/businesses/" + encodeURIComponent(id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the business profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!authReady || businessQuery.isLoading) return <div className="container-page py-16 text-sm text-muted-foreground">Loading business settings…</div>;
  if (businessQuery.isError) return <div className="container-page py-12"><Card><h1 className="font-semibold">Business settings could not load</h1><p className="mt-2 text-sm text-muted-foreground">{businessQuery.error instanceof Error ? businessQuery.error.message : "Check your connection and retry."}</p><div className="mt-4 flex gap-2"><Button onClick={() => void businessQuery.refetch()}>Retry</Button><Button variant="outline" asChild><Link to="/businesses">Businesses</Link></Button></div></Card></div>;
  if (!business) return <div className="container-page py-12"><Card><h1 className="font-semibold">Business not found</h1><p className="mt-2 text-sm text-muted-foreground">This business may no longer be available.</p><Button className="mt-4" variant="outline" asChild><Link to="/businesses">Browse businesses</Link></Button></Card></div>;
  if (!user || !isOwner) return <div className="container-page py-12"><Card><h1 className="font-semibold">Business owner access required</h1><p className="mt-2 text-sm text-muted-foreground">Sign in with an account that belongs to this business to edit its profile.</p><div className="mt-4 flex flex-wrap gap-2"><Button asChild><Link to="/login">Sign in</Link></Button><Button variant="outline" asChild><Link to="/businesses/$id" params={{ id }}>Return to profile</Link></Button></div></Card></div>;

  return <div className="container-page max-w-2xl py-10">
    <Link to="/businesses/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">← Back to business profile</Link>
    <div className="mt-4"><PageHeader eyebrow="Business settings" title="Edit business profile" desc="Maintain the public information people use to assess and contact your business." /></div>
    <Card className="mt-5"><form className="grid gap-5" onSubmit={(event) => void save(event)}>
      <label className="grid gap-1.5 text-sm font-medium">Business name<input required maxLength={120} className="h-11 rounded-xl border bg-card px-3 font-normal" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="grid gap-1.5 text-sm font-medium">About your business<textarea rows={5} maxLength={4000} className="rounded-xl border bg-card p-3 font-normal" value={about} onChange={(event) => setAbout(event.target.value)} /></label>
      <label className="grid gap-1.5 text-sm font-medium">Services and capabilities<input className="h-11 rounded-xl border bg-card px-3 font-normal" value={services} onChange={(event) => setServices(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">Separate services with commas.</span></label>
      <label className="grid gap-1.5 text-sm font-medium">Business image<input type="file" accept="image/*" className="rounded-xl border bg-card p-2 font-normal" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /><span className="text-xs font-normal text-muted-foreground">Optional; image files up to 5 MB.</span></label>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button><Button type="button" variant="outline" asChild><Link to="/businesses/$id" params={{ id }}>Cancel</Link></Button></div>
    </form></Card>
  </div>;
}
