import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep legacy Bizz profile URLs working while restoring the original business profiles. */
export const Route = createFileRoute("/bizz/$id")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/company/$id", params: { id: params.id }, replace: true }); },
});
