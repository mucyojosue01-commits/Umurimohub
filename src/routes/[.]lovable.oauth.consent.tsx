import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/features/ui/kit";

type Res = { data: Record<string, unknown> | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<Res>;
  approveAuthorization: (id: string) => Promise<Res>;
  denyAuthorization: (id: string) => Promise<Res>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
const target = (d: Record<string, unknown> | null) =>
  (d?.["redirect_url"] as string | undefined) ?? (d?.["redirect_to"] as string | undefined);

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({ meta: [{ title: "Authorize access — UmurimoHub" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = target(data);
    if (immediate && !data?.["client"]) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="container-page max-w-md py-16">
      <Card className="p-6">Could not load this authorization request: {error.message}</Card>
    </div>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = ((details?.["client"] as { name?: string } | undefined)?.name) ?? "An app";

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    const t = target(data);
    if (error || !t) {
      setBusy(false);
      setError(error?.message ?? "No redirect returned.");
      return;
    }
    window.location.href = t;
  }

  return (
    <div className="container-page max-w-md py-16">
      <Card className="p-6">
        <h1 className="text-2xl font-extrabold">Connect {name} to your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {name} will be able to search opportunities and read your applications and notifications on UmurimoHub as you.
        </p>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex gap-3">
          <Button disabled={busy} onClick={() => void decide(true)}>Approve</Button>
          <Button variant="outline" disabled={busy} onClick={() => void decide(false)}>Deny</Button>
        </div>
      </Card>
    </div>
  );
}
