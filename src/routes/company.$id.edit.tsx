import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve old company editor links and route them to the working business editor. */
export const Route = createFileRoute("/company/$id/edit")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/business/$id/edit", params: { id: params.id }, replace: true }); },
});
