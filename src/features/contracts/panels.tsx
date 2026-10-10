import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreVertical } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rwf } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { Card, Pill } from "@/features/ui/kit";
import {
  cancelContract,
  contractsKey,
  createContract,
  deleteContract,
  updateContract,
  listMyContracts,
  respondContract,
  reacceptCancelledContract,
  validateProposal,
  type Contract,
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
  const qc = useQueryClient();
  const q = useContracts();
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [menuContract, setMenuContract] = useState<string | null>(null);
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
    <>
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
                  <Link to="/contracts/$id" params={{ id: c.id }} className="rounded-xl border px-3 py-2 text-sm hover:bg-muted">Open project</Link>
                  <div className="relative">
                    {c.status !== "completed" && <Button size="icon" variant="outline" aria-label="Contract actions" onClick={() => setMenuContract(menuContract === c.id ? null : c.id)}><MoreVertical className="size-4" /></Button>}
                    {menuContract === c.id && c.status !== "completed" && (
                      <div className="absolute right-0 top-11 z-30 w-48 rounded-2xl border bg-popover p-1 shadow-xl">
                        <Link to="/contracts/$id" params={{ id: c.id }} className="block rounded-xl px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => setMenuContract(null)}>Info / project page</Link>
                        {isBiz && c.status === "proposed" && <button className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setEditingContract(c); setMenuContract(null); }}>Edit</button>}
                        {isBiz && c.status === "proposed" && <button className="block w-full rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-muted" onClick={() => { setMenuContract(null); void act(async () => { await deleteContract(c.id); }, "Contract proposal deleted"); }}>Delete</button>}
                      </div>
                    )}
                  </div>
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
                  {(isBiz || isParty) && c.status === "cancelled" && (
                    <Button
                      size="sm"
                      onClick={() => act(() => reacceptCancelledContract(c.id), "Cancelled contract re-accepted and active")}
                    >
                      Re-accept
                    </Button>
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
    <Dialog open={!!editingContract} onOpenChange={(open)=>{if(!open)setEditingContract(null)}}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader><DialogTitle>Edit contract proposal</DialogTitle></DialogHeader>
        {editingContract && <EditContractForm contract={editingContract} onDone={() => setEditingContract(null)} />}
      </DialogContent>
    </Dialog>
    </>
  );
}
