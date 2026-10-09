import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { rwf } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { Card, Pill } from "@/features/ui/kit";
import type { Contract } from "@/features/contracts/service";
import {
  completionReadiness,
  confirmCompletion,
  completionsKey,
  evidenceSummary,
  listMyCompletions,
  listMyCompletionEvents,
  listReputationEvidence,
  listVerifiedExperiences,
  rejectCompletion,
  reputationEvidenceKey,
  requestCompletion,
  verifiedExperienceKey,
  withdrawCompletionRequest,
  type Completion,
  type VerifiedExperience,
} from "./service";
import { listMyMilestones, milestonesKey, type Milestone } from "@/features/milestones/service";

const statusTone = (status: Completion["status"]) =>
  (status === "confirmed" ? "success" : status === "requested" ? "primary" : "warning") as
    "success" | "primary" | "warning";

function CompletionHistory({ completionId }: { completionId: string }) {
  const q = useQuery({
    queryKey: ["completion-events", completionId],
    queryFn: () => listMyCompletionEvents(completionId),
  });

  if (q.isLoading) return <p className="mt-2 text-xs text-muted-foreground">Loading history…</p>;
  if (q.isError)
    return <p className="mt-2 text-xs text-destructive">Couldn’t load completion history.</p>;
  if (!q.data?.length)
    return <p className="mt-2 text-xs text-muted-foreground">No completion events yet.</p>;

  return (
    <ol className="mt-2 space-y-2 border-l pl-3 text-xs text-muted-foreground">
      {q.data.map((event) => (
        <li key={event.id}>
          <span className="font-medium text-foreground">{event.event_type}</span>
          {event.note ? " — " + event.note : ""}
          <span className="ml-1">{new Date(event.at).toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

function CompletionCard({
  contract,
  completion,
  milestones,
  sessionUserId,
}: {
  contract: Contract;
  completion?: Completion | undefined;
  milestones: Milestone[];
  sessionUserId: string;
}) {
  const qc = useQueryClient();
  const { user } = useApp();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState(false);

  const isBusiness = user?.businessIds.includes(contract.business_id) ?? false;
  const isRecipient = Boolean(
    (contract.worker_id && contract.worker_id === user?.workerId) ||
    (contract.team_id && user?.leadTeamIds.includes(contract.team_id)),
  );

  const readiness = completionReadiness(contract.status, milestones);
  const pending = completion?.status === "requested";
  const requestedByMe = completion?.requested_by === sessionUserId;
  const canRequest = readiness.eligible && (!completion || completion.status === "rejected");
  const canRespond = pending && !requestedByMe && (isBusiness || isRecipient);

  const act = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await Promise.all([
        qc.invalidateQueries({ queryKey: completionsKey }),
        qc.invalidateQueries({ queryKey: verifiedExperienceKey }),
        qc.invalidateQueries({ queryKey: reputationEvidenceKey }),
        qc.invalidateQueries({ queryKey: milestonesKey }),
      ]);
      setNote("");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!isBusiness && !isRecipient) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{contract.title}</h3>
          <p className="text-sm text-muted-foreground">
            {rwf(contract.amount_rwf)} · {contract.status}
          </p>
        </div>
        {completion && <Pill tone={statusTone(completion.status)}>{completion.status}</Pill>}
      </div>

      <div className="mt-3 rounded-xl bg-muted/30 p-3 text-sm">
        <p className="font-medium">Completion readiness</p>
        {milestones.length ? (
          <p className="mt-1 text-muted-foreground">
            {milestones.filter((m) => m.status === "approved").length}/{milestones.length}{" "}
            milestones approved.
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">
            No milestones — completion requires approval by the other contract party.
          </p>
        )}
        {!readiness.eligible && <p className="mt-1 text-destructive">{readiness.reason}</p>}
      </div>

      {completion?.rejection_note && (
        <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <span className="font-medium">Rejection:</span> {completion.rejection_note}
        </p>
      )}

      {pending && (
        <p className="mt-3 text-sm text-muted-foreground">
          {requestedByMe
            ? "Your completion request is waiting for the counterparty."
            : "The counterparty has requested completion confirmation."}
        </p>
      )}

      {completion?.status === "confirmed" && (
        <p className="mt-3 text-sm text-emerald-700">
          Completed{" "}
          {completion.completed_at ? new Date(completion.completed_at).toLocaleDateString() : ""}.
          Verified work history has been created.
        </p>
      )}

      {(canRequest || canRespond || (pending && requestedByMe)) && (
        <div className="mt-3 space-y-2">
          <Textarea
            placeholder="Optional completion note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
          />
          <div className="flex flex-wrap gap-2">
            {canRequest && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  act(() => requestCompletion(contract.id, note), "Completion request sent")
                }
              >
                Complete project
              </Button>
            )}
            {pending && requestedByMe && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  act(
                    () => withdrawCompletionRequest(contract.id, note),
                    "Completion request withdrawn",
                  )
                }
              >
                Withdraw request
              </Button>
            )}
            {canRespond && (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    act(() => confirmCompletion(contract.id, note), "Contract completed")
                  }
                >
                  Approve & complete contract
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    act(() => rejectCompletion(contract.id, note), "Completion request rejected")
                  }
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {completion && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          onClick={() => setHistory((value) => !value)}
        >
          {history ? "Hide history" : "View history"}
        </Button>
      )}

      {history && completion && <CompletionHistory completionId={completion.id} />}
    </Card>
  );
}

function VerifiedWorkHistory({ experiences }: { experiences: VerifiedExperience[] }) {
  const q = useQuery({
    queryKey: reputationEvidenceKey,
    queryFn: listReputationEvidence,
  });

  const summary = useMemo(() => evidenceSummary(q.data ?? []), [q.data]);

  if (q.isLoading) {
    return (
      <Card>
        <h2 className="font-bold">Verified work history</h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading evidence…</p>
      </Card>
    );
  }

  if (q.isError) {
    return (
      <Card>
        <h2 className="font-bold">Verified work history</h2>
        <p className="mt-2 text-sm text-destructive">Couldn’t load reputation evidence.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Verified work history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Evidence from completed UmurimoHub contracts — not a composite score.
          </p>
        </div>
        <Pill tone="success">{summary.verifiedProjects} verified projects</Pill>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border p-3">
          <p className="text-lg font-bold">{summary.onTimeCompletions}</p>
          <p className="text-xs text-muted-foreground">On-time completions</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-lg font-bold">{summary.verifiedMilestones}</p>
          <p className="text-xs text-muted-foreground">Verified milestones</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-lg font-bold">{summary.repeatEmployers}</p>
          <p className="text-xs text-muted-foreground">Repeat employers</p>
        </div>
      </div>

      {!experiences.length ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No verified work history yet. It will appear after a contract is confirmed complete.
        </p>
      ) : (
        <ul className="mt-4 divide-y">
          {experiences.map((experience) => (
            <li key={experience.id} className="py-3">
              <p className="font-medium">{experience.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{experience.scope}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Completed {new Date(experience.completed_at).toLocaleDateString()} ·{" "}
                {rwf(experience.amount_rwf)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CompletionPanel({ contracts }: { contracts: Contract[] }) {
  const { session, user } = useApp();
  const completionsQuery = useQuery({
    queryKey: completionsKey,
    enabled: !!session,
    queryFn: listMyCompletions,
  });
  const milestonesQuery = useQuery({
    queryKey: milestonesKey,
    enabled: !!session,
    queryFn: listMyMilestones,
  });
  const experiencesQuery = useQuery({
    queryKey: verifiedExperienceKey,
    enabled: !!session,
    queryFn: listVerifiedExperiences,
  });

  if (!user || !session) return null;
  if (completionsQuery.isLoading || milestonesQuery.isLoading || experiencesQuery.isLoading) {
    return (
      <div className="mt-6 space-y-4">
        <Card>
          <p className="text-sm text-muted-foreground">Loading completion workflow…</p>
        </Card>
      </div>
    );
  }
  if (completionsQuery.isError || milestonesQuery.isError || experiencesQuery.isError) {
    return (
      <div className="mt-6 space-y-4">
        <Card>
          <div className="flex items-center gap-2 text-sm text-destructive"><span>Could not load completion workflow. Please try again.</span><Button size="sm" variant="outline" onClick={() => { void completionsQuery.refetch(); void milestonesQuery.refetch(); void experiencesQuery.refetch(); }}>Retry</Button></div>
        </Card>
      </div>
    );
  }

  const completionByContract = new Map(
    (completionsQuery.data ?? []).map((item) => [item.contract_id, item]),
  );
  const milestonesByContract = new Map<string, Milestone[]>();
  for (const milestone of milestonesQuery.data ?? []) {
    milestonesByContract.set(milestone.contract_id, [
      ...(milestonesByContract.get(milestone.contract_id) ?? []),
      milestone,
    ]);
  }

  const visibleContracts = contracts.filter((contract) => {
    const isBusiness = user.businessIds.includes(contract.business_id);
    const isRecipient =
      (contract.worker_id && contract.worker_id === user.workerId) ||
      (contract.team_id && user.leadTeamIds.includes(contract.team_id));
    return isBusiness || isRecipient;
  });

  return (
    <div className="mt-6 space-y-4">
      {visibleContracts.length ? (
        <>
          <div>
            <h2 className="text-xl font-bold">Completion & verified experience</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Finish the work record only after both contracting sides confirm it.
            </p>
          </div>
          {visibleContracts.map((contract) => (
            <CompletionCard
              key={contract.id}
              contract={contract}
              completion={completionByContract.get(contract.id)}
              milestones={milestonesByContract.get(contract.id) ?? []}
              sessionUserId={session.user.id}
            />
          ))}
        </>
      ) : null}

      <VerifiedWorkHistory experiences={experiencesQuery.data ?? []} />
    </div>
  );
}
