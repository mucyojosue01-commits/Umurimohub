import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/businesses/$id/edit")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const { user, authReady } = useApp();
  const businessQ = useQuery({
    queryKey: ["business-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const business = businessQ.data;
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [services, setServices] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!business) return;
    setName(business.name ?? "");
    setAbout(business.about ?? "");
    setServices((business.services ?? []).join(", "));
  }, [business?.id]);

  const save = async () => {
    if (!business || !user || busy) return;
    if (!name.trim()) {
      toast.error("Business name is required.");
      return;
    }
    if (image && (!image.type.startsWith("image/") || image.size > 5_000_000)) {
      toast.error("Business picture must be an image under 5 MB.");
      return;
    }

    setBusy(true);
    try {
      const { data: updated, error } = await supabase
        .from("businesses")
        .update({
          name: name.trim(),
          about: about.trim(),
          services: services.split(",").map((service) => service.trim()).filter(Boolean),
        })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error("No business was updated. Check that you still have permission to edit it.");

      if (image) {
        const path = user.id + "/businesses/" + id + "/" + crypto.randomUUID() + "-" + image.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const upload = await supabase.storage.from("avatars").upload(path, image, { upsert: false, contentType: image.type });
        if (upload.error) throw new Error("Business details were saved, but the picture upload failed: " + upload.error.message);
        const { data: url } = supabase.storage.from("avatars").getPublicUrl(upload.data.path);
        const avatarUpdate = await supabase.from("businesses").update({ avatar_url: url.publicUrl }).eq("id", id).select("id").maybeSingle();
        if (avatarUpdate.error) throw avatarUpdate.error;
        if (!avatarUpdate.data) throw new Error("Business details were saved, but the picture could not be attached to this business.");
      }

      toast.success("Business profile saved.");
      window.location.assign("/businesses/" + encodeURIComponent(id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the business profile. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (businessQ.isLoading || !authReady) {
    return <div className="container-page py-16 text-sm text-muted-foreground">Loading business settings…</div>;
  }
  if (businessQ.isError) {
    return <div className="container-page py-16"><Card><h1 className="font-semibold">Business settings could not load</h1><p className="mt-2 text-sm text-muted-foreground">{businessQ.error instanceof Error ? businessQ.error.message : "Check your connection and retry."}</p><Button className="mt-4" variant="outline" onClick={() => void businessQ.refetch()}>Retry</Button><Link className="ml-3 text-primary" to="/businesses">Businesses</Link></Card></div>;
  }
  if (!business) {
    return <div className="container-page py-16"><Card><h1 className="font-semibold">Business not found</h1><p className="mt-2 text-sm text-muted-foreground">This business may have been removed or is no longer available.</p><Button className="mt-4" variant="outline" asChild><Link to="/businesses">Browse businesses</Link></Button></Card></div>;
  }
  if (!user || !(user.businessIds ?? []).includes(id)) {
    return <div className="container-page py-12"><Card><h1 className="font-semibold">Business owner access required</h1><p className="mt-2 text-sm text-muted-foreground">Sign in with an account that is a member of this business to edit its profile.</p><div className="mt-4 flex flex-wrap gap-3"><Button asChild><Link to="/login">Sign in</Link></Button><Button variant="outline" asChild><Link to="/businesses/$id" params={{ id }}>Return to profile</Link></Button></div></Card></div>;
  }

  return <div className="container-page max-w-2xl py-10">
    <Link to="/businesses/$id" params={{ id }} className="text-sm text-muted-foreground">← Back to business profile</Link>
    <div className="mt-4"><PageHeader eyebrow="Business settings" title={"Edit " + business.name} desc="Update your business details and services. Changes are saved to your business profile." /></div>
    <Card className="mt-4"><div className="grid gap-4">
      <label className="text-sm font-medium">Business name<input required className="mt-1 h-11 w-full rounded-xl border bg-card px-3 font-normal" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="text-sm font-medium">About<textarea rows={5} className="mt-1 w-full rounded-xl border bg-card p-3 font-normal" value={about} onChange={(event) => setAbout(event.target.value)} /></label>
      <label className="text-sm font-medium">Services<input className="mt-1 h-11 w-full rounded-xl border bg-card px-3 font-normal" value={services} onChange={(event) => setServices(event.target.value)} /><span className="mt-1 block text-xs text-muted-foreground">Separate services with commas.</span></label>
      <label className="text-sm font-medium">Business picture<input type="file" accept="image/*" className="mt-1 block w-full rounded-xl border bg-card p-2 text-sm font-normal" onChange={(event) => setImage(event.target.files?.[0] ?? null)} /><span className="mt-1 block text-xs text-muted-foreground">Optional image, maximum 5 MB.</span></label>
      <div className="flex flex-wrap gap-2"><Button onClick={() => void save()} disabled={busy}>{busy ? "Saving changes…" : "Save changes"}</Button><Button variant="outline" asChild><Link to="/businesses/$id" params={{ id }}>Cancel</Link></Button></div>
    </div></Card>
  </div>;
}
