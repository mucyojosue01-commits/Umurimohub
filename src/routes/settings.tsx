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
  const [years, setYears] = useState("0");
  const [rate, setRate] = useState("0");
  const [skills, setSkills] = useState(user?.skills.join(", ") ?? "");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  useEffect(() => {
    if (!user?.workerId || profileLoaded) return;
    void supabase.from("worker_profiles").select("title,bio,district,sector,years,rate_rwf").eq("id", user.workerId).maybeSingle().then(({ data }) => {
      if (!data) return;
      setTitle(data.title ?? ""); setBio(data.bio ?? ""); setDistrict(data.district ?? user.district); setSector(data.sector ?? ""); setYears(String(data.years ?? 0)); setRate(String(data.rate_rwf ?? 0)); setProfileLoaded(true);
    });
  }, [user?.workerId, profileLoaded]);

  if (!session || !user) return <div className="container-page py-16"><PageHeader title="Profile & settings" desc="Sign in to manage your account."/><Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button></div>;

  const saveProfile = async () => {
    if (name.trim().length < 2) { toast.error("Enter your full name."); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim(), phone: phone.trim() || null, district: district.trim() || null, updated_at: new Date().toISOString() }).eq("id", session.user.id);
    setBusy(false);
    if (error) { toast.error("Couldn't save your profile."); return; }
    if (user.workerId) {
      const { error: workerError } = await supabase.from("worker_profiles").update({ name: name.trim(), title: title.trim(), bio: bio.trim(), district: district.trim(), sector: sector.trim() || "General", years: Math.max(0, Number(years) || 0), rate_rwf: Math.max(0, Math.round(Number(rate) || 0)) }).eq("id", user.workerId);
      if (workerError) { toast.error("Basic profile saved, but worker profile could not be updated."); return; }
      const names = [...new Set(skills.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 30);
      const { error: deleteError } = await supabase.from("worker_skills").delete().eq("worker_id", user.workerId).eq("verification", "self_reported");
      if (deleteError) { toast.error("Profile saved, but skills could not be replaced."); return; }
      if (names.length) {
        const { error: skillsError } = await supabase.from("worker_skills").insert(names.map((name) => ({ worker_id: user.workerId!, name, level: "intermediate", verification: "self_reported" })));
        if (skillsError) { toast.error("Profile saved, but skills could not be saved."); return; }
      }
    }
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
        <label className="block text-sm">Phone number<input value={phone} onChange={(e)=>setPhone(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3" maxLength={30}/></label>
        <label className="block text-sm">District<input value={district} onChange={(e)=>setDistrict(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3" maxLength={80}/></label>
        {user.workerId && <>
          <label className="block text-sm">Professional title<input value={title} onChange={(e)=>setTitle(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3" maxLength={120} placeholder="e.g. Mason, Software developer"/></label>
          <label className="block text-sm">Sector<input value={sector} onChange={(e)=>setSector(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3" maxLength={100}/></label>
          <label className="block text-sm">Years of experience<input type="number" min="0" max="70" value={years} onChange={(e)=>setYears(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3"/></label>
          <label className="block text-sm">Expected rate (RWF)<input type="number" min="0" value={rate} onChange={(e)=>setRate(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3"/></label>
          <label className="block text-sm">Skills (comma-separated)<textarea value={skills} onChange={(e)=>setSkills(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border bg-card p-3" placeholder="Construction, masonry, teamwork"/></label>
          <label className="block text-sm">Professional bio<textarea value={bio} onChange={(e)=>setBio(e.target.value)} rows={4} maxLength={2000} className="mt-1 w-full rounded-xl border bg-card p-3"/></label>
        </>}
        <label className="block text-sm">Email<input value={session.user.email ?? ""} disabled className="mt-1 h-11 w-full rounded-xl border bg-muted px-3"/></label>
        <Button onClick={()=>void saveProfile()} disabled={busy}>Save profile</Button>
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
