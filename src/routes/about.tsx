import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/features/ui/info-pages";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About UmurimoHub — Skills into meaningful work" },
      { name: "description", content: "Learn how UmurimoHub aims to connect people, teams, businesses, and productive opportunities across Rwanda." },
      { property: "og:title", content: "About UmurimoHub" },
      { property: "og:description", content: "A Rwanda-focused economic opportunity platform connecting skills, trusted relationships, and productive work." },
    ],
  }),
  component: () => <InfoPage page="about" />,
});
