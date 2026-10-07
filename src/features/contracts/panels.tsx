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
  const [form, setForm] = useState({
    title: "",
    scope: "",
    amount: "",
    start: "",
    end: "",
    terms: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const input = {
      applicationId,
      title: form.title,
      scope: form.scope,
      amountRwf: Number(form.amount),
      ...(form.start ? { startDate: form.start } : {}),
      ...(form.end ? { endDate: form.end } : {}),
      ...(form.terms ? { terms: form.terms } : {}),
    };
    const validation = validateProposal(input);
    if (validation) {
      toast.error(validation);
      return;
    }

    setBusy(true);
    try {
      await createContract(input);
      toast.success("Contract proposal sent");
      await qc.invalidateQueries({ queryKey: contractsKey });
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create contract");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 grid gap-3 rounded-2xl border bg-muted/30 p-4">
      <Input
        placeholder="Contract title"
        value={form.title}
        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
      />
      <Textarea
        placeholder="Scope of work"
        value={form.scope}
        onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value }))}
      />
      <Input
        type="number"
        min={1}
        step={1}
        placeholder="Agreed amount (RWF)"
        value={form.amount}
        onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="date"
          aria-label="Start date"
          value={form.start}
          onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))}
        />
        <Input
          type="date"
          aria-label="End date"
          value={form.end}
          onChange={(e) => setForm((p) => ({ ...p, end: e.target.value }))}
        />
      </div>
      <Textarea
        placeholder="Terms and notes (optional)"
        value={form.terms}
        onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={submit}>
          {busy ? "Sending…" : "Send proposal"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const statusTone = (status: string) =>
  status === "active"
    ? "success"
    : status === "proposed"
      ? "primary"
      : "muted";

export function ContractsPanel() {
  const { user } = useApp();
  const qc = useQueryClient();
  const query = useContracts();
  const [openApplication, setOpenApplication] = useState<string | null>(null);

  if (!user) return null;

  const act = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
      await qc.invalidateQueries({ queryKey: contractsKey });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };

  return (
    <Card className="mt-6">
      <h2 className="font-bold">Contracts</h2>
      {query.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading contracts…</p>
      ) : query.isError ? (
        <p className="mt-2 text-sm text-destructive">
          Couldn&apos;t load contracts. Please try again.
        </p>
      ) : !query.data?.length ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No contracts yet. A contract appears here after an accepted application receives a
          proposal.
        </p>
      ) : (
        <ul className="mt-3 divide-y">
          {query.data.map((contract) => {
            const isBusiness = user.businessIds.includes(contract.business_id);
            const isRecipient =
              (contract.worker_id !== null && contract.worker_id === user.workerId) ||
              (contract.team_id !== null && user.leadTeamIds.includes(contract.team_id));

            return (
              <li
                key={contract.id}
                className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">{contract.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {rwf(Number(contract.amount_rwf))} ·{" "}
                    {contract.team_id ? "Team contract" : "Individual contract"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{contract.scope}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={statusTone(contract.status) as "success" | "primary" | "muted"}>
                    {contract.status}
                  </Pill>
                  {isRecipient && contract.status === "proposed" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          void act(
                            () => respondContract(contract.id, true),
                            "Contract accepted — now active",
                          )
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void act(() => respondContract(contract.id, false), "Contract declined")
                        }
                      >
                        Decline
                      </Button>
                    </>
                  )}
                  {isBusiness &&
                    (contract.status === "proposed" || contract.status === "active") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void act(() => cancelContract(contract.id), "Contract cancelled")
                        }
                      >
                        Cancel
                      </Button>
                    )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {openApplication && (
        <CreateContractForm
          applicationId={openApplication}
          onDone={() => setOpenApplication(null)}
        />
      )}
    </Card>
  );
}
