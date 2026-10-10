import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { BusinessCard, PageHeader } from "@/features/ui/kit";

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
  const { user } = useApp();
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Discover"
        title="Businesses"
        desc="Verified employers, cooperatives and MSMEs."
        actions={user ? <Button asChild><Link to="/register" search={{ create: "business" }}>+ Add business</Link></Button> : undefined}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{businesses.length === 0 && <p className="col-span-full py-12 text-center text-sm text-muted-foreground">No businesses have joined yet.</p>}
        {businesses.map((b) => (
          <div key={b.id} className="min-w-0">
            <BusinessCard b={b} />
          </div>
        ))}
      </div>
    </div>
  );
}
