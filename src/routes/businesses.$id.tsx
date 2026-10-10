import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep legacy business profile links working with the canonical Bizz profile. */
export const Route = createFileRoute("/businesses/$id")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/bizz/$id", params: { id: params.id }, replace: true }); },
});
