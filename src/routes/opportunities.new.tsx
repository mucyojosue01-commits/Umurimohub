import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DISTRICTS, SECTORS, type Opportunity } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { Card, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/opportunities/new")({
  head: () => ({ meta: [{ title: "Post an opportunity — UmurimoHub" }, { name: "description", content: "Publish a job, project or seasonal opportunity to trusted workers and teams." }, { property: "og:title", content: "Post an opportunity — UmurimoHub" }, { property: "og:description", content: "Reach verified workers and teams across Rwanda." }] }),
  component: Page,
});

const schema = z.object({
  title: z.string().trim().min(5, "At least 5 characters").max(100),
  type: z.enum(["Job", "Project", "Gig", "Seasonal", "Apprenticeship"]),
  sector: z.string().min(1), district: z.string().min(1, "Choose a district"),
  payRwf: z.coerce.number().positive("Enter pay in RWF").max(1e9),
  payUnit: z.enum(["day", "month", "project"]), mode: z.enum(["On-site", "Remote", "Hybrid"]),
  duration: z.string().trim().min(1).max(40), deadline: z.string().min(1, "Pick a date"),
  skills: z.string().trim().min(2).max(200), summary: z.string().trim().min(20, "Describe the work (20+ chars)").max(1000),
  teamAllowed: z.boolean(), teamSize: z.coerce.number().min(0).max(500).optional(),
});
type F = z.infer<typeof schema>;
const inp = "mt-1 h-11 w-full rounded-xl border bg-card px-3";

function Page() {
  const { createOpp } = useApp();
  const nav = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { type: "Project", payUnit: "project", mode: "On-site", teamAllowed: true, sector: "Construction", district: "" } });
  const onSubmit = (f: F) => {
    const id = `u${Date.now()}`;
    const { teamSize, ...rest } = f;
    const o: Opportunity = { ...rest, ...(f.teamAllowed && teamSize ? { teamSize } : {}), id, businessId: "b1", sector: f.sector as Opportunity["sector"], skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean), responsibilities: ["As described"], requirements: ["See description"], posted: "now" };
    createOpp(o); toast.success("Opportunity published"); nav({ to: "/opportunities/$id", params: { id } });
  };
  const Err = ({ k }: { k: keyof F }) => errors[k] ? <span className="mt-1 block text-xs text-destructive">{String(errors[k]?.message)}</span> : null;
  return (
    <div className="container-page max-w-3xl py-10">
      <PageHeader eyebrow="Business" title="Post an opportunity" desc="Clear scope and fair pay attract the most trusted people." />
      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">Title<input {...register("title")} className={inp} /><Err k="title" /></label>
          <label className="text-sm">Type<select {...register("type")} className={inp}>{["Job", "Project", "Gig", "Seasonal", "Apprenticeship"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="text-sm">Sector<select {...register("sector")} className={inp}>{SECTORS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="text-sm">District<select {...register("district")} className={inp}><option value="">Select…</option>{DISTRICTS.map((x) => <option key={x}>{x}</option>)}</select><Err k="district" /></label>
          <label className="text-sm">Work mode<select {...register("mode")} className={inp}>{["On-site", "Remote", "Hybrid"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="text-sm">Pay (RWF)<input type="number" inputMode="numeric" {...register("payRwf")} className={inp} /><Err k="payRwf" /></label>
          <label className="text-sm">Per<select {...register("payUnit")} className={inp}>{["day", "month", "project"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="text-sm">Duration<input {...register("duration")} placeholder="e.g. 6 weeks" className={inp} /><Err k="duration" /></label>
          <label className="text-sm">Application deadline<input type="date" {...register("deadline")} className={inp} /><Err k="deadline" /></label>
          <label className="text-sm md:col-span-2">Skills (comma separated)<input {...register("skills")} placeholder="Masonry, Carpentry" className={inp} /><Err k="skills" /></label>
          <label className="text-sm md:col-span-2">Description<textarea rows={5} {...register("summary")} className="mt-1 w-full rounded-xl border bg-card p-3" /><Err k="summary" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("teamAllowed")} />Teams can apply</label>
          {watch("teamAllowed") && <label className="text-sm">Team size<input type="number" {...register("teamSize")} className={inp} /></label>}
          <div className="md:col-span-2"><Button type="submit" size="lg">Publish opportunity</Button></div>
        </form>
      </Card>
    </div>
  );
}
