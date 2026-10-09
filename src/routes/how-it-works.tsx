import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/features/ui/info-pages";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({ meta: [
    { title: "How UmurimoHub Works" },
    { name: "description", content: "Learn how profiles, opportunities, applications, work agreements, and professional experience fit together on UmurimoHub." },
    { property: "og:title", content: "How UmurimoHub Works" },
    { property: "og:description", content: "A practical guide for workers, businesses, teams, and learners." },
  ] }),
  component: () => <InfoPage page="how" />,
});
