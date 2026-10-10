import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve legacy business profile links. */
export const Route = createFileRoute("/businesses/$id")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/company/$id", params: { id: params.id }, replace: true }); },
});
