import { createFileRoute } from "@tanstack/react-router";
import { DemoNotice, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/agriculture")({
  head: () => ({ meta: [{ title: "Agriculture — UmurimoHub" }, { name: "description", content: "Seasonal work, cooperative supply offers and market demand." }, { property: "og:title", content: "Agriculture — UmurimoHub" }, { property: "og:description", content: "Seasonal work, cooperative supply offers and market demand." }] }),
  component: () => (
    <div className="container-page py-10">
      <PageHeader eyebrow="UmurimoHub" title="Agriculture" desc="Seasonal work, cooperative supply offers and market demand." />
      <DemoNotice />
    </div>
  ),
});
