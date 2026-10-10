import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve the plural legacy URL and route it to the canonical business directory. */
export const Route = createFileRoute("/businesses")({
  beforeLoad: () => { throw redirect({ to: "/business", replace: true }); },
});
