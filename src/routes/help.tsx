import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/features/ui/info-pages";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [
    { title: "Help Centre — UmurimoHub" },
    { name: "description", content: "Search practical answers about UmurimoHub accounts, opportunities, referrals, training, work agreements, and privacy." },
    { property: "og:title", content: "Help Centre — UmurimoHub" },
    { property: "og:description", content: "Practical guidance for using UmurimoHub." },
  ] }),
  component: () => <InfoPage page="help" />,
});
