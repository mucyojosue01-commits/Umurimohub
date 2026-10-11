import { createFileRoute, Link, notFound, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, MapPin, Pencil, Plus, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { mapBusiness, mapOpportunity } from "@/features/data/mappers";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, Card, PageHeader, Pill } from "@/features/ui/kit";

export const Route = createFileRoute("/business/$id")({
  loader: async ({ params }) => {
    const { data: rawBusiness, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", params.id)
      .eq("is_demo", false)
      .maybeSingle();

    if (businessError) throw new Error("Company profile could not be loaded: " + businessError.message);
    if (!rawBusiness) throw notFound();

    const { data: rawOpportunities, error: opportunitiesError } = await supabase
      .from("opportunities")
      .select("*")
      .eq("business_id", params.id)
      .eq("status", "open")
      .eq("is_demo", false)
      .order("created_at", { ascending: false });

    if (opportunitiesError) throw new Error("Company opportunities could not be loaded: " + opportunitiesError.message);

    // Employment data is optional until the recruitment migration is applied; it must not break public company pages.
    const { data: employmentRows } = await supabase.from("company_employments").select("id,worker_id,position_name,employment_type,started_at,status").eq("business_id", params.id).eq("status", "active").order("started_at", { ascending: false });
    const { data: completedWorkRows } = await supabase.from("verified_experiences").select("id").eq("business_id", params.id);
    const employeeIds = [...new Set((employmentRows ?? []).map((row) => row.worker_id))];
    const { data: employeeProfiles } = employeeIds.length
      ? await supabase.from("worker_profiles").select("id,name,title,district,avatar_url").in("id", employeeIds)
      : { data: [] as { id: string; name: string; title: string; district: string; avatar_url: string | null }[] };
    const profileById = new Map((employeeProfiles ?? []).map((worker) => [worker.id, worker]));
    return {
      business: mapBusiness(rawBusiness, rawOpportunities ?? []),
      openOpportunities: (rawOpportunities ?? []).map(mapOpportunity),
      employees: (employmentRows ?? []).map((row) => ({ ...row, worker: profileById.get(row.worker_id) ?? null })).filter((row) => row.worker),
      completedProjects: completedWorkRows?.length ?? 0,
    };
  },
  notFoundComponent: () => (
    <div className="container-page py-12">
      <Card>
        <h1 className="font-semibold">Company not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This company is unavailable or not publicly listed.</p>
        <Button variant="outline" className="mt-4" asChild><Link to="/business">Browse companies</Link></Button>
      </Card>
    </div>
  ),
  errorComponent: () => (
    <div className="container-page py-12">
      <Card>
        <h1 className="font-semibold">Company profile could not load</h1>
        <p className="mt-2 text-sm text-muted-foreground">The profile request failed. Return to the directory or reload this page to retry.</p>
        <Button variant="outline" className="mt-4" asChild><Link to="/business">Company directory</Link></Button>
      </Card>
    </div>
  ),
  head: () => ({ meta: [{ title: "Company profile — UmurimoHub" }, { name: "description", content: "Company information, services and open opportunities on UmurimoHub." }] }),
  component: BusinessProfilePage,
});

const money = (value: number) => new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(value) + " RWF";

function BusinessProfilePage() {
  const { id } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname.replace(/\/+$/, "") });
  const { user } = useApp();
  const { workers, workerUserIds } = useCatalog();
  const { business, openOpportunities, employees, completedProjects } = Route.useLoaderData();
  const isOwner = !!user && user.businessIds.includes(id);
  const [offerWorkerId, setOfferWorkerId] = useState("");
  const [positionName, setPositionName] = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [offerDetails, setOfferDetails] = useState("");
  const [positionPay, setPositionPay] = useState("");
  const [sendingOffer, setSendingOffer] = useState(false);
  const [publishingPosition, setPublishingPosition] = useState(false);
  const publishPosition = async () => {
    if (!user || !isOwner || positionName.trim().length < 2) { toast.error("Enter a position name first."); return; }
    setPublishingPosition(true);
    const deadline = new Date(); deadline.setDate(deadline.getDate() + 30);
    const { error } = await supabase.from("opportunities").insert({
      title: positionName.trim(), position_name: positionName.trim(), opportunity_type: "company_position", type: "Job", pay_unit: "month", mode: "On-site", duration: "Permanent", skills: [], responsibilities: [], requirements: [],
      summary: offerDetails.trim() || `Join ${business.name} as ${positionName.trim()}.`,
      pay_rwf: Number(positionPay) || 0, deadline: deadline.toISOString().slice(0, 10),
      district: business.district || "Kigali", sector: business.sector, status: "open",
      created_by: user.id, business_id: id,
    });
    setPublishingPosition(false);
    if (error) { toast.error(error.message.includes("opportunity_type") || error.message.includes("position_name") ? "Apply the company recruitment migration before publishing Company Positions." : error.message); return; }
    toast.success("Company Position published to Opportunities.");
    setPositionPay("");
  };
  const sendEmploymentOffer = async () => {
    if (!user || !offerWorkerId || positionName.trim().length < 2) { toast.error("Choose a worker and enter a position name."); return; }
    const workerUserId = workerUserIds[offerWorkerId];
    if (!workerUserId) { toast.error("This worker has not connected an account for recruitment yet."); return; }
    setSendingOffer(true);
    const { error } = await supabase.from("employment_offers").insert({ business_id: id, worker_id: offerWorkerId, worker_user_id: workerUserId, position_name: positionName.trim(), employment_type: employmentType, details: offerDetails.trim(), offered_by: user.id });
    setSendingOffer(false);
    if (error) { toast.error(error.message.includes("employment_offers") ? "Recruitment is not enabled in the database yet. Apply the company recruitment migration first." : error.message); return; }
    toast.success("Employment offer sent. The worker must accept before appearing as an employee.");
    setOfferWorkerId(""); setPositionName(""); setOfferDetails("");
  };

  return <>
    {pathname === `/business/${id}` && <div className="container-page py-8 md:py-10">
    <Link to="/business" className="text-sm text-muted-foreground hover:text-foreground">← Company directory</Link>
    <Card className="mt-4 overflow-hidden p-0"><div className="h-2 bg-primary" /><div className="p-5 md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div className="flex min-w-0 items-start gap-4"><Avatar initials={business.name.slice(0,2).toUpperCase()} src={business.avatarUrl} alt={business.name} size="lg" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Building2 className="size-5 text-primary" /><h1 className="break-words text-2xl font-display font-bold md:text-3xl">{business.name}</h1>{business.verified && <Pill tone="success"><ShieldCheck className="size-3.5" />Verified company</Pill>}</div><p className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" />{business.district || "Rwanda"} · {business.sector}</p></div></div>
      {isOwner && <div className="flex flex-wrap gap-2"><Button asChild><Link to="/opportunities/new"><Plus className="mr-2 size-4" />Post opportunity</Link></Button><Button variant="outline" asChild><Link to="/business/$id/edit" params={{ id }}><Pencil className="mr-2 size-4" />Edit company</Link></Button></div>}</div>
      <p className="mt-6 whitespace-pre-line leading-7 text-muted-foreground">{business.about || "This company has not added an overview yet."}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Completed projects</p><p className="mt-1 text-2xl font-bold">{completedProjects}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Active employees</p><p className="mt-1 text-2xl font-bold">{employees.length}</p></div></div>
      {business.services.length > 0 && <div className="mt-5"><p className="mb-2 text-sm font-semibold">Services & capabilities</p><div className="flex flex-wrap gap-2">{business.services.map((service) => <Pill key={service}>{service}</Pill>)}</div></div>}
      <section className="mt-7 rounded-2xl border p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Our People</h2><p className="mt-1 text-sm text-muted-foreground">Employees appear here after accepting a company position offer.</p></div><Pill>{employees.length} active {employees.length === 1 ? "employee" : "employees"}</Pill></div>
      {employees.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{employees.map((employee) => <Link key={employee.id} to="/workers/$id" params={{ id: employee.worker_id }} className="flex items-center gap-3 rounded-xl border p-3 transition hover:border-primary/40 hover:bg-muted/30"><Avatar initials={employee.worker.name.slice(0,2).toUpperCase()} src={employee.worker.avatar_url} alt={employee.worker.name} /><div className="min-w-0"><p className="truncate font-semibold">{employee.worker.name}</p><p className="text-sm text-primary">{employee.position_name}</p><p className="text-xs text-muted-foreground">Since {new Date(employee.started_at).toLocaleDateString()}</p></div></Link>)}</div> : <p className="mt-4 rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">No active employees listed yet.</p>}
      {isOwner && <div className="mt-6 border-t pt-5"><h3 className="font-semibold">Recruit a worker</h3><p className="mt-1 text-sm text-muted-foreground">Send a named position offer. The worker must accept it before the employment appears on either profile.</p><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-sm">Worker<select value={offerWorkerId} onChange={(e) => setOfferWorkerId(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3"><option value="">Choose a worker</option>{workers.filter((worker) => workerUserIds[worker.id] && !employees.some((employee) => employee.worker_id === worker.id)).map((worker) => <option key={worker.id} value={worker.id}>{worker.name} — {worker.title}</option>)}</select></label><label className="text-sm">Position name<input value={positionName} onChange={(e) => setPositionName(e.target.value)} placeholder="e.g. Construction Supervisor" className="mt-1 h-11 w-full rounded-xl border bg-background px-3" maxLength={120} /></label><label className="text-sm">Compensation (RWF, optional)<input inputMode="numeric" value={positionPay} onChange={(e) => setPositionPay(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 450000" className="mt-1 h-11 w-full rounded-xl border bg-background px-3" /></label><label className="text-sm">Employment type<select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3"><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="temporary">Temporary</option><option value="apprenticeship">Apprenticeship</option></select></label><label className="text-sm">Offer details<textarea value={offerDetails} onChange={(e) => setOfferDetails(e.target.value)} rows={2} placeholder="Responsibilities, location, terms (optional)" className="mt-1 w-full rounded-xl border bg-background p-3" /></label></div><div className="mt-3 flex flex-wrap gap-2"><Button onClick={sendEmploymentOffer} disabled={sendingOffer || !offerWorkerId || positionName.trim().length < 2}>{sendingOffer ? "Sending offer…" : "Send employment offer"}</Button><Button variant="outline" onClick={publishPosition} disabled={publishingPosition || positionName.trim().length < 2}>{publishingPosition ? "Publishing…" : "Publish as Company Position"}</Button></div></div>}
    </section>
    <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Trust score</p><p className="mt-1 text-2xl font-bold">{Math.round(business.trustScore ?? 0)}<span className="ml-1 text-xs font-normal text-muted-foreground">/ 100</span></p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Rating</p><p className="mt-1 flex items-center gap-1 text-2xl font-bold"><Star className="size-5 text-amber-500" />{business.rating > 0 ? business.rating.toFixed(1) : "—"}<span className="text-xs font-normal text-muted-foreground">/ 5</span></p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Open opportunities</p><p className="mt-1 text-2xl font-bold">{business.hiring}</p></div></div>
    </div></Card>
    <section className="mt-9"><PageHeader eyebrow="Work with this company" title="Open opportunities" desc="Current opportunities published by this company." />
      {openOpportunities.length === 0 ? <Card><h2 className="font-semibold">No open opportunities listed</h2><p className="mt-1 text-sm text-muted-foreground">New opportunities will appear here when published.</p>{isOwner && <Button className="mt-4" asChild><Link to="/opportunities/new"><Plus className="mr-2 size-4" />Create opportunity</Link></Button>}</Card> : <div className="grid gap-4 md:grid-cols-2">{openOpportunities.map((item) => <Card key={item.id} className="flex flex-col"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.summary || "See the opportunity for full details."}</p></div><Pill tone="success">Open</Pill></div><div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{item.sector}</span><span>{item.district}</span><span>{money(item.payRwf)} / {item.payUnit}</span></div><div className="mt-4 border-t pt-3"><Button variant="outline" size="sm" asChild><Link to="/opportunities/$id" params={{ id: item.id }}>View opportunity</Link></Button></div></Card>)}</div>}
    </section>
    </div>}
    <Outlet />
  </>; 
}
