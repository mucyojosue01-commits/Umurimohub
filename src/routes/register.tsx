import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DISTRICTS, SECTORS } from "@/features/data/demo";
import { useApp, type Role } from "@/features/store/app-store";
import { Card, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Join UmurimoHub — Set up your profile" },
      {
        name: "description",
        content: "Create your worker, team, business or learner profile on UmurimoHub.",
      },
      { property: "og:title", content: "Join UmurimoHub" },
      {
        property: "og:description",
        content: "Set up your profile and start finding trusted work.",
      },
    ],
  }),
  component: Page,
});

const ROLE_OPTS: { v: Role; label: string; desc: string }[] = [
  { v: "worker", label: "Worker", desc: "Find jobs, gigs and projects" },
  { v: "team_lead", label: "Team leader", desc: "Lead a crew and apply as a team" },
  { v: "business", label: "Business / MSME", desc: "Post opportunities and hire" },
  { v: "learner", label: "Learner", desc: "Build skills through training" },
];

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    phone: z
      .string()
      .trim()
      .transform((p) => p.replace(/\s/g, ""))
      .refine((p) => p === "" || /^(\+250|0)7\d{8}$/.test(p), "Use 07XXXXXXXX")
      .transform((p) => (p ? "+250" + p.replace(/^(\+250|0)/, "") : null)),
    district: z.string().refine((d) => DISTRICTS.includes(d), "Choose your district"),
    roles: z
      .array(z.enum(["worker", "team_lead", "business", "learner"]))
      .min(1, "Pick at least one"),
    title: z.string().trim().max(120),
    sector: z.string().refine((s) => (SECTORS as readonly string[]).includes(s)),
    skills: z.string().trim().max(300),
    rate: z.coerce.number().int().min(0).max(10_000_000),
    businessName: z.string().trim().max(120),
    teamName: z.string().trim().max(120),
  })
  .superRefine((v, ctx) => {
    if (v.roles.includes("business") && v.businessName.length < 2)
      ctx.addIssue({ code: "custom", path: ["businessName"], message: "Enter your business name" });
    if (v.roles.includes("team_lead") && v.teamName.length < 2)
      ctx.addIssue({ code: "custom", path: ["teamName"], message: "Enter your team name" });
  });

const inp = "mt-1 h-11 w-full rounded-xl border bg-card px-3";

