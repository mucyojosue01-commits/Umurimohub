import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DISTRICTS, SECTORS } from "@/features/data/demo";
import { useCatalog } from "@/features/data/catalog";
import { DemoNotice, PageHeader, WorkerCard } from "@/features/ui/kit";

export const Route = createFileRoute("/workers/")({
  head: () => ({ meta: [{ title: "Find trusted workers — UmurimoHub" }, { name: "description", content: "Verified workers across Rwanda with skills, track records and trust scores." }, { property: "og:title", content: "Trusted workers — UmurimoHub" }, { property: "og:description", content: "Search workers by skill, district, rate and verification." }] }),
  component: Page,
});
const sel = "h-10 rounded-full border bg-card px-3 text-sm";

function Page() {
  const [q, setQ] = useState(""); const [d, setD] = useState(""); const [s, setS] = useState(""); const [v, setV] = useState(false); const [a, setA] = useState(false);
  const { workers } = useCatalog();
  const list = workers.filter((w) => (!q || `${w.name} ${w.title} ${w.skills.map((x) => x.name).join(" ")}`.toLowerCase().includes(q.toLowerCase())) && (!d || w.district === d) && (!s || w.sector === s) && (!v || w.verified) && (!a || w.available));
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Discover" title="Workers" desc="People with verified skills and real track records." />
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <input aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or skill" className={`${sel} min-w-48 flex-1`} />
        <select aria-label="District" value={d} onChange={(e) => setD(e.target.value)} className={sel}><option value="">All districts</option>{DISTRICTS.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Sector" value={s} onChange={(e) => setS(e.target.value)} className={sel}><option value="">All sectors</option>{SECTORS.map((x) => <option key={x}>{x}</option>)}</select>
        <label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" checked={v} onChange={(e) => setV(e.target.checked)} />Verified</label>
        <label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} />Available</label>
      </div>
      <DemoNotice className="mt-4" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{list.map((w) => <WorkerCard key={w.id} w={w} />)}</div>
      {!list.length && <p className="mt-10 text-center text-muted-foreground">No workers match these filters.</p>}
    </div>
  );
}
