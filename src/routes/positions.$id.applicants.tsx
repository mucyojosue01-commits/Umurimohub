import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Clock3, UserRound, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, Pill } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/positions/$id/applicants")({ component: Page });

type Applicant = { id: string; applicant_user_id: string; status: string; created_at: string; kind: string; worker?: { id: string; name: string; title: string | null; district: string | null } | null };
const nextActions: Record<string, { label: string; status: string }[]> = {
  submitted: [{label:"Start review",status:"under_review"},{label:"Shortlist",status:"shortlisted"},{label:"Reject",status:"rejected"}],
  viewed: [{label:"Start review",status:"under_review"},{label:"Shortlist",status:"shortlisted"},{label:"Reject",status:"rejected"}],
  under_review: [{label:"Shortlist",status:"shortlisted"},{label:"Invite to interview",status:"interview"},{label:"Reject",status:"rejected"}],
  shortlisted: [{label:"Invite to interview",status:"interview"},{label:"Make offer",status:"offer"},{label:"Reject",status:"rejected"}],
  interview: [{label:"Make offer",status:"offer"},{label:"Reject",status:"rejected"}],
  offer: [{label:"Withdraw offer / reject",status:"rejected"}],
};
function Page() {
 const {id}=Route.useParams(); const {user}=useApp();
 const [position,setPosition]=useState<{id:string;title:string;business_id:string|null;status:string}|null>(null);
 const [applicants,setApplicants]=useState<Applicant[]>([]);
 const [loading,setLoading]=useState(true); const [busy,setBusy]=useState<string|null>(null);
 const [offerFor,setOfferFor]=useState<string|null>(null); const [employmentType,setEmploymentType]=useState("full_time"); const [offerDetails,setOfferDetails]=useState("");
 const load=async()=>{
   setLoading(true);
   const {data:p,error:pe}=await supabase.from("opportunities").select("id,title,business_id,status,type").eq("id",id).eq("type","Job").maybeSingle();
   if(pe||!p){setPosition(null);setLoading(false);return;}
   setPosition(p);
   if(!p.business_id||!user?.businessIds.includes(p.business_id)){setApplicants([]);setLoading(false);return;}
   const {data:rows,error}=await supabase.from("applications").select("id,applicant_user_id,status,created_at,kind").eq("opportunity_id",id).order("created_at",{ascending:false});
   if(error){toast.error("Could not load applicants: "+error.message);setLoading(false);return;}
   const ids=[...new Set((rows??[]).map(x=>x.applicant_user_id))];
   const {data:workers}=ids.length?await supabase.from("worker_profiles").select("id,user_id,name,title,district").in("user_id",ids):{data:[] as {id:string;user_id:string;name:string;title:string|null;district:string|null}[]};
   const byUser=new Map((workers??[]).map(w=>[w.user_id,w]));
   setApplicants((rows??[]).map(a=>({...a,worker:byUser.get(a.applicant_user_id)??null})));
   setLoading(false);
 };
 useEffect(()=>{void load();},[id,user?.id,user?.businessIds]);
 const move=async(a:Applicant,status:string)=>{
   if(status==="offer"){setOfferFor(a.id);return;}
   setBusy(a.id);
   const {error}=await supabase.rpc("set_position_application_status",{_application_id:a.id,_status:status,_note:null,_employment_type:"full_time",_offer_details:""});
   setBusy(null);
   if(error){toast.error(error.message);return;}
   toast.success("Application moved to "+status.replaceAll("_"," ")+".");await load();
 };
 const makeOffer=async()=>{
   if(!offerFor)return;setBusy(offerFor);
   const {error}=await supabase.rpc("set_position_application_status",{_application_id:offerFor,_status:"offer",_note:"Employment offer issued",_employment_type:employmentType,_offer_details:offerDetails});
   setBusy(null);
   if(error){toast.error(error.message);return;}
   setOfferFor(null);setOfferDetails("");toast.success("Employment offer sent. The applicant can accept it from their worker profile.");await load();
 };
 if(!user)return <div className="container-page py-12"><PageHeader title="Manage applicants" desc="Sign in with an authorized company account."/></div>;
 if(loading)return <div className="container-page py-12"><PageHeader title="Manage applicants" desc="Loading applications…"/></div>;
 if(!position)return <div className="container-page py-12"><PageHeader title="Position unavailable" desc="This position could not be found."/></div>;
 if(!position.business_id||!user.businessIds.includes(position.business_id))return <div className="container-page py-12"><PageHeader title="Access restricted" desc="Only authorized members of the hiring company can manage applicants."/><Button asChild><Link to="/positions/$id" params={{id}}>Return to position</Link></Button></div>;
 const active=applicants.filter(a=>!["rejected","withdrawn"].includes(a.status));
 return <div className="container-page max-w-5xl py-10">
   <Link to="/positions/$id" params={{id}} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4"/>Position profile</Link>
   <PageHeader eyebrow="Hiring workspace" title="Manage applicants" desc={position.title+" · Review candidates, track each hiring stage, and issue employment offers."}/>
   <div className="mb-5 flex flex-wrap gap-2"><Pill>{active.length} active applicants</Pill><Pill>{applicants.length} total applications</Pill><Button variant="outline" asChild><Link to="/positions/$id/edit" params={{id}}>Edit position</Link></Button></div>
   {offerFor&&<Card className="mb-5 space-y-4 p-5"><h2 className="font-bold">Prepare employment offer</h2><label className="block text-sm">Employment type<select className="mt-1 h-11 w-full rounded-xl border bg-card px-3" value={employmentType} onChange={e=>setEmploymentType(e.target.value)}>{[["full_time","Full-time"],["part_time","Part-time"],["contract","Contract"],["temporary","Temporary"],["apprenticeship","Apprenticeship"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="block text-sm">Offer details<textarea className="mt-1 w-full rounded-xl border bg-card p-3" rows={3} maxLength={2000} value={offerDetails} onChange={e=>setOfferDetails(e.target.value)} placeholder="Compensation, expected start date, and other terms."/></label><div className="flex gap-2"><Button onClick={()=>void makeOffer()} disabled={!!busy}>Send offer</Button><Button variant="outline" onClick={()=>setOfferFor(null)}>Cancel</Button></div></Card>}
   {applicants.length===0?<Card className="p-8 text-center"><UserRound className="mx-auto size-8 text-muted-foreground"/><h2 className="mt-3 font-semibold">No applications yet</h2><p className="mt-1 text-sm text-muted-foreground">Applications for this position will appear here.</p></Card>:<div className="space-y-4">{applicants.map(a=><Card key={a.id} className="p-5"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{a.worker?.name??"Applicant"}</h2><Pill tone={a.status==="accepted"?"success":a.status==="rejected"?"danger":"primary"}>{a.status.replaceAll("_"," ")}</Pill></div><p className="mt-1 text-sm text-muted-foreground">{a.worker?.title??"Worker profile"}{a.worker?.district?" · "+a.worker.district:""}</p><p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3.5"/>Applied {new Date(a.created_at).toLocaleDateString()}</p>{a.worker&&<Button className="mt-3" size="sm" variant="outline" asChild><Link to="/workers/$id" params={{id:a.worker.id}}>View worker profile</Link></Button>}</div><div className="flex max-w-xl flex-wrap gap-2">{(nextActions[a.status]??[]).map(action=><Button key={action.status} size="sm" variant={action.status==="rejected"?"outline":"default"} disabled={busy===a.id} onClick={()=>void move(a,action.status)}>{action.label}</Button>)}{["accepted","rejected","withdrawn"].includes(a.status)&&<span className="flex items-center gap-1 text-sm text-muted-foreground"><CheckCircle2 className="size-4"/>Closed stage</span>}</div></div></Card>)}</div>}
 </div>;
}
