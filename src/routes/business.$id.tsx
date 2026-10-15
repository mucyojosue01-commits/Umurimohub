import { createFileRoute, Link, notFound, Outlet, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { Building2, MapPin, Pencil, Plus, Search, ShieldCheck, Star, UserRoundMinus, UserRoundPen } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
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
    const openPositions = (rawOpportunities ?? []).filter((row) => row.opportunity_type === "company_position" && row.type === "Job" && (!row.deadline || row.deadline >= new Date().toISOString().slice(0, 10))).map(mapOpportunity);
    const openNonJobOpportunities = (rawOpportunities ?? []).filter((row) => row.opportunity_type !== "company_position" && row.type !== "Job").map(mapOpportunity);

    // Employment data is optional until the recruitment migration is applied; it must not break public company pages.
    const { data: employmentRows } = await supabase.from("company_employments").select("id,worker_id,worker_user_id,position_name,employment_type,started_at,status,opportunity_id").eq("business_id", params.id).eq("status", "active").order("started_at", { ascending: false });
    const { data: completedWorkRows } = await supabase.from("verified_experiences").select("id").eq("business_id", params.id);
    const employeeIds = [...new Set((employmentRows ?? []).map((row) => row.worker_id))];
    const { data: employeeProfiles } = employeeIds.length
      ? await supabase.from("worker_profiles").select("id,name,title,district,avatar_url").in("id", employeeIds)
      : { data: [] as { id: string; name: string; title: string; district: string; avatar_url: string | null }[] };
    const profileById = new Map((employeeProfiles ?? []).map((worker) => [worker.id, worker]));
    const positionIds = [...new Set((employmentRows ?? []).map((row) => row.opportunity_id).filter((value): value is string => !!value))];
    const { data: positionRows } = positionIds.length
      ? await supabase.from("opportunities").select("id,title,summary,pay_rwf,pay_unit,deadline,district,sector,mode,skills,responsibilities,requirements").in("id", positionIds)
      : { data: [] as { id: string; title: string; summary: string; pay_rwf: number; pay_unit: string; deadline: string; district: string; sector: string; mode: string; skills: string[]; responsibilities: string[]; requirements: string[] }[] };
    const positionById = new Map((positionRows ?? []).map((position) => [position.id, position]));
    return {
      business: mapBusiness(rawBusiness, rawOpportunities ?? []),
      openOpportunities: openNonJobOpportunities,
      openPositions,
      employees: (employmentRows ?? []).map((row) => ({ ...row, worker: profileById.get(row.worker_id) ?? null, position: row.opportunity_id ? positionById.get(row.opportunity_id) ?? null : null })).filter((row) => row.worker),
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
  const { business, openOpportunities, openPositions, employees, completedProjects } = Route.useLoaderData();
  const isOwner = !!user && user.businessIds.includes(id);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [endingEmployee, setEndingEmployee] = useState<(typeof employees)[number] | null>(null);
  const [confirmNoRepublish, setConfirmNoRepublish] = useState(false);
  const visibleEmployees = employees.filter((employee) => employee.worker.name.toLowerCase().includes(employeeSearch.toLowerCase()) || employee.position_name.toLowerCase().includes(employeeSearch.toLowerCase()));
  const manageEmployee = async (employee: typeof employees[number], action: "update_position") => {
    const nextPosition = window.prompt("Edit position for " + employee.worker.name, employee.position_name)?.trim();
    if (!nextPosition || nextPosition === employee.position_name) return;
    if (nextPosition.length < 2 || nextPosition.length > 120) { toast.error("Position must be 2–120 characters."); return; }
    const nextType = window.prompt("Employment type (full_time, part_time, contract, temporary, apprenticeship)", employee.employment_type)?.trim() || employee.employment_type;
    if (!["full_time", "part_time", "contract", "temporary", "apprenticeship"].includes(nextType)) { toast.error("Choose a valid employment type."); return; }
    if (!window.confirm("Confirm changing " + employee.worker.name + "’s position to “" + nextPosition + "” and employment type to " + nextType.replaceAll("_", " ") + "?")) return;
    const { error } = await supabase.rpc("manage_company_employment", { _employment_id: employee.id, _action: action, _position_name: nextPosition, _employment_type: nextType });
    if (error) toast.error("Could not update position: " + error.message); else { toast.success("Employee position updated."); window.location.reload(); }
  };

  return <>
    {pathname === `/business/${id}` && <div className="container-page py-8 md:py-10">
    <Link to="/business" className="text-sm text-muted-foreground hover:text-foreground">← Company directory</Link>
    <Card className="mt-4 overflow-hidden p-0"><div className="h-2 bg-primary" /><div className="p-5 md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div className="flex min-w-0 items-start gap-4"><Avatar initials={business.name.slice(0,2).toUpperCase()} src={business.avatarUrl} alt={business.name} size="lg" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Building2 className="size-5 text-primary" /><h1 className="break-words text-2xl font-display font-bold md:text-3xl">{business.name}</h1>{business.verified && <Pill tone="success"><ShieldCheck className="size-3.5" />Verified company</Pill>}</div><p className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" />{business.district || "Rwanda"} · {business.sector}</p></div></div>
      {isOwner && <div className="flex flex-wrap gap-2"><Button asChild><Link to="/positions/new" search={{ businessId: id }}><Plus className="mr-2 size-4" />Create position</Link></Button><Button variant="outline" asChild><Link to="/opportunities/new" search={{ businessId: id, type: "Project" }}>Post project</Link></Button><Button variant="outline" asChild><Link to="/business/$id/edit" params={{ id }}><Pencil className="mr-2 size-4" />Edit company</Link></Button></div>}</div>
      <p className="mt-6 whitespace-pre-line leading-7 text-muted-foreground">{business.about || "This company has not added an overview yet."}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Completed projects</p><p className="mt-1 text-2xl font-bold">{completedProjects}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Active employees</p><p className="mt-1 text-2xl font-bold">{employees.length}</p></div></div>
      {business.services.length > 0 && <div className="mt-5"><p className="mb-2 text-sm font-semibold">Services & capabilities</p><div className="flex flex-wrap gap-2">{business.services.map((service) => <Pill key={service}>{service}</Pill>)}</div></div>}
      <section className="mt-7 rounded-2xl border p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{isOwner ? "My employees" : "Our People"}</h2><p className="mt-1 text-sm text-muted-foreground">Each employee appears once with one current position.</p></div><Pill>{employees.length} active {employees.length === 1 ? "employee" : "employees"}</Pill></div>
      {isOwner && <div className="mt-4 flex items-center gap-2"><Search className="size-4 text-muted-foreground"/><input aria-label="Search employees by name or position" value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} placeholder="Search employee name or position…" className="h-10 min-w-0 flex-1 rounded-xl border bg-card px-3 text-sm"/></div>}
      {visibleEmployees.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{visibleEmployees.map((employee) => <div key={employee.worker_id} className="flex items-start gap-3 rounded-xl border p-3"><Link to="/workers/$id" params={{ id: employee.worker_id }} className="flex min-w-0 flex-1 items-center gap-3"><Avatar initials={employee.worker.name.slice(0,2).toUpperCase()} src={employee.worker.avatar_url} alt={employee.worker.name} /><div className="min-w-0"><p className="truncate font-semibold">{employee.worker.name}</p><p className="text-sm text-primary">{employee.position_name}</p><p className="text-xs text-muted-foreground">Since {new Date(employee.started_at).toLocaleDateString()}</p></div></Link>{isOwner && <div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" aria-label={"Edit position for " + employee.worker.name} onClick={() => void manageEmployee(employee, "update_position")}><UserRoundPen className="size-4"/></Button><Button size="icon" variant="ghost" aria-label={"Remove " + employee.worker.name + " from company"} onClick={() => setEndingEmployee(employee)}><UserRoundMinus className="size-4"/></Button></div>}</div>)}</div> : <p className="mt-4 rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">{employeeSearch ? "No employees match that search." : "No active employees listed yet."}</p>}
      
    </section>
    <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Trust score</p><p className="mt-1 text-2xl font-bold">{Math.round(business.trustScore ?? 0)}<span className="ml-1 text-xs font-normal text-muted-foreground">/ 100</span></p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Rating</p><p className="mt-1 flex items-center gap-1 text-2xl font-bold"><Star className="size-5 text-amber-500" />{business.rating > 0 ? business.rating.toFixed(1) : "—"}<span className="text-xs font-normal text-muted-foreground">/ 5</span></p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Open opportunities</p><p className="mt-1 text-2xl font-bold">{business.hiring}</p></div></div>
    </div></Card>
    <section className="mt-9"><PageHeader eyebrow="Careers" title="Open positions" desc="Employment roles currently advertised by this company." />
      {openPositions.length === 0 ? <Card><h2 className="font-semibold">No open positions listed</h2><p className="mt-1 text-sm text-muted-foreground">This company has no active employment listings right now.</p>{isOwner && <Button className="mt-4" asChild><Link to="/positions/new" search={{ businessId: id }}><Plus className="mr-2 size-4" />Create position</Link></Button>}</Card> : <div className="grid gap-4 md:grid-cols-2">{openPositions.map((item) => <Card key={item.id} className="flex flex-col"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.district}, Rwanda · {money(item.payRwf)} / {item.payUnit}</p><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.summary}</p></div><Pill tone="primary">Position</Pill></div><Button className="mt-4 self-start" variant="outline" asChild><Link to="/positions/$id" params={{id:item.id}}>View position</Link></Button></Card>)}</div>}
    </section>
    <section className="mt-9"><PageHeader eyebrow="Work with this company" title="Open opportunities" desc="Current opportunities published by this company." />
      {openOpportunities.length === 0 ? <Card><h2 className="font-semibold">No open opportunities listed</h2><p className="mt-1 text-sm text-muted-foreground">New opportunities will appear here when published.</p>{isOwner && <Button className="mt-4" asChild><Link to="/opportunities/new"><Plus className="mr-2 size-4" />Create opportunity</Link></Button>}</Card> : <div className="grid gap-4 md:grid-cols-2">{openOpportunities.map((item) => <Card key={item.id} className="flex flex-col"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.summary || "See the opportunity for full details."}</p></div><Pill tone="success">Open</Pill></div><div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{item.sector}</span><span>{item.district}</span><span>{money(item.payRwf)} / {item.payUnit}</span></div><div className="mt-4 border-t pt-3"><Button variant="outline" size="sm" asChild><Link to="/opportunities/$id" params={{ id: item.id }}>View opportunity</Link></Button></div></Card>)}</div>}
    </section>
    </div>}
    <Dialog open={!!endingEmployee} onOpenChange={(open) => { if (!open) { setEndingEmployee(null); setConfirmNoRepublish(false); } }}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle>{confirmNoRepublish ? "Confirm ending employment" : "End employment"}</DialogTitle>
          <DialogDescription>
            {confirmNoRepublish
              ? "Are you sure you want to end " + (endingEmployee?.worker.name ?? "this employee") + "’s employment without publishing this position again? The position will remain closed."
              : "This will end the employee’s current role. You can reopen the same position using its saved details, or keep it closed."}
          </DialogDescription>
        </DialogHeader>
        {!confirmNoRepublish && endingEmployee?.position && <div className="max-h-[45vh] space-y-3 overflow-y-auto rounded-xl border p-4 text-sm">
          <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Employee</p><p className="font-semibold">{endingEmployee.worker.name} · {endingEmployee.position_name}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Saved position</p><p className="font-semibold">{endingEmployee.position.title}</p><p className="mt-1 whitespace-pre-line text-muted-foreground">{endingEmployee.position.summary}</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <p><span className="text-muted-foreground">Pay: </span>{money(Number(endingEmployee.position.pay_rwf))} / {endingEmployee.position.pay_unit}</p>
            <p><span className="text-muted-foreground">Deadline: </span>{endingEmployee.position.deadline}</p>
            <p><span className="text-muted-foreground">Location: </span>{endingEmployee.position.district}</p>
            <p><span className="text-muted-foreground">Sector: </span>{endingEmployee.position.sector}</p>
            <p><span className="text-muted-foreground">Work mode: </span>{endingEmployee.position.mode}</p>
          </div>
          {endingEmployee.position.skills?.length > 0 && <div><p className="font-semibold">Skills</p><p className="text-muted-foreground">{endingEmployee.position.skills.join(", ")}</p></div>}
          {endingEmployee.position.responsibilities?.length > 0 && <div><p className="font-semibold">Responsibilities</p><ul className="list-disc pl-5 text-muted-foreground">{endingEmployee.position.responsibilities.map((item: string) => <li key={item}>{item}</li>)}</ul></div>}
          {endingEmployee.position.requirements?.length > 0 && <div><p className="font-semibold">Requirements</p><ul className="list-disc pl-5 text-muted-foreground">{endingEmployee.position.requirements.map((item: string) => <li key={item}>{item}</li>)}</ul></div>}
        </div>}
        {!confirmNoRepublish && !endingEmployee?.position && <p className="rounded-xl border p-4 text-sm text-muted-foreground">The employee’s original position listing is not linked to this employment record. Ending employment will keep the position closed.</p>}
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {confirmNoRepublish ? <>
            <Button variant="destructive" onClick={async () => { if (!endingEmployee) return; const { error } = await supabase.rpc("manage_company_employment", { _employment_id: endingEmployee.id, _action: "end", _position_name: null, _republish: false }); if (error) toast.error("Could not end employment: " + error.message); else { toast.success("Employment ended. The employee has been notified."); window.location.reload(); } }}>Yes, end employment</Button>
            <Button variant="outline" onClick={() => setConfirmNoRepublish(false)}>Go back</Button>
          </> : <>
            {endingEmployee?.position && <Button onClick={async () => { if (!endingEmployee) return; if (endingEmployee.position.deadline < new Date().toISOString().slice(0,10)) { toast.error("The saved deadline has passed. Edit the position deadline before republishing."); return; } const { error } = await supabase.rpc("manage_company_employment", { _employment_id: endingEmployee.id, _action: "end", _position_name: null, _republish: true }); if (error) toast.error("Could not end employment or republish position: " + error.message); else { toast.success("Employment ended and the position was published again. The employee was notified."); window.location.reload(); } }}>End employment & republish position</Button>}
            <Button variant="outline" onClick={() => setConfirmNoRepublish(true)}>Do not republish</Button>
            <Button variant="ghost" onClick={() => setEndingEmployee(null)}>Cancel</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Outlet />
  </>; 
}
