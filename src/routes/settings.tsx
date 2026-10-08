import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

  if (!session || !user) return <div className="container-page py-16"><PageHeader title="Profile & settings" desc="Sign in to manage your account."/><Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button></div>;

  const saveProfile = async () => {
    if (name.trim().length < 2) { toast.error("Enter your full name."); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim(), updated_at: new Date().toISOString() }).eq("id", session.user.id);
    setBusy(false);
    if (error) { toast.error("Couldn't save your profile."); return; }
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
    setAvatarBusy(false);
    if (error) { toast.error("Picture uploaded but profile could not be updated."); return; }
    await reloadUser();
    toast.success("Profile picture updated.");
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
        <h2 className="font-semibold">Password</h2>
        <p className="text-sm text-muted-foreground">Set a new password for email/password sign-in.</p>
        <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" className="h-11 w-full rounded-xl border bg-card px-3"/>
        <Button variant="outline" onClick={()=>void changePassword()} disabled={busy || !password}>Change password</Button>
      </Card>
    </div>
  </div>;
}
