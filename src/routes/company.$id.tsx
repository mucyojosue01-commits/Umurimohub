import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy company profile URL now resolves to the canonical Bizz profile. */
export const Route = createFileRoute("/company/$id")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/bizz/$id", params: { id: params.id }, replace: true }); },
});
