import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/features/ui/info-pages";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "Terms of Service — UmurimoHub" },
    { name: "description", content: "Read the rules and responsibilities that guide use of UmurimoHub." },
    { property: "og:title", content: "Terms of Service — UmurimoHub" },
    { property: "og:description", content: "Platform terms and responsibilities for UmurimoHub users." },
  ] }),
  component: () => <InfoPage page="terms" />,
});
