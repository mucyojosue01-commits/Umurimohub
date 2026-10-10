import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve old company profile links and route them to the working business profile. */
export const Route = createFileRoute("/company/$id")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/business/$id", params: { id: params.id }, replace: true }); },
});
