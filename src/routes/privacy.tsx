import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/features/ui/info-pages";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "Privacy Policy — UmurimoHub" },
    { name: "description", content: "Learn how UmurimoHub intends to handle personal information and what practices require confirmation before publication." },
    { property: "og:title", content: "Privacy Policy — UmurimoHub" },
    { property: "og:description", content: "Information about privacy, account data, visibility, and user choices." },
  ] }),
  component: () => <InfoPage page="privacy" />,
});
