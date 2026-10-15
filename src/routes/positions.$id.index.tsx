import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, MapPin, BriefcaseBusiness, Wallet, Pencil, UserRoundCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, Pill } from "@/features/ui/kit";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { rwf } from "@/features/data/demo";
import { mapOpportunity } from "@/features/data/mappers";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/positions/$id/")({
  loader: async ({params}) => {
    const {data,error}=await supabase.from("opportunities").select("*").eq("id",params.id).eq("is_demo",false).maybeSingle();
    if(error) throw error;
    return {position:data ? mapOpportunity(data) : null};
  },
  head: ({loaderData}) => ({meta:[
    {title: loaderData?.position ? loaderData.position.title + " — Position — UmurimoHub" : "Position profile — UmurimoHub"},
    {name:"description",content:loaderData?.position?.summary ?? "Position details, requirements, and application deadline."}
  ]}),
  component: Page,
  notFoundComponent: () => <div className="container-page py-20 text-center">Position not found. <Link className="text-primary" to="/positions">Browse positions</Link></div>,
  errorComponent: () => <div className="container-page py-20 text-center">Could not load this position. Please retry.</div>,
});

function Page() {
  const {id}=Route.useParams();
  const {position:loaded}=Route.useLoaderData();
  const {allOpps,user}=useApp();
  const {getBusiness}=useCatalog();
  const [applicantCount,setApplicantCount]=useState(0);
  const [countError,setCountError]=useState(false);
  const p=allOpps.find(x=>x.id===id) ?? loaded;
  useEffect(()=>{
    let active=true;
    void supabase.from("applications").select("id",{count:"exact",head:true}).eq("opportunity_id",id).not("status","in","(withdrawn,rejected)").then(({count,error})=>{
      if(!active)return;
      if(error)setCountError(true); else setApplicantCount(count??0);
    });
    return ()=>{active=false};
  },[id]);
  if(!p) throw notFound();
  if(p.type.toLowerCase()!=="job") throw notFound();
  const owner=!!p.businessId && !!user?.businessIds.includes(p.businessId);
  const business=getBusiness(p.businessId);
  const expired=new Date(p.deadline+"T23:59:59") < new Date();
  const open=p.status==="open" && !expired;
  const removePosition = async () => {
    if (!window.confirm("Delete the position “" + p.title + "”? It will stop appearing in available positions, and existing applications will remain in the hiring history.")) return;
    const { error } = await supabase.from("opportunities").update({ status: "deleted" }).eq("id", id).eq("type", "Job");
    if (error) { toast.error("Could not delete this position: " + error.message); return; }
    toast.success("Position deleted from available listings.");
    window.location.href = "/positions";
  };
  const lines=(value:string[]|undefined)=>value?.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{value.map((x,i)=><li key={i}>{x}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Not specified.</p>;
  return <div className="container-page max-w-6xl py-10">
    <Link to="/positions" className="text-sm text-muted-foreground hover:text-foreground">← All positions</Link>
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="space-y-5">
      <Card className="p-6 md:p-8"><div className="flex flex-wrap gap-2"><Pill tone="primary">Employment position</Pill><Pill>{p.sector}</Pill><Pill tone={open?"accent":"warning"}>{open?"Accepting applications":expired?"Deadline passed":p.status==="closed"?"Closed":"Ended"}</Pill></div>
        <h1 className="mt-4 text-3xl font-extrabold md:text-4xl">{p.title}</h1><p className="mt-3 whitespace-pre-line text-muted-foreground">{p.summary}</p>
        {owner && <div className="mt-5 flex flex-wrap gap-2"><Button asChild><Link to="/positions/$id/edit" params={{id}}><Pencil className="mr-2 size-4"/>Edit position</Link></Button><Button variant="destructive" onClick={() => void removePosition()}><Trash2 className="mr-2 size-4"/>Delete position</Button></div>}
        {!owner && open && <Button className="mt-5" asChild><Link to="/positions/$id/apply" params={{id}}>Apply for position</Link></Button>}
        {!open && <div className="mt-5 rounded-xl border bg-muted/30 p-4 text-sm">This position is no longer accepting applications. The employer can update its deadline or end the listing from the edit page.</div>}
      </Card>
      <Card className="p-6"><h2 className="text-lg font-bold">Responsibilities</h2>{lines(p.responsibilities)}</Card>
      <Card className="p-6"><h2 className="text-lg font-bold">Requirements</h2>{lines(p.requirements)}</Card>
      <Card className="p-6"><h2 className="text-lg font-bold">Skills</h2>{p.skills?.length?<div className="mt-3 flex flex-wrap gap-2">{p.skills.map(s=><Pill key={s}>{s}</Pill>)}</div>:<p className="mt-2 text-sm text-muted-foreground">No specific skills listed.</p>}</Card>
    </div><aside className="space-y-4">
      <Card className="p-5"><h2 className="font-bold">Position overview</h2><div className="mt-4 space-y-4 text-sm">
        <div className="flex gap-3"><Wallet className="size-5 shrink-0 text-primary"/><div><p className="text-muted-foreground">Compensation</p><p className="font-semibold">{rwf(p.payRwf)} / {p.payUnit}</p></div></div>
        <div className="flex gap-3"><MapPin className="size-5 shrink-0 text-primary"/><div><p className="text-muted-foreground">Location</p><p className="font-semibold">{p.district}, Rwanda</p></div></div>
        <div className="flex gap-3"><BriefcaseBusiness className="size-5 shrink-0 text-primary"/><div><p className="text-muted-foreground">Work arrangement</p><p className="font-semibold">{p.mode}</p></div></div>
        <div className="flex gap-3"><CalendarDays className="size-5 shrink-0 text-primary"/><div><p className="text-muted-foreground">Application deadline</p><p className="font-semibold">{p.deadline}</p><p className="mt-1 text-xs text-muted-foreground">{open?"Closes automatically after the deadline.":"Applications are closed."}</p></div></div>
        <div className="flex gap-3"><UserRoundCheck className="size-5 shrink-0 text-primary"/><div><p className="text-muted-foreground">Applicants</p><p className="font-semibold">{countError?"Count unavailable":applicantCount+" applicant"+(applicantCount===1?"":"s")}</p></div></div>
      </div>{business && <div className="mt-5 border-t pt-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Published by</p><p className="mt-1 font-semibold">{business.name}</p><Button className="mt-3 w-full" variant="outline" asChild><Link to="/business/$id" params={{id:business.id}}>View employer profile</Link></Button></div>}</Card>
      {owner && <Card className="p-5"><h2 className="font-bold">Employer actions</h2><p className="mt-1 text-sm text-muted-foreground">Update the role, change the closing date, or end the listing.</p><Button className="mt-4 w-full" asChild><Link to="/positions/$id/edit" params={{id}}>Edit position</Link></Button></Card>}
    </aside></div>
  </div>;
}
