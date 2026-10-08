import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCatalog } from "@/features/data/catalog";
import { useApp } from "@/features/store/app-store";
import { Card } from "@/features/ui/kit";

/** Visible only to the team lead: invite a worker with a real account. */
export function TeamInvite({ teamId, memberIds }: { teamId: string; memberIds: string[] }) {
  const { user } = useApp();
  const { workers, workerUserIds } = useCatalog();
  const [pick, setPick] = useState("");
  const [query, setQuery] = useState("");
  if (!user?.leadTeamIds.includes(teamId)) return null;
  const candidates = workers.filter((w) => workerUserIds[w.id] && !memberIds.includes(w.id) && w.id !== user.workerId);
  const matches = candidates.filter((w) => (w.name + " " + w.title + " " + w.sector).toLowerCase().includes(query.toLowerCase())).slice(0, 20);
  return (
    <Card className="mt-6">
      <h2 className="font-bold">Invite a member</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        They'll see the invite on their dashboard and can accept or decline.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input aria-label="Search worker" value={query} onChange={(e) => { setQuery(e.target.value); const exact = candidates.find((w) => w.name.toLowerCase() === e.target.value.toLowerCase()); setPick(exact?.id ?? ""); }} placeholder={candidates.length ? "Search a worker by name or skill…" : "No registered workers to invite yet"} className="h-11 w-full rounded-xl border bg-card px-3" />
          {query && !pick && matches.length > 0 && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-card p-1 shadow-lg">{matches.map((w) => <button type="button" key={w.id} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setQuery(w.name); setPick(w.id); }}>{w.name} · {w.title || w.sector}</button>)}</div>}
        </div>
        <Button
          disabled={!pick}
          onClick={async () => {
            const { error } = await supabase
              .from("team_members")
              .insert({ team_id: teamId, worker_id: pick, role: "member", status: "invited" });
            if (error) toast.error(error.code === "23505" ? "Already invited." : error.message);
            else {
              toast.success("Invite sent");
              setPick("");
              setQuery("");
            }
          }}
        >
          Send invite
        </Button>
      </div>
    </Card>
  );
}
