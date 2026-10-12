import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DISTRICTS, SECTORS } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { Card, PageHeader } from "@/features/ui/kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/positions/$id/edit")({component:Page,errorComponent:()=> <div className="container-page py-20 text-center">Could not load this position. Please retry.</div>});
type Form={title:string;summary:string;pay_rwf:string;pay_unit:string;deadline:string;district:string;sector:string;status:string;mode:string;duration:string;skills:string;responsibilities:string;requirements:string};
const input="mt-1 h-11 w-full rounded-xl border bg-card px-3";
function Page(){
 const {id}=Route.useParams(); const {user}=useApp();
 const [form,setForm]=useState<Form>({title:"",summary:"",pay_rwf:"",pay_unit:"month",deadline:"",district:"",sector:"",status:"open",mode:"On-site",duration:"",skills:"",responsibilities:"",requirements:""});
 const [busy,setBusy]=useState(false); const [loaded,setLoaded]=useState(false); const [loadError,setLoadError]=useState("");
 useEffect(()=>{let active=true;void supabase.from("opportunities").select("id,title,summary,pay_rwf,pay_unit,deadline,district,sector,status,type,mode,duration,skills,responsibilities,requirements,created_by,business_id").eq("id",id).eq("type","Job").maybeSingle().then(({data,error})=>{
  if(!active)return;if(error){setLoadError(error.message);return;}if(!data){setLoadError("This position could not be found.");return;}
  if(data.created_by!==user?.id&&(!data.business_id||!user?.businessIds.includes(data.business_id))){setLoadError("You are not allowed to edit this position.");return;}
  setForm({title:data.title??"",summary:data.summary??"",pay_rwf:String(data.pay_rwf??0),pay_unit:data.pay_unit??"month",deadline:data.deadline??"",district:data.district??"",sector:data.sector??"",status:data.status??"open",mode:data.mode??"On-site",duration:data.duration??"",skills:(data.skills??[]).join(", "),responsibilities:(data.responsibilities??[]).join("\n"),requirements:(data.requirements??[]).join("\n")});setLoaded(true);
 }).catch(e=>{if(active)setLoadError((e as Error).message||"Could not load this position.");});return()=>{active=false};},[id,user?.id,user?.businessIds]);
 const field=(key:keyof Form,value:string)=>setForm(old=>({...old,[key]:value}));
 const save=async()=>{
  if(form.title.trim().length<5){toast.error("Position title must contain at least 5 characters.");return;}
  if(form.summary.trim().length<20){toast.error("Add a description of at least 20 characters.");return;}
  if(!Number(form.pay_rwf)||Number(form.pay_rwf)<1){toast.error("Enter a valid compensation amount in RWF.");return;}
  if(!form.deadline){toast.error("Choose an application deadline.");return;}
  if(form.status==="open"&&form.deadline<new Date().toISOString().slice(0,10)){toast.error("An open position must have a future deadline.");return;}
  setBusy(true);const {error}=await supabase.from("opportunities").update({title:form.title.trim(),summary:form.summary.trim(),pay_rwf:Number(form.pay_rwf),pay_unit:form.pay_unit,type:"Job",mode:form.mode,duration:form.duration.trim(),skills:form.skills.split(",").map(x=>x.trim()).filter(Boolean).slice(0,30),responsibilities:form.responsibilities.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,30),requirements:form.requirements.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,30),deadline:form.deadline,district:form.district,sector:form.sector,status:form.status}).eq("id",id).eq("type","Job");
  setBusy(false);if(error){toast.error(error.message);return;}toast.success("Position updated. Active applicants will see the latest details.");window.location.href="/positions/"+id;
 };
 const end=async()=>{if(!window.confirm("End this position and stop accepting applications?"))return;setBusy(true);const {error}=await supabase.from("opportunities").update({status:"ended"}).eq("id",id).eq("type","Job");setBusy(false);if(error){toast.error(error.message);return;}toast.success("Position ended.");window.location.href="/positions/"+id;};
 if(!user)return <div className="container-page py-16 text-center"><PageHeader title="Manage position" desc="Sign in to manage your position."/><Button asChild><Link to="/login">Sign in</Link></Button></div>;
 if(!loaded)return <div className="container-page py-16"><PageHeader title={loadError?"Unable to open position editor":"Edit position"} desc={loadError||"Loading position…"}/>{loadError&&<Button className="mt-4" asChild><Link to="/positions/$id" params={{id}}>Return to position</Link></Button>}</div>;
 return <div className="container-page max-w-4xl py-10"><PageHeader eyebrow="Position management" title="Edit position" desc="Keep the role, compensation, requirements, and closing date accurate."/><Card className="p-6">
  <div className="grid gap-4 md:grid-cols-2">
   <label className="text-sm md:col-span-2">Position title<input className={input} value={form.title} onChange={e=>field("title",e.target.value)}/></label>
   <label className="text-sm">Compensation (RWF)<input type="number" min="1" className={input} value={form.pay_rwf} onChange={e=>field("pay_rwf",e.target.value)}/></label>
   <label className="text-sm">Pay frequency<select className={input} value={form.pay_unit} onChange={e=>field("pay_unit",e.target.value)}>{["day","month","project"].map(x=><option key={x} value={x}>{x==="day"?"Per day":x==="month"?"Per month":"Per project"}</option>)}</select></label>
   <label className="text-sm">Work arrangement<select className={input} value={form.mode} onChange={e=>field("mode",e.target.value)}>{["On-site","Remote","Hybrid"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label className="text-sm">Duration<input className={input} value={form.duration} onChange={e=>field("duration",e.target.value)}/></label>
   <label className="text-sm">Application deadline<input required type="date" min={new Date().toISOString().slice(0,10)} className={input} value={form.deadline} onChange={e=>field("deadline",e.target.value)}/><span className="mt-1 block text-xs text-muted-foreground">Expired positions close automatically and notify the employer.</span></label>
   <label className="text-sm">District<select className={input} value={form.district} onChange={e=>field("district",e.target.value)}>{DISTRICTS.map(d=><option key={d}>{d}</option>)}</select></label>
   <label className="text-sm">Sector<select className={input} value={form.sector} onChange={e=>field("sector",e.target.value)}>{SECTORS.map(s=><option key={s}>{s}</option>)}</select></label>
   <label className="text-sm">Listing status<select className={input} value={form.status} onChange={e=>field("status",e.target.value)}><option value="open">Open</option><option value="closed">Closed</option></select></label>
   <label className="text-sm md:col-span-2">Skills (comma-separated)<input className={input} value={form.skills} onChange={e=>field("skills",e.target.value)}/></label>
   <label className="text-sm md:col-span-2">Responsibilities (one per line)<textarea rows={4} className="mt-1 w-full rounded-xl border bg-card p-3" value={form.responsibilities} onChange={e=>field("responsibilities",e.target.value)}/></label>
   <label className="text-sm md:col-span-2">Requirements (one per line)<textarea rows={4} className="mt-1 w-full rounded-xl border bg-card p-3" value={form.requirements} onChange={e=>field("requirements",e.target.value)}/></label>
   <label className="text-sm md:col-span-2">Position description<textarea rows={7} className="mt-1 w-full rounded-xl border bg-card p-3" value={form.summary} onChange={e=>field("summary",e.target.value)}/></label>
  </div><div className="mt-6 flex flex-wrap gap-2"><Button disabled={busy} onClick={save}>{busy?"Saving…":"Save changes"}</Button><Button variant="outline" disabled={busy} onClick={end}>End position</Button><Button variant="ghost" asChild><Link to="/positions/$id" params={{id}}>Cancel</Link></Button></div>
 </Card></div>;
}
