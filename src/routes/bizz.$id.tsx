import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep legacy Bizz profile URLs working while the canonical profile uses /business/$id. */
export const Route = createFileRoute("/bizz/$id")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/business/$id", params: { id: params.id }, replace: true }); },
});
