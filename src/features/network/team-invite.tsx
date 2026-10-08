import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/search-select";
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
  const candidates = workers.filter((w) => workerUserIds[w.id] && !memberIds.includes(w.id) && w.id !== user.workerId);
  return (
    <Card className="mt-6">
      <h2 className="font-bold">Invite a member</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        They'll see the invite on their dashboard and can accept or decline.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <SearchSelect
            value={pick}
            onChange={setPick}
            options={candidates.map((w) => ({ value: w.id, label: w.name, description: w.title + " · " + w.sector, avatarUrl: w.avatarUrl, initials: w.initials }))}
            placeholder={candidates.length ? "Search a worker by name or skill…" : "No registered workers to invite yet"}
          />
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

            }
          }}
        >
          Send invite
        </Button>
      </div>
    </Card>
  );
}
