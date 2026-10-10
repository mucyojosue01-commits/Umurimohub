import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep legacy Bizz edit URLs working while restoring the original business editor. */
export const Route = createFileRoute("/bizz/$id/edit")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/company/$id/edit", params: { id: params.id }, replace: true }); },
});
