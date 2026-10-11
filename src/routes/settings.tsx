import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Profile & settings — UmurimoHub" }] }),
  component: Page,
});

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0,2).map((x)=>x[0]?.toUpperCase()).join("") || "U";
}

function Page() {
  const { session, user, reloadUser } = useApp();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [district, setDistrict] = useState(user?.district ?? "");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [sector, setSector] = useState("");
  const [skills, setSkills] = useState(user?.skills.join(", ") ?? "");
  const [years, setYears] = useState("0");
  const [rate, setRate] = useState("0");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    if (!session || !user?.workerId) return;
    let active = true;
    void supabase.from("worker_profiles").select("title,bio,sector,years,rate_rwf").eq("id", user.workerId).maybeSingle().then(({ data }) => {
      if (!active || !data) return;
      setTitle(data.title ?? "");
      setBio(data.bio ?? "");
      setSector(data.sector ?? "");
      setYears(String(data.years ?? 0));
      setRate(String(data.rate_rwf ?? 0));
    });
    return () => { active = false; };
  }, [session?.user.id, user?.workerId]);

  if (!session || !user) return <div className="container-page py-16"><PageHeader title="Profile & settings" desc="Sign in to manage your account."/><Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button></div>;

  const saveProfile = async () => {
    if (name.trim().length < 2) { toast.error("Enter your full name."); return; }
    setBusy(true);
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim(), phone: phone.trim() || null, district: district.trim() || null, updated_at: new Date().toISOString() }).eq("id", session.user.id);
    if (error) { setBusy(false); toast.error("Couldn't save your account details."); return; }
    if (user.workerId) {
      const { error: workerError } = await supabase.from("worker_profiles").update({
        name: name.trim(), title: title.trim(), bio: bio.trim(), district: district.trim() || "Kigali",
        sector: sector.trim() || "General", years: Math.max(0, Number(years) || 0),
        rate_rwf: Math.max(0, Number(rate) || 0),
      }).eq("id", user.workerId).eq("user_id", session.user.id);
      if (workerError) { setBusy(false); toast.error("Account saved, but worker profile could not be updated: " + workerError.message); return; }
      const wanted = [...new Set(skills.split(",").map((skill) => skill.trim()).filter(Boolean))];
      const { data: existingSkills, error: skillReadError } = await supabase.from("worker_skills").select("id,name").eq("worker_id", user.workerId);
      if (skillReadError) { setBusy(false); toast.error("Worker profile saved, but skills could not be loaded."); return; }
      const existing = existingSkills ?? [];
      const remove = existing.filter((skill) => !wanted.some((item) => item.toLowerCase() === skill.name.toLowerCase())).map((skill) => skill.id);
      if (remove.length) {
        const { error: removeError } = await supabase.from("worker_skills").delete().in("id", remove);
        if (removeError) { setBusy(false); toast.error("Worker profile saved, but some skills could not be removed."); return; }
      }
      const add = wanted.filter((item) => !existing.some((skill) => skill.name.toLowerCase() === item.toLowerCase())).map((item) => ({ worker_id: user.workerId!, name: item, level: "intermediate", verification: "self_reported" }));
      if (add.length) {
        const { error: addError } = await supabase.from("worker_skills").insert(add);
        if (addError) { setBusy(false); toast.error("Worker profile saved, but some skills could not be added."); return; }
      }
    }
    setBusy(false);
    await reloadUser();
    toast.success("Profile updated.");
  };

  const changePassword = async () => {
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setPassword("");
    toast.success("Password updated.");
  };

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Choose an image."); return; }
    if (file.size > 5_000_000) { toast.error("Image must be under 5 MB."); return; }
    setAvatarBusy(true);
    const path = session.user.id + "/avatar-" + Date.now() + "." + (file.name.split(".").pop() || "jpg");
    const upload = await supabase.storage.from("avatars").upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) { setAvatarBusy(false); { toast.error("Couldn't upload your profile picture."); return; } }
    const { data } = supabase.storage.from("avatars").getPublicUrl(upload.data.path);
    const { error } = await supabase.from("profiles").update({ avatar_url: data.publicUrl } as never).eq("id", session.user.id);
    if (error) { setAvatarBusy(false); toast.error("Picture uploaded but profile could not be updated."); return; }
    const [workerUpdate, businessUpdate, teamUpdate] = await Promise.all([
      supabase.from("worker_profiles").update({ avatar_url: data.publicUrl }).eq("user_id", session.user.id),
      supabase.from("businesses").update({ avatar_url: data.publicUrl }).in("id", user.businessIds),
      supabase.from("teams").update({ avatar_url: data.publicUrl }).eq("lead_user_id", session.user.id),
    ]);
    if (workerUpdate.error || businessUpdate.error || teamUpdate.error) {
      setAvatarBusy(false);
      toast.error("Profile picture saved, but one of your public profiles could not be synchronized.");
      await reloadUser();
      return;
    }
    setAvatarBusy(false);
    await reloadUser();
    toast.success("Profile picture updated everywhere.");
  };

  return <div className="container-page max-w-2xl py-10">
    <PageHeader eyebrow="Account" title="Profile & settings" desc="Manage your profile, picture and password." />
    <div className="mt-6 space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="size-20 rounded-full object-cover" /> : <div className="grid size-20 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">{initials(user.name)}</div>}
          <div><h2 className="font-semibold">Profile picture</h2><p className="text-sm text-muted-foreground">JPG, PNG or WebP, up to 5 MB.</p><input className="mt-2 block text-sm" type="file" accept="image/*" disabled={avatarBusy} onChange={(e)=>{const file=e.target.files?.[0]; if(file) void uploadAvatar(file);}} /></div>
        </div>
      </Card>
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <label className="block text-sm">Full name<input value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3" maxLength={80}/></label>
        <label className="block text-sm">Email<input value={session.user.email ?? ""} disabled className="mt-1 h-11 w-full rounded-xl border bg-muted px-3"/></label>
        <Button onClick={()=>void saveProfile()} disabled={busy}>Save profile</Button>
      </Card>
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Personal and work profile</h2>
        <p className="text-sm text-muted-foreground">Update your contact details and the information employers see on your worker profile.</p>
        <label className="block text-sm">Phone number<input value={phone} onChange={(e)=>setPhone(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3" maxLength={30}/></label>
        <label className="block text-sm">District<input value={district} onChange={(e)=>setDistrict(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3" maxLength={100}/></label>
        {user.workerId && <>
          <label className="block text-sm">Professional title<input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="e.g. Mason, electrician, designer" className="mt-1 h-11 w-full rounded-xl border bg-card px-3" maxLength={120}/></label>
          <label className="block text-sm">Sector<input value={sector} onChange={(e)=>setSector(e.target.value)} placeholder="e.g. Construction, agriculture, technology" className="mt-1 h-11 w-full rounded-xl border bg-card px-3" maxLength={120}/></label>
          <label className="block text-sm">Skills (comma-separated)<textarea value={skills} onChange={(e)=>setSkills(e.target.value)} rows={3} placeholder="Masonry, plumbing, customer service" className="mt-1 w-full rounded-xl border bg-card p-3"/></label>
          <label className="block text-sm">Professional bio<textarea value={bio} onChange={(e)=>setBio(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border bg-card p-3" maxLength={2000}/></label>
          <div className="grid grid-cols-2 gap-3"><label className="block text-sm">Years of experience<input type="number" min="0" max="80" value={years} onChange={(e)=>setYears(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3"/></label><label className="block text-sm">Expected rate (RWF)<input type="number" min="0" value={rate} onChange={(e)=>setRate(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3"/></label></div>
        </>}
        <Button onClick={()=>void saveProfile()} disabled={busy}>{busy ? "Saving…" : "Save all profile details"}</Button>
      </Card>
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Password</h2>
        <p className="text-sm text-muted-foreground">Set a new password for email/password sign-in.</p>
        <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" className="h-11 w-full rounded-xl border bg-card px-3"/>
        <Button variant="outline" onClick={()=>void changePassword()} disabled={busy || !password}>Change password</Button>
      </Card>
    </div>
  </div>;
}
