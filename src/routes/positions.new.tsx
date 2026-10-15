import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DISTRICTS, SECTORS, type Opportunity } from "@/features/data/demo";
import { useApp, type NewOpportunity } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { Card, PageHeader } from "@/features/ui/kit";
import { SearchSelect } from "@/components/search-select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/positions/new")({
  validateSearch: z.object({ businessId: z.string().optional().catch(""), type: z.enum(["Job", "Project", "Gig", "Seasonal", "Apprenticeship"]).optional().catch("Job") }),
  head: () => ({
    meta: [
      { title: "Create a position — UmurimoHub" },
      {
        name: "description",
        content: "Create and manage an employment position with a clear deadline and application process.",
      },
      { property: "og:title", content: "Create a position — UmurimoHub" },
      { property: "og:description", content: "Reach verified workers and teams across Rwanda." },
    ],
  }),
  component: Page,
});

const schema = z.object({
  title: z.string().trim().min(5, "At least 5 characters").max(100),
  type: z.enum(["Job", "Project", "Gig", "Seasonal", "Apprenticeship"]),
  sector: z.string().min(1),
  district: z.string().min(1, "Choose a district"),
  payRwf: z.coerce.number().positive("Enter pay in RWF").max(1e9),
  payUnit: z.enum(["day", "month", "project"]),
  mode: z.enum(["On-site", "Remote", "Hybrid"]),
  deadline: z.string().min(1, "Pick a date"),
  skills: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(20, "Describe the work (20+ chars)").max(1000),
  responsibilities: z.string().trim().min(10, "Add the main responsibilities").max(3000),
  requirements: z.string().trim().min(2, "Add at least one requirement").max(3000),
  businessId: z.string().min(1, "Select the company posting this position"),
});
type F = z.infer<typeof schema>;
const inp = "mt-1 h-11 w-full rounded-xl border bg-card px-3";

function Page() {
  const { createOpp, user, authReady } = useApp();
  const routeSearch = Route.useSearch();
  const { businesses } = useCatalog();
  const nav = useNavigate();
  const watchBusinessId = watch("businessId");
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "Job",
      payUnit: "project",
      mode: "On-site",
      sector: "Construction",
      district: "",
      businessId: routeSearch.businessId ?? user?.businessIds[0] ?? "",
    },
  });
  const onSubmit = async (f: F) => {
    if (!user || !f.businessId || !user.businessIds.includes(f.businessId)) {
      toast.error("Only an authorized company representative can publish a position.");
      return;
    }
    if (f.deadline < new Date().toISOString().slice(0, 10)) {
      toast.error("Deadline must be in the future");
      return;
    }
    const { ...rest } = f;
    const o: NewOpportunity = {
      ...rest,
      businessId: f.businessId,
      sector: f.sector as Opportunity["sector"],
      responsibilities: f.responsibilities
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20),
      requirements: f.requirements.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20),
      skills: f.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 15),

    };
    const r = await createOpp(o);
    if (!r.id) {
      toast.error(r.error ?? "Couldn't publish");
      return;
    }
    const { error: positionTypeError } = await supabase.from("opportunities").update({ opportunity_type: "company_position", position_name: f.title.trim() }).eq("id", r.id);
    if (positionTypeError) {
      toast.error("The position was created, but its company-position classification could not be saved: " + positionTypeError.message);
      return;
    }
    toast.success("Position published");
    nav({ to: "/positions/$id", params: { id: r.id } });
  };
  if (authReady && !user) {
    return (
      <div className="container-page max-w-xl py-16 text-center">
        <PageHeader
          eyebrow="Sign in"
          title="Create a position"
          desc="Sign in to create and manage an employment position."
        />
        <Button asChild size="lg">
          <Link to="/login">Sign in to post</Link>
        </Button>
      </div>
    );
  }
  const Err = ({ k }: { k: keyof F }) =>
    errors[k] ? (
      <span className="mt-1 block text-xs text-destructive">{String(errors[k]?.message)}</span>
    ) : null;
  return (
    <div className="container-page max-w-3xl py-10">
      <PageHeader
        eyebrow="Business"
        title="Post an opportunity"
        desc="Companies can define responsibilities, pay, requirements, and a firm application deadline. Only individual users can apply; expired positions close automatically."
      />
      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Title
            <input {...register("title")} className={inp} />
            <Err k="title" />
          </label>
          <label className="text-sm">
            Position type
            <input type="hidden" value="Job" {...register("type")} />
            <span className={inp + " flex items-center"}>Job position</span>
          </label>
          <label className="text-sm">
            Company hiring for this position
            <input type="hidden" {...register("businessId")} />
            <SearchSelect
              value={watchBusinessId}
              onChange={(value) => setValue("businessId", value, { shouldValidate: true, shouldDirty: true })}
              options={businesses.filter((b) => user?.businessIds.includes(b.id)).map((b) => ({ value: b.id, label: b.name, description: b.sector + " · " + b.district }))}
              placeholder="Search and select a company…"
              emptyText="No matching companies"
            />
            <Err k="businessId" />
          </label>
          <label className="text-sm">
            Sector
            <select {...register("sector")} className={inp}>
              {SECTORS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            District
            <select {...register("district")} className={inp}>
              <option value="">Select…</option>
              {DISTRICTS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <Err k="district" />
          </label>
          <label className="text-sm">
            Work mode
            <select {...register("mode")} className={inp}>
              {["On-site", "Remote", "Hybrid"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Pay (RWF)
            <input type="number" inputMode="numeric" {...register("payRwf")} className={inp} />
            <Err k="payRwf" />
          </label>
          <label className="text-sm">
            Per
            <select {...register("payUnit")} className={inp}>
              {["day", "month", "project"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Application deadline
            <input type="date" {...register("deadline")} className={inp} />
            <Err k="deadline" />
          </label>
          <label className="text-sm md:col-span-2">
            Skills (comma separated)
            <input {...register("skills")} placeholder="Masonry, Carpentry" className={inp} />
            <Err k="skills" />
          </label>
          <label className="text-sm md:col-span-2">
            Responsibilities
            <textarea rows={5} {...register("responsibilities")} placeholder="List the concrete work this person/team will do, one responsibility per line. Example: Install 120 m² of floor tiles; prepare surfaces and measure materials; keep the work area safe and clean; report daily progress." className="mt-1 w-full rounded-xl border bg-card p-3" />
            <Err k="responsibilities" />
          </label>
          <label className="text-sm md:col-span-2">
            Requirements
            <textarea rows={5} {...register("requirements")} placeholder="List what an applicant must bring or be able to do, one requirement per line. Example: 2+ years masonry experience; able to work on-site in Kigali; bring basic hand tools; available for the full project period." className="mt-1 w-full rounded-xl border bg-card p-3" />
            <span className="mt-1 block text-xs text-muted-foreground">Each line becomes a check-list item applicants can review before applying.</span>
            <Err k="requirements" />
          </label>
          <label className="text-sm md:col-span-2">
            Description
            <textarea
              rows={5}
              {...register("summary")}
              className="mt-1 w-full rounded-xl border bg-card p-3"
            />
            <Err k="summary" />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" size="lg">
              Publish position
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
