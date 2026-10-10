import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve legacy directory bookmarks and route to the original business directory. */
export const Route = createFileRoute("/businesses")({
  beforeLoad: () => { throw redirect({ to: "/company/businesses", replace: true }); },
});
