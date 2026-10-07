import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DISTRICTS, rwf } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { Card, DemoNotice, PageHeader, Pill } from "@/features/ui/kit";
import { recommendOpportunities } from "@/lib/recommend.functions";

export const Route = createFileRoute("/match")({
  head: () => ({
    meta: [
      { title: "Find my best opportunities — UmurimoHub" },
      {
        name: "description",
        content:
          "Share your skills, district and availability and get AI-powered opportunity matches with clear reasons.",
      },
      { property: "og:title", content: "AI opportunity matching — UmurimoHub" },
      {
        property: "og:description",
        content: "Personal opportunity recommendations with plain-language fit explanations.",
      },
    ],
  }),
  component: Page,
});

type Rec = { id: string; score: number; fit: string; gaps: string };
const inp = "mt-1 h-11 w-full rounded-xl border bg-card px-3";

function Page() {
  // CI formatting pass
  const { allOpps } = useApp();
  const run = useServerFn(recommendOpportunities);
  const [skills, setSkills] = useState("");
  const [district, setDistrict] = useState("Gasabo");
  const [availability, setAvailability] = useState("Full-time, starting now");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recs, setRecs] = useState<Rec[] | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!list.length) {
      setError("Add at least one skill.");
      return;
    }
    setLoading(true);
    setError("");
    setRecs(null);
    try {
      const res = await run({
        data: {
          skills: list,
          district,
          availability,
          opportunities: allOpps.slice(0, 40).map((o) => ({
            id: o.id,
            title: o.title,
            sector: o.sector,
            district: o.district,
            type: o.type,
            mode: o.mode,
            skills: o.skills,
            pay: `${rwf(o.payRwf)}/${o.payUnit}`,
            duration: o.duration,
            teamAllowed: o.teamAllowed,
          })),
        },
      });
      if (res.ok) setRecs(res.recs);
      else setError(res.error);
    } catch {
      setError("Couldn't get recommendations right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-page max-w-4xl py-10">
      <PageHeader
        eyebrow="AI-powered"
        title="Find my best opportunities"
        desc="Tell us what you can do, where you are and when you're free. We'll explain why each match fits."
      />
      <Card className="p-6">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Your skills (comma separated)
            <input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              maxLength={300}
              placeholder="Masonry, Carpentry"
              className={inp}
            />
          </label>
          <label className="text-sm">
            District
            <select value={district} onChange={(e) => setDistrict(e.target.value)} className={inp}>
              {DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Availability
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className={inp}
            >
              {[
                "Full-time, starting now",
                "Part-time / weekends",
                "Seasonal (a few weeks)",
                "From next month",
              ].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {loading ? "Finding matches…" : "Recommend opportunities"}
            </Button>
          </div>
        </form>
      </Card>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {recs &&
        (recs.length ? (
          <div className="mt-6 space-y-4">
            {recs.map((r) => {
              const o = allOpps.find((x) => x.id === r.id);
              if (!o) return null;
              return (
                <Card key={r.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        to="/opportunities/$id"
                        params={{ id: o.id }}
                        className="font-display text-lg font-bold hover:text-primary"
                      >
                        {o.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {o.district} · {rwf(o.payRwf)}/{o.payUnit} · {o.duration}
                      </p>
                    </div>
                    <Pill tone="success">{r.score}% fit</Pill>
                  </div>
                  <p className="mt-3 text-sm">
                    <span className="font-semibold">Why it fits: </span>
                    {r.fit}
                  </p>
                  {r.gaps && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-semibold">To consider: </span>
                      {r.gaps}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="mt-6 text-center text-muted-foreground">
            No strong matches right now. Try adding more skills.
          </p>
        ))}
      <DemoNotice className="mt-6" />
    </div>
  );
}
