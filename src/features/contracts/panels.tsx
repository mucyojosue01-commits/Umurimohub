import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rwf } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { Avatar, Card, Pill } from "@/features/ui/kit";
import { useCatalog } from "@/features/data/catalog";
import {
  cancelContract,
  contractsKey,
  createContract,
  deleteContract,
  updateContract,
  listMyContracts,
  respondContract,
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
  const { getBusiness, getTeam, getWorker } = useCatalog();
  const qc = useQueryClient();
  const q = useContracts();
  const [infoContract, setInfoContract] = useState<Contract | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const milestonesQ = useQuery({ queryKey: ["contract-overview-milestones", infoContract?.id], enabled: !!infoContract, queryFn: async () => { const { data, error } = await supabase.from("milestones").select("id,title,status,amount_rwf").eq("contract_id", infoContract!.id).order("sequence"); if(error) throw error; return data ?? []; }});
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
                  <Button size="sm" variant="outline" onClick={() => setInfoContract(c)} title="Project overview"><Info className="size-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => document.getElementById("milestones-" + c.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>Milestones</Button>
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
                  {isBiz && c.status === "proposed" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditingContract(c)}>Edit</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => act(async () => { await deleteContract(c.id); }, "Contract proposal deleted")}
                      >
                        Delete
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
    <Dialog open={!!editingContract} onOpenChange={(open)=>{if(!open)setEditingContract(null)}}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader><DialogTitle>Edit contract proposal</DialogTitle></DialogHeader>
        {editingContract && <EditContractForm contract={editingContract} onDone={() => setEditingContract(null)} />}
      </DialogContent>
    </Dialog>
    <Dialog open={!!infoContract} onOpenChange={(open)=>{if(!open)setInfoContract(null)}}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader><DialogTitle>Project overview</DialogTitle></DialogHeader>
        {infoContract && <div className="space-y-4">
          <div><p className="font-semibold">{infoContract.title}</p><p className="text-sm text-muted-foreground">{infoContract.scope}</p></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Status</p><p className="font-semibold">{infoContract.status}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Amount</p><p className="font-semibold">{rwf(infoContract.amount_rwf)}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Payments</p><p className="font-semibold">Payments not yet enabled</p></div></div>
          <div><p className="font-semibold">Milestones</p>{milestonesQ.isLoading?<p className="text-sm text-muted-foreground">Loading milestones…</p>:milestonesQ.isError?<p className="text-sm text-destructive">Could not load milestones. Please try again.</p>:!milestonesQ.data?.length?<p className="text-sm text-muted-foreground">No milestones yet.</p>:<ul className="divide-y">{milestonesQ.data.map(m=><li key={m.id} className="flex justify-between py-2 text-sm"><span>{m.title}</span><span>{m.status} · {rwf(m.amount_rwf)}</span></li>)}</ul>}</div>
          {(() => {
            const business = getBusiness(infoContract.business_id);
            const worker = infoContract.worker_id ? getWorker(infoContract.worker_id) : undefined;
            const team = infoContract.team_id ? getTeam(infoContract.team_id) : undefined;
            const party = worker ?? team;
            const partyName = worker?.name ?? team?.name ?? "Contract party";
            const partyAvatar = worker?.avatarUrl ?? team?.avatarUrl;
            return <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-sm font-semibold">Project parties</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {business && <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm"><Avatar initials={business.name.slice(0,2).toUpperCase()} src={business.avatarUrl} alt={business.name} size="sm" /><span><span className="block font-medium">{business.name}</span><span className="text-xs text-muted-foreground">Hiring business</span></span></div>}
                {party && <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm"><Avatar initials={partyName.slice(0,2).toUpperCase()} src={partyAvatar} alt={partyName} size="sm" /><span><span className="block font-medium">{partyName}</span><span className="text-xs text-muted-foreground">{worker ? "Worker" : "Team"}</span></span></div>}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Payment status will appear here after the payment phase is enabled.</p>
            </div>;
          })()}
        </div>}
      </DialogContent>
    </Dialog>
    </>
  );
}