function Page() {
  const { user, session, authReady, reloadUser } = useApp();
  const qc = useQueryClient();
  const nav = useNavigate();
  const createMode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("create") : null;
  const [f, setF] = useState({
    name: "",
    phone: "",
    district: "",
    roles: [(createMode === "business" ? "business" : createMode === "team" ? "team_lead" : "worker")] as Role[],
    title: "",
    sector: "Construction",
    skills: "",
    rate: "0",
    businessName: "",
    teamName: "",
  });
  const [workDistricts, setWorkDistricts] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [businessImage, setBusinessImage] = useState<File | null>(null);
  useEffect(() => {
    if (user)
      setF((p) => ({
        ...p,
        name: p.name || user.name,
        district: p.district || user.district,
        roles: user.roles.length
          ? user.roles.filter((r) => ROLE_OPTS.some((o) => o.v === r))
          : p.roles,
      }));
  }, [user]);

  if (!authReady)
    return <div className="container-page py-20 text-center text-muted-foreground">Loading…</div>;
  if (!session)
    return (
      <div className="container-page max-w-md py-16 text-center">
        <PageHeader
          eyebrow="Join free"
          title="Create your account"
          desc="First create an account, then set up your profile in a minute."
        />
        <Button size="lg" asChild>
          <Link to="/login">Sign up or sign in</Link>
        </Button>
      </div>
    );

  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const toggleRole = (r: Role) =>
    set("roles", f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r]);
  const needsWorker = f.roles.includes("worker") || f.roles.includes("team_lead");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const p = schema.safeParse(f);
    if (!p.success) {
      setErr(p.error.issues[0]?.message ?? "Check the form");
      return;
    }
    const v = p.data;
    try {
    const roles = v.roles as Array<"worker" | "team_lead" | "business" | "learner">;
    const skills = [...new Set(v.skills.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 15);
    const { error } = await supabase.rpc("complete_onboarding", {
      _display_name: v.name,
      _phone: v.phone ?? null,
      _district: v.district,
      _roles: roles,
      _title: v.title,
      _sector: v.sector,
      _rate_rwf: v.rate,
      _skills: skills,
      _business_name: v.roles.includes("business") ? v.businessName : null,
      _team_name: v.roles.includes("team_lead") ? v.teamName : null,
      _create_new_business: createMode === "business",
      _create_new_team: createMode === "team",
    });
    if (error) {
      if (error.code === "42501") throw new Error("Your account is not authorized to complete onboarding.");
      throw new Error("We couldn't save your profile. Please check your details and try again.");
    }
    const extraDistricts = [...new Set((workDistricts || "").split(",").map((d) => d.trim()).filter((d) => DISTRICTS.includes(d)))];
    if (extraDistricts.length) {
      const [worker, businesses, teams] = await Promise.all([
        supabase.from("worker_profiles").select("id").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("business_members").select("business_id").eq("user_id", session.user.id),
        supabase.from("teams").select("id").eq("lead_user_id", session.user.id),
      ]);
      if (worker.data?.id) await supabase.from("worker_districts").upsert(extraDistricts.map((district) => ({ worker_id: worker.data!.id, district })), { onConflict: "worker_id,district" });
      if (businesses.data?.length) await supabase.from("business_districts").upsert(businesses.data.flatMap((b) => extraDistricts.map((district) => ({ business_id: b.business_id, district }))), { onConflict: "business_id,district" });
      if (teams.data?.length) await supabase.from("team_districts").upsert(teams.data.flatMap((t) => extraDistricts.map((district) => ({ team_id: t.id, district }))), { onConflict: "team_id,district" });
    }
    if (businessImage && v.roles.includes("business")) {
      if (!businessImage.type.startsWith("image/") || businessImage.size > 5_000_000) throw new Error("Business picture must be an image under 5 MB.");
      const { data: biz } = await supabase.from("businesses").select("id").eq("created_by", session.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (biz?.id) {
        const path = session.user.id + "/businesses/" + biz.id + "/" + crypto.randomUUID() + "-" + businessImage.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const upload = await supabase.storage.from("avatars").upload(path, businessImage, { upsert: false, contentType: businessImage.type });
        if (upload.error) throw new Error("Business was created, but its picture could not be uploaded.");
        const { data: url } = supabase.storage.from("avatars").getPublicUrl(upload.data.path);
        const update = await supabase.from("businesses").update({ avatar_url: url.publicUrl }).eq("id", biz.id);
        if (update.error) throw new Error("Business was created, but its picture could not be saved.");
      }
    }
    await reloadUser();
      await qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Profile saved");
      nav({ to: "/dashboard" });
    } catch (e2) {
      setErr((e2 as { message?: string }).message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page max-w-2xl py-10">
      <PageHeader
        eyebrow="Onboarding"
        title={createMode === "business" ? "Create another business" : createMode === "team" ? "Create another team" : "Set up your profile"}
        desc={createMode ? "Create a new entity while keeping your existing businesses and teams." : "You can hold more than one role — for example worker and team leader."}
      />
      <Card className="p-6">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-semibold">I am a…</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ROLE_OPTS.map((o) => (
                <label
                  key={o.v}
                  className={`flex cursor-pointer gap-3 rounded-2xl border p-3 ${f.roles.includes(o.v) ? "border-primary bg-primary/5" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={f.roles.includes(o.v)}
                    onChange={() => toggleRole(o.v)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold">{o.label}</span>
                    <span className="text-xs text-muted-foreground">{o.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="text-sm">
            Full name
            <input
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={80}
              className={inp}
            />
          </label>
          <label className="text-sm">
            Phone (optional)
            <input
              value={f.phone}
              onChange={(e) => set("phone", e.target.value)}
              inputMode="tel"
              placeholder="07XXXXXXXX"
              className={inp}
            />
          </label>
          <label className="text-sm">
            District
            <select
              value={f.district}
              onChange={(e) => set("district", e.target.value)}
              className={inp}
            >
              <option value="">Select…</option>
              {DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            Other districts where you work
            <input list="district-search" value={workDistricts} onChange={(e) => setWorkDistricts(e.target.value)} placeholder="Type districts, separated by commas" className={inp} />
            <datalist id="district-search">{DISTRICTS.map((d) => <option key={d} value={d} />)}</datalist>
            <span className="mt-1 block text-xs text-muted-foreground">You can work across multiple districts. Your main district above remains your home/base.</span>
          </label>
          <label className="text-sm">
            Main sector
            <select
              value={f.sector}
              onChange={(e) => set("sector", e.target.value)}
              className={inp}
            >
              {SECTORS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          {needsWorker && (
            <>
              <label className="text-sm">
                Headline
                <input
                  value={f.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Mason & tiler"
                  maxLength={120}
                  className={inp}
                />
              </label>
              <label className="text-sm">
                Day rate (RWF)
                <input
                  type="number"
                  inputMode="numeric"
                  value={f.rate}
                  onChange={(e) => set("rate", e.target.value)}
                  className={inp}
                />
              </label>
              <label className="text-sm md:col-span-2">
                Skills (comma separated)
                <input
                  value={f.skills}
                  onChange={(e) => set("skills", e.target.value)}
                  placeholder="Masonry, Tiling"
                  className={inp}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Skills start as self-declared. Certificates and assessments upgrade them later.
                </span>
              </label>
            </>
          )}
          {f.roles.includes("business") && (
            <>
            <label className="text-sm md:col-span-2">
              Business name
              <input
                value={f.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                maxLength={120}
                className={inp}
              />
            </label>
            <label className="text-sm md:col-span-2">
              Business picture (optional)
              <input type="file" accept="image/*" className="mt-1 block w-full rounded-xl border bg-card p-2 text-sm" onChange={(e)=>setBusinessImage(e.target.files?.[0] ?? null)} />
              <span className="mt-1 block text-xs text-muted-foreground">If you skip this, the business uses its initials.</span>
            </label>
            </>
          )}
          {f.roles.includes("team_lead") && (
            <label className="text-sm md:col-span-2">
              Team name
              <input
                value={f.teamName}
                onChange={(e) => set("teamName", e.target.value)}
                maxLength={120}
                className={inp}
              />
            </label>
          )}
          {err && (
            <p role="alert" className="text-sm text-destructive md:col-span-2">
              {err}
            </p>
          )}
          <div className="md:col-span-2">
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Saving…" : "Save and continue"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
