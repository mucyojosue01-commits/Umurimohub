import { createFileRoute } from "@tanstack/react-router";
import { DemoNotice, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — UmurimoHub" },
      {
        name: "description",
        content: "A Rwanda-focused platform turning demand into trusted, verified work.",
      },
      { property: "og:title", content: "About — UmurimoHub" },
      {
        property: "og:description",
        content: "A Rwanda-focused platform turning demand into trusted, verified work.",
      },
    ],
  }),
  component: () => (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="UmurimoHub"
        title="About"
        desc="A Rwanda-focused platform turning demand into trusted, verified work."
      />
      <DemoNotice />
    </div>
  ),
});
