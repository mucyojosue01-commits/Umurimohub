import { createFileRoute } from "@tanstack/react-router";
import { BusinessDirectoryPage } from "./business";

export const Route = createFileRoute("/bizz")({
  head: () => ({ meta: [{ title: "Business directory — UmurimoHub" }, { name: "description", content: "Find businesses, employers and cooperatives on UmurimoHub." }] }),
  component: BusinessDirectoryPage,
});
