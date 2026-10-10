import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep legacy Bizz editor URLs working while the canonical editor uses /business/$id/edit. */
export const Route = createFileRoute("/bizz/$id/edit")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/business/$id/edit", params: { id: params.id }, replace: true }); },
});
