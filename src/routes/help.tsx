import { createFileRoute } from "@tanstack/react-router";
import { DemoNotice, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help centre — UmurimoHub" }, { name: "description", content: "Answers on profiles, applications, teams, payments and verification." }, { property: "og:title", content: "Help centre — UmurimoHub" }, { property: "og:description", content: "Answers on profiles, applications, teams, payments and verification." }] }),
  component: () => (
    <div className="container-page py-10">
      <PageHeader eyebrow="UmurimoHub" title="Help centre" desc="Answers on profiles, applications, teams, payments and verification." />
      <DemoNotice />
    </div>
  ),
});
