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
  const { businesses, loading, error, refresh } = useCatalog();
  const { user } = useApp();

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Discover"
        title="Businesses"
        desc="Open a business to see its own profile, opportunities, work history and reputation. Owners can manage each business independently."
        actions={
          user ? (
            <Button asChild>
              <Link to="/register" search={{ create: "business" }}>
                + Add business
              </Link>
            </Button>
          ) : undefined
        }
      />
      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading businesses…</p>
      ) : error ? (
        <div className="rounded-2xl border p-6 text-center">
          <p className="font-semibold">Businesses could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection, then retry.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
            Retry businesses
          </Button>
        </div>
      ) : businesses.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No businesses have joined yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => {
            const canEdit = !!user?.businessIds.includes(b.id);
            return (
              <div key={b.id} className="min-w-0">
                <BusinessCard b={b} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/businesses/$id" params={{ id: b.id }}>
                      View business
                    </Link>
                  </Button>
                  {canEdit && (
                    <Button size="sm" variant="secondary" asChild>
                      <Link to="/businesses/$id/edit" params={{ id: b.id }}>
                        Edit business
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
