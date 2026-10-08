import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/store/app-store";
import { Avatar, Card, PageHeader, Pill } from "@/features/ui/kit";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "My trusted network — UmurimoHub" },
      {
        name: "description",
        content: "Connections, referrals and recommendations from people you've worked with.",
      },
      { property: "og:title", content: "Trusted network — UmurimoHub" },
      { property: "og:description", content: "Your connections and referrals." },
    ],
  }),
  component: Page,
});

function Page() {
  const { session, authReady } = useApp();
  const qc = useQueryClient();
  const me = session?.user.id;
  const q = useQuery({
    queryKey: ["network", me],
    enabled: !!me,
    queryFn: async () => {
      const [c, r, p, workers] = await Promise.all([
        supabase.from("connections").select("*").order("created_at", { ascending: false }),
        supabase.from("referrals").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,display_name,avatar_url"),
        supabase.from("worker_profiles").select("id,user_id,name,avatar_url"),
      ]);
      return { connections: c.data ?? [], referrals: r.data ?? [], profiles: p.data ?? [], workers: workers.data ?? [] };
    },
  });
  if (!authReady)
    return <div className="container-page py-20 text-center text-muted-foreground">Loading…</div>;
  if (!me)
    return (
      <div className="container-page py-20 text-center">
        <p>Sign in to see your trusted network.</p>
        <Button className="mt-4" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  const respond = async (id: string, status: "accepted" | "blocked") => {
    const { error } = await supabase.from("connections").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "accepted" ? "Connected" : "Declined");
      void qc.invalidateQueries({ queryKey: ["network"] });
    }
  };
  const respondReferral = async (id: string, accept: boolean) => {
    const { error } = await supabase.rpc("respond_referral", { _referral_id: id, _accept: accept });
    if (error) toast.error(error.message);
    else {
      toast.success(accept ? "Referral accepted — your application was submitted" : "Referral declined");
      void qc.invalidateQueries({ queryKey: ["network"] });
    }
  };

  const cons = q.data?.connections ?? [];
  const profileMap = new Map((q.data?.profiles ?? []).map((p) => [p.id, p]));
  const workerMap = new Map((q.data?.workers ?? []).map((w) => [w.user_id, w]));
  return (
    <div className="container-page max-w-3xl py-10">
      <PageHeader
        eyebrow="Trust"
        title="My trusted network"
        desc="Connect with people you've worked with. Connections unlock recommendations and referrals."
      />
      <Card>
        <h2 className="font-bold">Connections</h2>
        {!cons.length ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No connections yet. Open a{" "}
            <Link to="/workers" className="text-primary">
              worker profile
            </Link>{" "}
            and tap Connect.
          </p>
        ) : (
          <ul className="mt-3 divide-y">
            {cons.map((connection) => {
              const otherId = connection.requester === me ? connection.addressee : connection.requester;
              const otherProfile = profileMap.get(otherId);
              const otherWorker = workerMap.get(otherId);
              return (
                <li key={connection.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="flex min-w-0 items-center gap-3 text-sm">
                    <Avatar
                      initials={(otherProfile?.display_name ?? "U").slice(0, 2).toUpperCase()}
                      src={otherProfile?.avatar_url}
                      alt={otherProfile?.display_name ?? "Member"}
                      size="md"
                    />
                    <div className="min-w-0">
                      {otherWorker ? (
                        <Link
                          to="/workers/$id"
                          params={{ id: otherWorker.id }}
                          className="font-medium hover:text-primary"
                        >
                          {otherProfile?.display_name ?? "Member"}
                        </Link>
                      ) : (
                        <span className="font-medium">{otherProfile?.display_name ?? "Member"}</span>
                      )}
                      <p className="text-xs text-muted-foreground">{connection.relation.replace("_", " ")}</p>
                    </div>
                  </div>
                  <span className="flex gap-2">
                    <Pill tone={connection.status === "accepted" ? "success" : "muted"}>
                      {connection.status}
                    </Pill>
                    {(connection.addressee === me || connection.requester === me) && (
                      <>
                        <Button size="sm" onClick={() => respond(connection.id, "accepted")}>
                          Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => respond(connection.id, "blocked")}>
                          Block
                        </Button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card className="mt-6">
        <h2 className="font-bold">Referrals</h2>
        {!q.data?.referrals.length ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Refer someone from any opportunity page.
          </p>
        ) : (
          <ul className="mt-3 divide-y">
            {q.data.referrals.map((r) => {
              const referee = (q.data?.workers ?? []).find((w) => w.id === r.referee_worker_id);
              const referrer = (q.data?.workers ?? []).find((w) => w.user_id === r.referrer);
              const referrerProfile = profileMap.get(r.referrer);
              const isRecipient = referee?.user_id === me;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar initials={(referee?.name ?? "Applicant").slice(0,2).toUpperCase()} src={referee?.avatar_url} alt={referee?.name ?? "Applicant"} size="md" />
                    <div>
                      <Link to="/opportunities/$id" params={{ id: r.opportunity_id }} className="font-medium hover:text-primary">Referral for opportunity</Link>
                      <p className="text-xs text-muted-foreground">
                        {r.referrer === me ? "You referred " + (referee?.name ?? "someone") : "Referred by " + (referrer?.name ?? referrerProfile?.display_name ?? "a trusted member")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={r.status === "accepted" ? "success" : r.status === "pending" ? "primary" : "muted"}>{r.status}</Pill>
                    {isRecipient && r.status === "pending" && <>
                      <Button size="sm" onClick={() => void respondReferral(r.id, true)}>Approve & apply</Button>
                      <Button size="sm" variant="outline" onClick={() => void respondReferral(r.id, false)}>Decline</Button>
                    </>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
