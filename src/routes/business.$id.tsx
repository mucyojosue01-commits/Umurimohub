import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve legacy company profile URLs while moving the canonical profile to /bizz/$id. */
export const Route = createFileRoute("/business/$id")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/bizz/$id", params: { id: params.id }, replace: true }); },
});
