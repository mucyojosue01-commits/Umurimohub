import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy company editor URL now resolves to the canonical Bizz editor. */
export const Route = createFileRoute("/company/$id/edit")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/bizz/$id/edit", params: { id: params.id }, replace: true }); },
});
