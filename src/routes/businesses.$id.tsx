import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve old profile URLs while routing users to the canonical Company profile. */
export const Route = createFileRoute("/businesses/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/company/$id", params: { id: params.id }, replace: true });
  },
});
