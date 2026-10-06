import { createFileRoute } from "@tanstack/react-router";
import { DemoNotice, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/training")({
  head: () => ({ meta: [{ title: "Skills & training — UmurimoHub" }, { name: "description", content: "Learn, practice, get assessed, get verified, then get work." }, { property: "og:title", content: "Skills & training — UmurimoHub" }, { property: "og:description", content: "Learn, practice, get assessed, get verified, then get work." }] }),
  component: () => (
    <div className="container-page py-10">
      <PageHeader eyebrow="UmurimoHub" title="Skills & training" desc="Learn, practice, get assessed, get verified, then get work." />
      <DemoNotice />
    </div>
  ),
});
