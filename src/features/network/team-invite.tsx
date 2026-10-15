import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchSelect, type SearchSelectOption } from "@/components/search-select";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/store/app-store";
import { Card } from "@/features/ui/kit";

/** Visible only to the team lead: invite a worker with a real account. */
export function TeamInvite({ teamId, memberIds }: { teamId: string; memberIds: string[] }) {
  const { user } = useApp();
  const [pick, setPick] = useState("");
  const [searchText, setSearchText] = useState("");
  const [candidateOptions, setCandidateOptions] = useState<SearchSelectOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Do not query the user directory until the person has typed a meaningful search.
    const query = searchText.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
    if (query.length < 2) {
      setCandidateOptions([]);
      setSearching(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase
        .from("worker_profiles")
        .select("id,user_id,name,initials,title,sector,district,avatar_url")
        .eq("is_demo", false)
        .not("user_id", "is", null)
        .or(`name.ilike.%${query}%,title.ilike.%${query}%,sector.ilike.%${query}%,district.ilike.%${query}%`)
        .order("name", { ascending: true })
        .limit(20);

      if (!active) return;
      if (error) {
        setCandidateOptions([]);
        toast.error("Could not search members: " + error.message);
      } else {
        setCandidateOptions(
          (data ?? [])
            .filter((worker) => !!worker.user_id && !memberIds.includes(worker.id) && worker.id !== user?.workerId)
            .map((worker) => ({
              value: worker.id,
              label: worker.name,
              description: [worker.title, worker.sector, worker.district].filter(Boolean).join(" · "),
              avatarUrl: worker.avatar_url,
              initials: worker.initials || worker.name.slice(0, 2).toUpperCase(),
            })),
        );
      }
      setSearching(false);
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchText, memberIds, user?.workerId]);

  if (!user?.leadTeamIds.includes(teamId)) return null;

  const emptyText = searching
    ? "Searching users…"
    : searchText.trim().length < 2
      ? "Start typing to see users"
      : "No matching users found";

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
            onQueryChange={setSearchText}
            options={candidateOptions}
            placeholder="Start typing to find a member…"
            emptyText={emptyText}
            requireQuery
            disabled={sending}
          />
        </div>
        <Button
          disabled={!pick || sending}
          onClick={async () => {
            setSending(true);
            try {
              const { error } = await supabase
                .from("team_members")
                .insert({ team_id: teamId, worker_id: pick, role: "member", status: "invited" });
              if (error) {
                toast.error(error.code === "23505" ? "Already invited." : error.message);
              } else {
                toast.success("Invite sent");
                setPick("");
                setSearchText("");
                setCandidateOptions([]);
              }
            } finally {
              setSending(false);
            }
          }}
        >
          {sending ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </Card>
  );
}
