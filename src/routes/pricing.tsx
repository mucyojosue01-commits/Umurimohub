import { createFileRoute } from "@tanstack/react-router";
import { DemoNotice, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans for business — UmurimoHub" },
      {
        name: "description",
        content: "Free for workers. Paid hiring and project tools for businesses and institutions.",
      },
      { property: "og:title", content: "Plans for business — UmurimoHub" },
      {
        property: "og:description",
        content: "Free for workers. Paid hiring and project tools for businesses and institutions.",
      },
    ],
  }),
  component: () => (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="UmurimoHub"
        title="Plans for business"
        desc="Free for workers. Paid hiring and project tools for businesses and institutions."
      />
      <DemoNotice />
    </div>
  ),
});
