import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep old directory bookmarks working while routing directly to Bizz. */
export const Route = createFileRoute("/businesses")({
  beforeLoad: () => { throw redirect({ to: "/bizz", replace: true }); },
});
