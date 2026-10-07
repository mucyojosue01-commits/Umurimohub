import { createFileRoute } from "@tanstack/react-router";
import { useCatalog } from "@/features/data/catalog";
import { BusinessCard, DemoNotice, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/businesses")({
  head: () => ({
    meta: [
      { title: "Businesses hiring in Rwanda — UmurimoHub" },
      {
        name: "description",
        content: "Verified businesses, cooperatives and MSMEs creating work.",
      },
      { property: "og:title", content: "Businesses — UmurimoHub" },
      { property: "og:description", content: "Verified employers and their hiring activity." },
    ],
  }),
  component: Page,
});

function Page() {
  const { businesses } = useCatalog();
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Discover"
        title="Businesses"
        desc="Verified employers, cooperatives and MSMEs."
      />
      <DemoNotice />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {businesses.map((b) => (
          <BusinessCard key={b.id} b={b} />
        ))}
      </div>
    </div>
  );
}
