import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve the old company directory URL while using /business as canonical. */
export const Route = createFileRoute("/company/businesses")({
  beforeLoad: () => { throw redirect({ to: "/business", replace: true }); },
});
