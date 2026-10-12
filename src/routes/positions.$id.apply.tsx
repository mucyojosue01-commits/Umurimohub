import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/positions/$id/apply")({ component: Page });
function Page(){
 const {id}=Route.useParams();const {user,apply,authReady}=useApp();const nav=useNavigate();
 const [note,setNote]=useState("");const [busy,setBusy]=useState(false);const [title,setTitle]=useState("Position application");const [businessId,setBusinessId]=useState<string|null>(null);const [available,setAvailable]=useState<boolean|null>(null);
 useState(()=>{void supabase.from("opportunities").select("title,business_id,status,deadline,type").eq("id",id).eq("type","Job").maybeSingle().then(({data,error})=>{if(error||!data){setAvailable(false);return;}setTitle(data.title);setBusinessId(data.business_id);setAvailable(!!data.business_id&&data.status==="open"&&data.deadline>=new Date().toISOString().slice(0,10));});});
 const submit=async()=>{if(!user){nav({to:"/login"});return;}if(!businessId){toast.error("This position is not linked to a hiring company.");return;}setBusy(true);const result=await apply({oppId:id,kind:"individual",note:note.trim()});setBusy(false);if(!result.ok){toast.error(result.error??"Could not submit your application.");return;}toast.success("Your application was submitted.");nav({to:"/positions/$id",params:{id}});};
 if(authReady&&!user)return <div className="container-page max-w-2xl py-10"><PageHeader title="Apply for a position" desc="Sign in to submit an individual application."/><Button asChild><Link to="/login">Sign in</Link></Button></div>;
 return <div className="container-page max-w-2xl py-10"><Link to="/positions/$id" params={{id}} className="text-sm text-muted-foreground">← Back to position</Link><PageHeader eyebrow="Individual application" title={title} desc="Review the position details before submitting. Referrals can recommend you, but every candidate applies through their own account."/><Card className="space-y-4 p-6">{available===false?<p className="text-sm text-destructive">This position is unavailable or no longer accepting applications.</p>:<><label className="block text-sm">Cover note (optional)<textarea rows={6} maxLength={3000} className="mt-1 w-full rounded-xl border bg-card p-3" value={note} onChange={e=>setNote(e.target.value)} placeholder="Briefly explain your relevant skills and experience."/></label><p className="text-xs text-muted-foreground">Your worker profile and application will be shared with the hiring company.</p><Button disabled={busy||available!==true} onClick={()=>void submit()}>{busy?"Submitting…":"Submit application"}</Button></>}</Card></div>;
}
