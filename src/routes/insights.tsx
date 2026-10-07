import { createFileRoute } from "@tanstack/react-router";
import { DemoNotice, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Economic insights — UmurimoHub" },
      {
        name: "description",
        content:
          "Skills demand, district activity and training needs, published only from verified data.",
      },
      { property: "og:title", content: "Economic insights — UmurimoHub" },
      {
        property: "og:description",
        content:
          "Skills demand, district activity and training needs, published only from verified data.",
      },
    ],
  }),
  component: () => (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="UmurimoHub"
        title="Economic insights"
        desc="Skills demand, district activity and training needs, published only from verified data."
      />
      <DemoNotice />
    </div>
  ),
});
