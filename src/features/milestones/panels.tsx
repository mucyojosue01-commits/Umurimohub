import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rwf } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, Pill } from "@/features/ui/kit";
import type { Contract } from "@/features/contracts/service";
import {
  approveMilestone,
  createMilestone,
  deletePendingMilestone,
  disputeMilestone,
  listMilestoneEvents,
  listMyMilestones,
  milestoneEventsKey,
  milestonesKey,
  submitMilestone,
  updatePendingMilestone,
  validateMilestone,
  type Milestone,
  type MilestoneEvent,
} from "./service";

const tone = (status: Milestone["status"]) =>
  (status === "approved"
    ? "success"
    : status === "submitted"
      ? "primary"
      : status === "disputed"
        ? "warning"
        : "muted") as "success" | "primary" | "warning" | "muted";

function MilestoneForm({
  contractId,
  initial,
  nextSequence,
  remaining,
  onDone,
}: {
  contractId: string;
  initial?: Milestone;
  nextSequence: number;
  remaining: number;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    sequence: String(initial?.sequence ?? nextSequence),
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    amount: initial ? String(initial.amount_rwf) : "",
    dueDate: initial?.due_date ?? "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const input = {
      contractId,
      sequence: Number(form.sequence),
      title: form.title,
      description: form.description,
      amountRwf: Number(form.amount),
      dueDate: form.dueDate,
    };
    const error = validateMilestone(input);
    if (error) { toast.error(error); return; }
    if (!initial && input.amountRwf > remaining) {
      { toast.error("This exceeds the remaining contract allocation."); return; }
    }

    setBusy(true);
    try {
      if (initial) {
        await updatePendingMilestone(initial.id, input);
        toast.success("Milestone updated");
      } else {
        await createMilestone(input);
        setForm({
          sequence: String(nextSequence + 1),
          title: "",
          description: "",
          amount: "",
          dueDate: "",
        });
        toast.success("Milestone created");
      }
      void qc.invalidateQueries({ queryKey: milestonesKey });
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 grid gap-2 rounded-2xl border bg-muted/30 p-4">
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          min={1}
          step={1}
          aria-label="Milestone sequence"
          value={form.sequence}
          onChange={(e) => setForm({ ...form, sequence: e.target.value })}
          placeholder="Order"
        />
        <Input
          type="number"
          min={1}
          step={1}
          aria-label="Milestone amount in RWF"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          placeholder="Amount (RWF)"
        />
      </div>
      <Input
        placeholder="Milestone title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <Textarea
        placeholder="Define the deliverable"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <Input
        type="date"
        aria-label="Milestone due date"
        value={form.dueDate}
        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
      />
      {!initial && (
        <p className="text-xs text-muted-foreground">
          {remaining > 0 ? "Remaining: " + rwf(remaining) : "No remaining contract allocation."}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || (!initial && remaining <= 0)} onClick={save}>
          {busy ? "Saving…" : initial ? "Save milestone" : "Add milestone"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function MilestoneHistory({ id }: { id: string }) {
  const q = useQuery({
    queryKey: milestoneEventsKey(id),
    queryFn: () => listMilestoneEvents(id),
  });

  if (q.isLoading) return <p className="mt-2 text-xs text-muted-foreground">Loading history…</p>;
  if (q.isError) return <p className="mt-2 text-xs text-destructive">Couldn't load history.</p>;
  if (!q.data?.length) return <p className="mt-2 text-xs text-muted-foreground">No history yet.</p>;

  return (
    <ol className="mt-2 space-y-2 border-l pl-3 text-xs text-muted-foreground">
      {q.data.map((event: MilestoneEvent) => (
        <li key={event.id}>
          <span className="font-medium text-foreground">{event.event_type}</span>
          {event.note ? " — " + event.note : ""}
          <span className="ml-1">{new Date(event.at).toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

function MilestoneCard({
  milestone,
  isBusiness,
  isRecipient,
}: {
  milestone: Milestone;
  isBusiness: boolean;
  isRecipient: boolean;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [submissionNote, setSubmissionNote] = useState("");
  const [disputeNote, setDisputeNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(false);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      void qc.invalidateQueries({ queryKey: milestonesKey });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <li className="py-3">
        <MilestoneForm
          contractId={milestone.contract_id}
          initial={milestone}
          nextSequence={milestone.sequence}
          remaining={milestone.amount_rwf}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {milestone.sequence}. {milestone.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{milestone.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {rwf(milestone.amount_rwf)} · Due {milestone.due_date}
          </p>
        </div>
        <Pill tone={tone(milestone.status)}>{milestone.status}</Pill>
      </div>

      {milestone.submission_note && (
        <div className="mt-2 rounded-xl bg-muted/40 p-3 text-sm">
          <span className="font-medium">Submission:</span> {milestone.submission_note}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {isBusiness && milestone.status === "pending" && (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => act(() => deletePendingMilestone(milestone.id), "Milestone deleted")}
            >
              Delete
            </Button>
          </>
        )}

        {isRecipient && (milestone.status === "pending" || milestone.status === "disputed") && (
          <div className="w-full space-y-2">
            <Textarea
              placeholder="Add a completion note"
              value={submissionNote}
              onChange={(e) => setSubmissionNote(e.target.value)}
            />
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                act(
                  () => submitMilestone(milestone.id, submissionNote),
                  milestone.status === "disputed" ? "Milestone resubmitted" : "Milestone submitted",
                )
              }
            >
              {milestone.status === "disputed" ? "Resubmit work" : "Submit work"}
            </Button>
          </div>
        )}

        {isBusiness && milestone.status === "submitted" && (
          <div className="w-full space-y-2">
            <Textarea
              placeholder="Optional reason for dispute"
              value={disputeNote}
              onChange={(e) => setDisputeNote(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => act(() => approveMilestone(milestone.id), "Milestone approved")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  act(() => disputeMilestone(milestone.id, disputeNote), "Milestone disputed")
                }
              >
                Dispute
              </Button>
            </div>
          </div>
        )}

        <Button size="sm" variant="ghost" onClick={() => setHistory((value) => !value)}>
          {history ? "Hide history" : "History"}
        </Button>
      </div>

      {history && <MilestoneHistory id={milestone.id} />}
    </li>
  );
}

export function MilestonesPanel({ contracts }: { contracts: Contract[] }) {
  const { user, session } = useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: milestonesKey, enabled: !!session, queryFn: listMyMilestones });
  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel("live-milestones-" + session.user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones" }, () => void qc.invalidateQueries({ queryKey: milestonesKey }))
      .on("postgres_changes", { event: "*", schema: "public", table: "milestone_events" }, () => void qc.invalidateQueries({ queryKey: milestonesKey }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session, qc]);

  const grouped = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    for (const milestone of q.data ?? []) {
      map.set(milestone.contract_id, [...(map.get(milestone.contract_id) ?? []), milestone]);
    }
    return map;
  }, [q.data]);

  if (!user) return null;

  if (q.isLoading) {
    return (
      <Card className="mt-6">
        <h2 className="font-bold">Contract milestones</h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading milestones…</p>
      </Card>
    );
  }

  if (q.isError) {
    return (
      <Card className="mt-6">
        <h2 className="font-bold">Contract milestones</h2>
        <p className="mt-2 text-sm text-destructive">
          Couldn't load milestones. Try again shortly.
        </p>
      </Card>
    );
  }

  const visible = contracts.filter((contract) => {
    const business = user.businessIds.includes(contract.business_id);
    const recipient =
      (contract.worker_id && contract.worker_id === user.workerId) ||
      (contract.team_id && user.leadTeamIds.includes(contract.team_id));
    return business || recipient;
  });

  if (!visible.length) return null;

  return (
    <div className="mt-6 space-y-4">
      {visible.map((contract) => {
        const milestones = grouped.get(contract.id) ?? [];
        const planned = milestones.reduce((sum, item) => sum + item.amount_rwf, 0);
        const approved = milestones
          .filter((item) => item.status === "approved")
          .reduce((sum, item) => sum + item.amount_rwf, 0);
        const remaining = Math.max(0, contract.amount_rwf - planned);
        const business = user.businessIds.includes(contract.business_id);
        const recipient = Boolean(
          (contract.worker_id && contract.worker_id === user.workerId) ||
          (contract.team_id && user.leadTeamIds.includes(contract.team_id)),
        );
        const nextSequence = milestones.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;

        return (
          <Card key={contract.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{contract.title}</h2>
                <p className="text-sm text-muted-foreground">
                  Contract {rwf(contract.amount_rwf)} · {contract.status}
                </p>
              </div>
              <div className="text-right text-sm">
                <p>Planned: {rwf(planned)}</p>
                <p>Approved: {rwf(approved)}</p>
                <p>Remaining: {rwf(remaining)}</p>
              </div>
            </div>

            {contract.status === "active" && business && (
              <MilestoneForm
                contractId={contract.id}
                nextSequence={nextSequence}
                remaining={remaining}
                onDone={() => undefined}
              />
            )}

            {!milestones.length ? (
              <p className="mt-4 text-sm text-muted-foreground">No milestones yet.</p>
            ) : (
              <ul className="mt-3 divide-y">
                {milestones.map((milestone) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    isBusiness={business}
                    isRecipient={recipient}
                  />
                ))}
              </ul>
            )}

            {contract.status !== "active" && milestones.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                This contract is {contract.status}; milestone actions are locked.
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
