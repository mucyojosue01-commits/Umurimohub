import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep the legacy URL working while making the new Company directory canonical. */
export const Route = createFileRoute("/businesses")({
  beforeLoad: () => {
    throw redirect({ to: "/company/businesses", replace: true });
  },
});
