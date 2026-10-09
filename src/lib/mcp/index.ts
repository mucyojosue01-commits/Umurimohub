import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchOpportunities from "./tools/search-opportunities";
import myApplications from "./tools/my-applications";
import myNotifications from "./tools/my-notifications";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "umurimohub-connect",
  title: "UmurimoHub Connect",
  version: "0.1.0",
  instructions:
    "Tools for UmurimoHub, a Rwanda work-opportunity platform. Search open opportunities, and read the signed-in user's applications and notifications. Pay is in RWF.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchOpportunities, myApplications, myNotifications],
});
