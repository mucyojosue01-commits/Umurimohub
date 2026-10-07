import { createFileRoute } from "@tanstack/react-router";
import { DemoNotice, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — UmurimoHub" },
      {
        name: "description",
        content:
          "Demand, opportunity, trusted teams, work, payment, verified experience, reputation, growth.",
      },
      { property: "og:title", content: "How it works — UmurimoHub" },
      {
        property: "og:description",
        content:
          "Demand, opportunity, trusted teams, work, payment, verified experience, reputation, growth.",
      },
    ],
  }),
  component: () => (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="UmurimoHub"
        title="How it works"
        desc="Demand, opportunity, trusted teams, work, payment, verified experience, reputation, growth."
      />
      <DemoNotice />
    </div>
  ),
});
