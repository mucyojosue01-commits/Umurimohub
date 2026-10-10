import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve old edit URLs while routing users to the canonical Company editor. */
export const Route = createFileRoute("/businesses/$id/edit")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/company/$id/edit", params: { id: params.id }, replace: true });
  },
});
