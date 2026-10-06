import { createFileRoute } from "@tanstack/react-router";
import { DemoNotice, PageHeader } from "@/features/ui/kit";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms & privacy — UmurimoHub" }, { name: "description", content: "How we protect your data and the rules for using UmurimoHub." }, { property: "og:title", content: "Terms & privacy — UmurimoHub" }, { property: "og:description", content: "How we protect your data and the rules for using UmurimoHub." }] }),
  component: () => (
    <div className="container-page py-10">
      <PageHeader eyebrow="UmurimoHub" title="Terms & privacy" desc="How we protect your data and the rules for using UmurimoHub." />
      <DemoNotice />
    </div>
  ),
});
