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
  if (!user?.leadTeamIds.includes(teamId)) return null;
  const candidates = workers.filter(
    (w) => workerUserIds[w.id] && !memberIds.includes(w.id) && w.id !== user.workerId,
  );
  return (
    <Card className="mt-6">
      <h2 className="font-bold">Invite a member</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        They'll see the invite on their dashboard and can accept or decline.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          aria-label="Worker"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="h-11 flex-1 rounded-xl border bg-card px-3"
        >
          <option value="">
            {candidates.length ? "Choose a worker…" : "No registered workers to invite yet"}
          </option>
          {candidates.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} — {w.title || w.sector}
            </option>
          ))}
        </select>
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
            }
          }}
        >
          Send invite
        </Button>
      </div>
    </Card>
  );
}
