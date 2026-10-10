import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy directory URL: keep old bookmarks working and send traffic to Bizz. */
export const Route = createFileRoute("/company/businesses")({
  beforeLoad: () => { throw redirect({ to: "/bizz", replace: true }); },
});
