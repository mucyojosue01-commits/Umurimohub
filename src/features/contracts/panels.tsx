import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rwf } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { Card, Pill } from "@/features/ui/kit";
import {
  cancelContract,
  contractsKey,
  createContract,
  listMyContracts,
  respondContract,
  validateProposal,
} from "./service";

export function useContracts() {
  const { session } = useApp();
  return useQuery({ queryKey: contractsKey, enabled: !!session, queryFn: listMyContracts });
}

export function CreateContractForm({
  applicationId,
  onDone,
}: {
  applicationId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", scope: "", amount: "", start: "", end: "", terms: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const p = {
      applicationId,
      title: f.title,
      scope: f.scope,
      amountRwf: Number(f.amount),
      ...(f.start ? { startDate: f.start } : {}),
      ...(f.end ? { endDate: f.end } : {}),
      ...(f.terms ? { terms: f.terms } : {}),
    };
    const err = validateProposal(p);
    if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      await createContract(p);
      toast.success("Contract proposed");
      void qc.invalidateQueries({ queryKey: contractsKey });
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 grid gap-2 rounded-2xl border bg-muted/30 p-4">
      <Input
        placeholder="Contract title"
        value={f.title}
        onChange={(e) => setF({ ...f, title: e.target.value })}
      />
      <Textarea
        placeholder="Scope of work"
        value={f.scope}
        onChange={(e) => setF({ ...f, scope: e.target.value })}
      />
      <Input
        type="number"
        min={1}
        step={1}
        placeholder="Amount (RWF)"
        value={f.amount}
        onChange={(e) => setF({ ...f, amount: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="date"
          aria-label="Start date"
          value={f.start}
          onChange={(e) => setF({ ...f, start: e.target.value })}
        />
        <Input
          type="date"
          aria-label="End date"
          value={f.end}
          onChange={(e) => setF({ ...f, end: e.target.value })}
        />
      </div>
      <Textarea
        placeholder="Terms (optional)"
        value={f.terms}
        onChange={(e) => setF({ ...f, terms: e.target.value })}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={submit}>
          {busy ? "Sending…" : "Send proposal"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const tone = (s: string) =>
  (s === "active" ? "success" : s === "proposed" ? "primary" : "muted") as
    "success" | "primary" | "muted";

export function ContractsPanel() {
  const { user } = useApp();
  const qc = useQueryClient();
  const q = useContracts();
  if (!user) return null;
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      void qc.invalidateQueries({ queryKey: contractsKey });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Card className="mt-6">
      <h2 className="font-bold">Contracts</h2>
      {q.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading contracts…</p>
      ) : q.isError ? (
        <p className="mt-2 text-sm text-destructive">Couldn't load contracts. Try again shortly.</p>
      ) : !q.data?.length ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No contracts yet. Contracts appear once an accepted application gets a proposal.
        </p>
      ) : (
        <ul className="mt-3 divide-y">
          {q.data.map((c) => {
            const isBiz = user.businessIds.includes(c.business_id);
            const isParty =
              (c.worker_id && c.worker_id === user.workerId) ||
              (c.team_id && user.leadTeamIds.includes(c.team_id));
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {rwf(c.amount_rwf)} · {c.team_id ? "Team" : "Individual"}
                  </p>
                </div>
                <span className="flex flex-wrap items-center gap-2">
                  <Pill tone={tone(c.status)}>{c.status}</Pill>
                  {isParty && c.status === "proposed" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          act(() => respondContract(c.id, true), "Contract accepted — now active")
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => act(() => respondContract(c.id, false), "Contract declined")}
                      >
                        Decline
                      </Button>
                    </>
                  )}
                  {isBiz && (c.status === "proposed" || c.status === "active") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act(() => cancelContract(c.id), "Contract cancelled")}
                    >
                      Cancel
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
