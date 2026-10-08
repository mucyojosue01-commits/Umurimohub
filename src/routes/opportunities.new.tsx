import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DISTRICTS, SECTORS, type Opportunity } from "@/features/data/demo";
import { useApp, type NewOpportunity } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { Card, PageHeader } from "@/features/ui/kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/opportunities/new")({
  head: () => ({
    meta: [
      { title: "Post an opportunity — UmurimoHub" },
      {
        name: "description",
        content: "Publish a job, project or seasonal opportunity to trusted workers and teams.",
      },
      { property: "og:title", content: "Post an opportunity — UmurimoHub" },
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
  duration: z.string().trim().min(1).max(40),
  deadline: z.string().min(1, "Pick a date"),
  skills: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(20, "Describe the work (20+ chars)").max(1000),
  responsibilities: z.string().trim().min(10, "Add the main responsibilities").max(3000),
  requirements: z.string().trim().min(2, "Add at least one requirement").max(3000),
  teamAllowed: z.boolean(),
  teamSize: z.coerce.number().min(0).max(500).optional(),
  businessId: z.string().optional(),
  audience: z.enum(["individual", "team", "business", "any"]),
});
type F = z.infer<typeof schema>;
const inp = "mt-1 h-11 w-full rounded-xl border bg-card px-3";

function Page() {
  const { createOpp, user, authReady } = useApp();
  const { businesses } = useCatalog();
  const nav = useNavigate();
  const [media, setMedia] = useState<File[]>([]);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "Project",
      payUnit: "project",
      mode: "On-site",
      teamAllowed: true,
      sector: "Construction",
      district: "",
      businessId: "",
      audience: "any",
    },
  });
  const onSubmit = async (f: F) => {
    if (f.deadline < new Date().toISOString().slice(0, 10)) {
      toast.error("Deadline must be in the future");
      return;
    }
    const { teamSize, audience, ...rest } = f;
    const o: NewOpportunity = {
      ...rest,
      businessId: f.businessId,
      ...(f.teamAllowed && teamSize ? { teamSize } : {}),
      sector: f.sector as Opportunity["sector"],
      responsibilities: f.responsibilities\n        .split("\n")\n        .map((s) => s.trim())\n        .filter(Boolean)\n        .slice(0, 20),
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
    if (media.length) {
      for (const file of media) {
        if (file.size > 10_000_000) {\n          toast.error(`${file.name} is larger than 10 MB.`);\n          continue;\n        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${r.id}/${crypto.randomUUID()}-${safeName}`;
        const upload = await supabase.storage.from("opportunity-attachments").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upload.error) {\n          toast.error(`Couldn't upload ${file.name}.`);\n          continue;\n        }
        const { error: rowError } = await supabase.from("opportunity_attachments").insert({
          opportunity_id: r.id, uploaded_by: user!.id, storage_path: upload.data.path,
          file_name: file.name, mime_type: file.type || "application/octet-stream", size_bytes: file.size,
        });
        if (rowError) toast.error(`Couldn't save ${file.name}.`);
      }
    }
    toast.success(media.length ? "Opportunity published with media" : "Opportunity published");
    nav({ to: "/opportunities/$id", params: { id: r.id } });
  };
  if (authReady && !user) {\n    return (\n      <div className="container-page max-w-xl py-16 text-center">\n        <PageHeader\n          eyebrow="Sign in"\n          title="Post an opportunity"\n          desc="Sign in to publish a real opportunity."\n        />\n        <Button asChild size="lg">\n          <Link to="/login">Sign in to post</Link>\n        </Button>\n      </div>\n    );\n  }
  const Err = ({ k }: { k: keyof F }) =>
    errors[k] ? (
      <span className="mt-1 block text-xs text-destructive">{String(errors[k]?.message)}</span>
    ) : null;
  return (
    <div className="container-page max-w-3xl py-10">
      <PageHeader
        eyebrow="Business"
        title="Post an opportunity"
        desc="Clear scope and fair pay attract the most trusted people."
      />
      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Title
            <input {...register("title")} className={inp} />
            <Err k="title" />
          </label>
          <label className="text-sm">
            Type
            <select {...register("type")} className={inp}>
              {["Job", "Project", "Gig", "Seasonal", "Apprenticeship"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Publisher business <span className="text-muted-foreground">(optional)</span>
            <select {...register("businessId")} className={inp} defaultValue={user?.businessIds[0] ?? ""}>
              <option value="">Post as me</option>
              {businesses.filter((b) => user?.businessIds.includes(b.id)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            Who can apply
            <select {...register("audience")} className={inp}>
              <option value="any">Users, teams and businesses</option>
              <option value="individual">Users only</option>
              <option value="team">Teams only</option>
              <option value="business">Businesses only</option>
            </select>
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
            Duration
            <input {...register("duration")} placeholder="e.g. 6 weeks" className={inp} />
            <Err k="duration" />
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
            Media & attachments
            <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="mt-1 block w-full rounded-xl border bg-card p-2 text-sm" onChange={(e) => setMedia(Array.from(e.target.files ?? []).slice(0, 8))} />
            <span className="mt-1 block text-xs text-muted-foreground">Up to 8 files, 10 MB each.</span>
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("teamAllowed")} />
            Teams can apply
          </label>
          {watch("teamAllowed") && (
            <label className="text-sm">
              Team size
              <input type="number" {...register("teamSize")} className={inp} />
            </label>
          )}
          <div className="md:col-span-2">
            <Button type="submit" size="lg">
              Publish opportunity
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
