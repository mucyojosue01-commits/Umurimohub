import { createFileRoute } from "@tanstack/react-router";
import { DemoNotice, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Join UmurimoHub — UmurimoHub" }, { name: "description", content: "Create your free account and choose your role." }, { property: "og:title", content: "Join UmurimoHub — UmurimoHub" }, { property: "og:description", content: "Create your free account and choose your role." }] }),
  component: () => (
    <div className="container-page py-10">
      <PageHeader eyebrow="UmurimoHub" title="Join UmurimoHub" desc="Create your free account and choose your role." />
      <DemoNotice />
    </div>
  ),
});
