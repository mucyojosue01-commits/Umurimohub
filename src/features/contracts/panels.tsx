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
import { Card, Pill } from "@/features/ui/kit";
import {
  cancelContract,
  contractsKey,
  createContract,
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

const tone = (s: string) =>
  (s === "active" ? "success" : s === "proposed" ? "primary" : "muted") as
    "success" | "primary" | "muted";

export function ContractsPanel() {
  const { user } = useApp();
  const qc = useQueryClient();
  const q = useContracts();
  const [infoContract, setInfoContract] = useState<Contract | null>(null);
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
    <Dialog open={!!infoContract} onOpenChange={(open)=>{if(!open)setInfoContract(null)}}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader><DialogTitle>Project overview</DialogTitle></DialogHeader>
        {infoContract && <div className="space-y-4">
          <div><p className="font-semibold">{infoContract.title}</p><p className="text-sm text-muted-foreground">{infoContract.scope}</p></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Status</p><p className="font-semibold">{infoContract.status}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Amount</p><p className="font-semibold">{rwf(infoContract.amount_rwf)}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Payments</p><p className="font-semibold">Payments not yet enabled</p></div></div>
          <div><p className="font-semibold">Milestones</p>{milestonesQ.isLoading?<p className="text-sm text-muted-foreground">Loading milestones…</p>:milestonesQ.isError?<p className="text-sm text-destructive">Could not load milestones. Please try again.</p>:!milestonesQ.data?.length?<p className="text-sm text-muted-foreground">No milestones yet.</p>:<ul className="divide-y">{milestonesQ.data.map(m=><li key={m.id} className="flex justify-between py-2 text-sm"><span>{m.title}</span><span>{m.status} · {rwf(m.amount_rwf)}</span></li>)}</ul>}</div>
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">Users/teams: {infoContract.worker_id ? "Individual worker" : infoContract.team_id ? "Team" : "—"}. Payment status will appear here after the payment phase is enabled.</div>
        </div>}
      </DialogContent>
    </Dialog>
    </>
  );
}
