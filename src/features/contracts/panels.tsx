import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rwf } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { Card, Pill } from "@/features/ui/kit";
import {
  contractsKey,
  createContract,
  listMyContracts,
  updateContract,
  validateProposal,
  type Contract,
} from "./service";

export function useContracts() {
  const { session } = useApp();
  return useQuery({
    queryKey: [...contractsKey, session?.user.id],
    enabled: !!session,
    queryFn: listMyContracts,
  });
}

export function CreateContractForm({
  applicationId,
  onDone,
}: {
  applicationId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", scope: "", amount: "", paymentPlan: "full_contract" as "milestone" | "full_contract", start: "", end: "", terms: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const p = {
      applicationId,
      title: f.title,
      scope: f.scope,
      amountRwf: Number(f.amount),
      paymentPlan: f.paymentPlan,
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
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="contract-payment-plan">Payment arrangement</label>
        <select id="contract-payment-plan" className="w-full rounded-xl border bg-background px-3 py-2 text-sm" value={f.paymentPlan} onChange={(e) => setF({ ...f, paymentPlan: e.target.value as "milestone" | "full_contract" })}>
          <option value="milestone">Milestone-based — pay each approved milestone</option>
          <option value="full_contract">Full contract — pay after project completion</option>
        </select>
        <p className="text-xs text-muted-foreground">Agree this with the other party before accepting the contract.</p>
      </div>
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

export function EditContractForm({ contract, onDone }: { contract: Contract; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    title: contract.title,
    scope: contract.scope,
    amount: String(contract.amount_rwf),
    start: contract.start_date ?? "",
    end: contract.end_date ?? "",
    terms: contract.terms ?? "",
  });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const p = {
      title: f.title,
      scope: f.scope,
      amountRwf: Number(f.amount),
      ...(f.start ? { startDate: f.start } : {}),
      ...(f.end ? { endDate: f.end } : {}),
      ...(f.terms ? { terms: f.terms } : {}),
    };
    const err = validateProposal({ applicationId: contract.application_id, ...p });
    if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      await updateContract(contract.id, p);
      toast.success("Contract proposal updated");
      await qc.invalidateQueries({ queryKey: contractsKey });
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 grid gap-2 rounded-2xl border bg-muted/30 p-4">
      <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Contract title" />
      <Textarea value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} placeholder="Scope of work" />
      <Input type="number" min={1} step={1} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="Amount (RWF)" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} aria-label="Start date" />
        <Input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} aria-label="End date" />
      </div>
      <Textarea value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} placeholder="Terms" />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save contract"}</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

const tone = (s: string) =>
  (s === "active" ? "success" : s === "proposed" ? "primary" : "muted") as
    "success" | "primary" | "muted";

export function ContractsPanel() {
  const { user } = useApp();
  const q = useContracts();
  if (!user) return null;
  return (
    <Card className="mt-6">
      <h2 className="font-bold">Contracts & projects</h2>
      {q.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading contracts…</p>
      ) : q.isError ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-destructive">
          <span>Couldn't load contracts.</span>
          <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
            Retry
          </Button>
        </div>
      ) : !q.data?.length ? (
        <p className="mt-2 text-sm text-muted-foreground">No contracts yet. Contracts appear once an accepted application gets a proposal.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {q.data.map((contract) => (
            <li key={contract.id} className="py-1">
              <Link
                to="/contracts/$id"
                params={{ id: contract.id }}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-3 transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`Manage contract: ${contract.title}`}
              >
                <div className="min-w-0">
                  <p className="font-medium">{contract.title}</p>
                  <p className="text-sm text-muted-foreground">{rwf(contract.amount_rwf)} · {contract.team_id ? "Team" : "Individual"}</p>
                </div>
                <Pill tone={tone(contract.status)}>{contract.status}</Pill>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
