import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep legacy Bizz directory URLs working while restoring the original business directory. */
export const Route = createFileRoute("/bizz")({
  beforeLoad: () => { throw redirect({ to: "/company/businesses", replace: true }); },
});
