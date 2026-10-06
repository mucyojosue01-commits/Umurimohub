import { createFileRoute } from "@tanstack/react-router";
import { BUSINESSES } from "@/features/data/demo";
import { BusinessCard, DemoNotice, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/businesses")({
  head: () => ({ meta: [{ title: "Businesses hiring in Rwanda — UmurimoHub" }, { name: "description", content: "Verified businesses, cooperatives and MSMEs creating work." }, { property: "og:title", content: "Businesses — UmurimoHub" }, { property: "og:description", content: "Verified employers and their hiring activity." }] }),
  component: () => (
    <div className="container-page py-10">
      <PageHeader eyebrow="Discover" title="Businesses" desc="Verified employers, cooperatives and MSMEs." />
      <DemoNotice />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{BUSINESSES.map((b) => <BusinessCard key={b.id} b={b} />)}</div>
    </div>
  ),
});
