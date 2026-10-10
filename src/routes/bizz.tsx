import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep legacy Bizz directory URLs working while the canonical directory uses /business. */
export const Route = createFileRoute("/bizz")({
  beforeLoad: () => { throw redirect({ to: "/business", replace: true }); },
});
