import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/businesses/$id/edit")({ component: Page });
function Page() {
  const { id } = Route.useParams();
  const { user } = useApp();
  const { getBusiness } = useCatalog();
  const business = getBusiness(id);
  if (!business) throw notFound();
  const [name,setName] = useState(business.name);
  const [about,setAbout] = useState(business.about);
  const [services,setServices] = useState(business.services.join(", "));
  const [image,setImage] = useState<File|null>(null);
  const [busy,setBusy] = useState(false);
  if (!user?.businessIds.includes(id)) return <div className="container-page py-12">You do not have permission to edit this business. <Link to="/businesses/$id" params={{id}} className="text-primary">Return to profile</Link></div>;
  const save = async () => {
    if (!name.trim()) { toast.error("Business name is required."); return; }
    if (image && (!image.type.startsWith("image/") || image.size > 5_000_000)) { toast.error("Business picture must be an image under 5 MB."); return; }
    setBusy(true);
    const {error} = await supabase.from("businesses").update({name:name.trim(),about:about.trim(),services:services.split(",").map(s=>s.trim()).filter(Boolean)}).eq("id",id);
    if (error) { setBusy(false); toast.error(error.message); return; }
    if(image) {
      const path=user.id+"/businesses/"+id+"/"+crypto.randomUUID()+"-"+image.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const upload=await supabase.storage.from("avatars").upload(path,image,{upsert:false,contentType:image.type});
      if(upload.error){setBusy(false);toast.error("Details saved, but the picture could not be uploaded.");return;}
      const {data:url}=supabase.storage.from("avatars").getPublicUrl(upload.data.path);
      const avatarUpdate=await supabase.from("businesses").update({avatar_url:url.publicUrl}).eq("id",id);
      if(avatarUpdate.error){setBusy(false);toast.error("Details saved, but the picture could not be saved.");return;}
    }
    setBusy(false);toast.success("Business updated");window.location.href="/businesses/"+id;
  };
  return <div className="container-page max-w-2xl py-10">
    <Link to="/businesses/$id" params={{id}} className="text-sm text-muted-foreground">← Back to business profile</Link>
    <div className="mt-4"><PageHeader eyebrow="Business settings" title={"Edit "+business.name} desc="Update your business profile information." /></div>
    <Card className="mt-4"><div className="grid gap-4">
      <label className="text-sm">Business name<input className="mt-1 h-10 w-full rounded-xl border bg-card px-3" value={name} onChange={e=>setName(e.target.value)} /></label>
      <label className="text-sm">About<textarea rows={4} className="mt-1 w-full rounded-xl border bg-card p-3" value={about} onChange={e=>setAbout(e.target.value)} /></label>
      <label className="text-sm">Services<input className="mt-1 h-10 w-full rounded-xl border bg-card px-3" value={services} onChange={e=>setServices(e.target.value)} /><span className="mt-1 block text-xs text-muted-foreground">Separate services with commas.</span></label>
      <label className="text-sm">Business picture<input type="file" accept="image/*" className="mt-1 block w-full rounded-xl border bg-card p-2 text-sm" onChange={e=>setImage(e.target.files?.[0]??null)} /><span className="mt-1 block text-xs text-muted-foreground">Optional image, maximum 5 MB.</span></label>
      <div className="flex gap-2"><Button onClick={save} disabled={busy}>{busy?"Saving…":"Save changes"}</Button><Button variant="outline" asChild><Link to="/businesses/$id" params={{id}}>Cancel</Link></Button></div>
    </div></Card>
  </div>;
}
