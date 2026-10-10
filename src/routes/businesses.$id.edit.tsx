import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep legacy edit links working with the canonical Bizz editor. */
export const Route = createFileRoute("/businesses/$id/edit")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/bizz/$id/edit", params: { id: params.id }, replace: true }); },
});
