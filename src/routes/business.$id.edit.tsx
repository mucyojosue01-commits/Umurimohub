import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve legacy company editor URLs while moving the canonical editor to /bizz/$id/edit. */
export const Route = createFileRoute("/business/$id/edit")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/bizz/$id/edit", params: { id: params.id }, replace: true }); },
});
