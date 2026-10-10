import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve legacy business editor links. */
export const Route = createFileRoute("/businesses/$id/edit")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/company/$id/edit", params: { id: params.id }, replace: true }); },
});
