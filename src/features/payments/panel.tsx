import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, Pill } from "@/features/ui/kit";
import { rwf } from "@/features/data/demo";
import { useApp } from "@/features/store/app-store";
import { supabase } from "@/integrations/supabase/client";

type PaymentRow = {
  id: string; contract_id: string; milestone_id: string | null; payment_mode: string;
  amount_rwf: number; status: string; provider_reference: string | null;
  payer_phone: string | null; created_at: string; paid_at: string | null;
};
type DisputeRow = { id: string; payment_transaction_id: string; reason: string; status: string; created_at: string };

const paymentKey = (contractId: string, userId?: string) => ["payment-transactions", contractId, userId] as const;
const disputeKey = (contractId: string, userId?: string) => ["payment-disputes", contractId, userId] as const;
const statusTone = (status: string) => (status === "paid" ? "success" : status === "failed" ? "warning" : status === "processing" ? "primary" : "muted") as "success" | "primary" | "warning" | "muted";

export function PaymentPanel({
  contractId, amountRwf, paymentPlan, contractStatus, isBusiness, isRecipient,
}: {
  contractId: string; amountRwf: number; paymentPlan: string; contractStatus: string;
  isBusiness: boolean; isRecipient: boolean;
}) {
  const { session } = useApp();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [disputeFor, setDisputeFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const mode: "milestone" | "full_contract" = paymentPlan === "milestone" ? "milestone" : "full_contract";
  const [milestoneId, setMilestoneId] = useState("");
  const [milestones, setMilestones] = useState<Array<{id:string; title:string; amount_rwf:number; status:string}>>([]);

  const paymentsQ = useQuery({
    queryKey: paymentKey(contractId, session?.user.id),
    enabled: !!session && !!contractId,
    queryFn: async () => {
      // The generated Supabase types are refreshed separately after schema changes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.from("payment_transactions").select("id,contract_id,milestone_id,payment_mode,amount_rwf,status,provider_reference,payer_phone,created_at,paid_at").eq("contract_id", contractId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });
  const disputesQ = useQuery({
    queryKey: disputeKey(contractId, session?.user.id),
    enabled: !!session && !!contractId,
    queryFn: async () => {
      // The generated Supabase types are refreshed separately after schema changes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.from("payment_disputes").select("id,payment_transaction_id,reason,status,created_at").eq("contract_id", contractId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DisputeRow[];
    },
  });
  const milestonesQ = useQuery({
    queryKey: ["payment-eligible-milestones", contractId, session?.user.id],
    enabled: !!session && paymentPlan === "milestone",
    queryFn: async () => {
      // The generated Supabase types are refreshed separately after schema changes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.from("milestones").select("id,title,amount_rwf,status").eq("contract_id", contractId).eq("status", "approved").order("sequence");
      if (error) throw error;
      const rows = (data ?? []) as Array<{id:string;title:string;amount_rwf:number;status:string}>;
      setMilestones(rows);
      return rows;
    },
  });

  const paidTotal = useMemo(() => (paymentsQ.data ?? []).filter(p => p.status === "paid").reduce((sum,p) => sum + Number(p.amount_rwf), 0), [paymentsQ.data]);
  const pendingTotal = useMemo(() => (paymentsQ.data ?? []).filter(p => ["pending","processing"].includes(p.status)).reduce((sum,p) => sum + Number(p.amount_rwf), 0), [paymentsQ.data]);
  const hasOpenDispute = (paymentId: string) => (disputesQ.data ?? []).some(d => d.payment_transaction_id === paymentId && ["open","under_review"].includes(d.status));

  const refresh = async () => {
    if (isBusiness) {
      await Promise.all((paymentsQ.data ?? []).filter(p => ["pending","processing"].includes(p.status)).map(p =>
        supabase.functions.invoke("momo-pay-status", { body: { paymentTransactionId: p.id } }).catch(() => undefined)
      ));
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: paymentKey(contractId) }),
      qc.invalidateQueries({ queryKey: disputeKey(contractId) }),
      qc.invalidateQueries({ queryKey: ["payment-eligible-milestones", contractId] }),
      qc.invalidateQueries({ queryKey: ["payment-dashboard"] }),
    ]);
    await Promise.all([paymentsQ.refetch(), disputesQ.refetch()]);
  };
  const initiate = async () => {
    if (!isBusiness) return;
    if (mode === "milestone" && !milestoneId) { toast.error("Choose an approved milestone first."); return; }
    if (!phone.trim()) { toast.error("Enter the payer's MoMo phone number."); return; }
    setBusy(true);
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? "pay-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      // The generated Supabase types are refreshed separately after schema changes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.rpc("create_payment_intent", {
        _contract_id: contractId, _payment_mode: mode, _idempotency_key: idempotencyKey,
        _milestone_id: mode === "milestone" ? milestoneId : null, _payer_phone: phone.trim(),
      });
      if (error) throw error;
      const transaction = Array.isArray(data) ? data[0] : data;
      if (!transaction?.id) throw new Error("Payment request was not created.");
      const { data: providerResult, error: providerError } = await supabase.functions.invoke("momo-pay-initiate", { body: { paymentTransactionId: transaction.id } });
      await refresh();
      if (providerError) {
        toast.warning("Payment request saved. MoMo Pay credentials or provider setup are still required before a real charge can be sent.");
      } else if (providerResult?.configured === false) {
        toast.warning("Payment request saved; MoMo Pay is not configured yet. No money was charged.");
      } else {
        toast.success("MoMo Pay request sent. Complete the payment prompt on the phone.");
      }
    } catch (e) { toast.error((e as Error).message || "Could not initiate payment."); }
    finally { setBusy(false); }
  };
  const openDispute = async (paymentId: string) => {
    setBusy(true);
    try {
      // The generated Supabase types are refreshed separately after schema changes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { error } = await db.rpc("open_payment_dispute", { _payment_transaction_id: paymentId, _reason: reason });
      if (error) throw error;
      toast.success("Payment dispute opened. The other party has been notified.");
      setReason(""); setDisputeFor(null); await refresh();
    } catch (e) { toast.error((e as Error).message || "Could not open dispute."); }
    finally { setBusy(false); }
  };

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2"><CreditCard className="size-5 text-primary"/><div><h2 className="font-bold">Payments · MoMo Pay</h2><p className="text-sm text-muted-foreground">RWF transaction history, milestone payments and disputes.</p></div></div>
        <Button size="sm" variant="outline" onClick={() => { void refresh(); void milestonesQ.refetch(); }}><RefreshCw className="mr-1 size-3.5"/>Refresh</Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Contract value</p><p className="mt-1 text-lg font-bold">{rwf(amountRwf)}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Recorded paid</p><p className="mt-1 text-lg font-bold">{rwf(paidTotal)}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Pending</p><p className="mt-1 text-lg font-bold">{rwf(pendingTotal)}</p></div>
      </div>
      <div className="mt-4 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Agreed payment plan</h3><Pill tone="primary">{paymentPlan === "milestone" ? "Milestone-based" : "Full contract"}</Pill></div>
        {isBusiness && ((paymentPlan === "milestone" && ["active","completed"].includes(contractStatus)) || (paymentPlan === "full_contract" && contractStatus === "completed")) && (
          <div className="mt-3 space-y-3">
            {paymentPlan === "milestone" && (
              <div className="space-y-1"><label className="text-sm font-medium" htmlFor={"pay-milestone-"+contractId}>Approved milestone</label><select id={"pay-milestone-"+contractId} className="w-full rounded-xl border bg-background px-3 py-2 text-sm" value={milestoneId} onChange={e => setMilestoneId(e.target.value)}><option value="">Select milestone</option>{(milestonesQ.data ?? milestones).map(m => <option key={m.id} value={m.id}>{m.title} — {rwf(m.amount_rwf)}</option>)}</select>{milestonesQ.isError && <p className="text-xs text-destructive">Could not load milestones. Retry above.</p>}</div>
            )}
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Payer MoMo phone (e.g. 078…)" inputMode="tel" aria-label="Payer MoMo phone number"/>
            <Button disabled={busy || (mode === "milestone" && !(milestonesQ.data?.length))} onClick={() => void initiate()}>{busy ? "Preparing…" : "Request MoMo Pay"}</Button>
            <p className="text-xs text-muted-foreground">A request is not proof of payment. Status changes to paid only after a verified provider confirmation.</p>
          </div>
        )}
        {isBusiness && contractStatus !== "completed" && paymentPlan === "full_contract" && <p className="mt-2 text-xs text-muted-foreground">Full-contract payment becomes available after completion is confirmed.</p>}
        {!isBusiness && <p className="mt-2 text-sm text-muted-foreground">The hiring business manages payment initiation. You can review the transaction status and open a dispute below.</p>}
      </div>
      <div className="mt-4">
        <h3 className="font-semibold">Transaction history</h3>
        {paymentsQ.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading payments…</p> : paymentsQ.isError ? <p className="mt-2 text-sm text-destructive">Could not load payment history. Retry.</p> : !paymentsQ.data?.length ? <p className="mt-2 text-sm text-muted-foreground">No payments have been initiated for this contract.</p> : (
          <ul className="mt-2 divide-y">{paymentsQ.data.map(p => <li key={p.id} className="py-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{rwf(p.amount_rwf)} <span className="text-xs font-normal text-muted-foreground">· {p.payment_mode === "milestone" ? "Milestone" : "Full contract"}</span></p><p className="mt-1 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}{p.provider_reference ? " · Ref " + p.provider_reference : ""}</p></div><Pill tone={statusTone(p.status)}>{p.status}</Pill></div>
            {hasOpenDispute(p.id) && <p className="mt-2 flex items-center gap-1 text-xs text-amber-700"><ShieldAlert className="size-3.5"/>Dispute open</p>}
            {(isBusiness || isRecipient) && !hasOpenDispute(p.id) && ["pending","processing","paid","failed"].includes(p.status) && <div className="mt-2">{disputeFor === p.id ? <div className="space-y-2"><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the payment issue (at least 10 characters)" rows={3}/><div className="flex gap-2"><Button size="sm" disabled={busy || reason.trim().length < 10} onClick={() => void openDispute(p.id)}>Submit dispute</Button><Button size="sm" variant="ghost" onClick={() => {setDisputeFor(null);setReason("");}}>Cancel</Button></div></div> : <Button size="sm" variant="outline" onClick={() => setDisputeFor(p.id)}>Open dispute</Button>}</div>}
          </li>)}</ul>
        )}
      </div>
      {!!disputesQ.data?.length && <div className="mt-4"><h3 className="font-semibold">Dispute history</h3><ul className="mt-2 divide-y">{disputesQ.data.map(d => <li key={d.id} className="py-2"><div className="flex items-center justify-between gap-2"><Pill tone={d.status === "closed" || d.status.startsWith("resolved") ? "success" : "warning"}>{d.status.replaceAll("_"," ")}</Pill><span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span></div><p className="mt-1 text-sm">{d.reason}</p></li>)}</ul></div>}
    </Card>
  );
}

export function PaymentsDashboard() {
  const { session } = useApp();
  const q = useQuery({
    queryKey: ["payment-dashboard", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      // The generated Supabase types are refreshed separately after schema changes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.from("payment_transactions").select("amount_rwf,status");
      if (error) throw error;
      const rows = (data ?? []) as Array<{amount_rwf:number;status:string}>;
      return { paid: rows.filter(x => x.status === "paid").reduce((s,x) => s + Number(x.amount_rwf),0), pending: rows.filter(x => ["pending","processing"].includes(x.status)).reduce((s,x) => s + Number(x.amount_rwf),0), count: rows.length };
    },
  });
  if (!session) return null;
  return <Card className="mt-4"><div className="flex items-center justify-between gap-2"><div><h2 className="font-bold">Payment overview</h2><p className="text-sm text-muted-foreground">MoMo Pay transactions across your contracts</p></div><CreditCard className="size-5 text-primary"/></div>{q.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading payment totals…</p> : q.isError ? <div className="mt-3 flex items-center gap-2 text-sm text-destructive"><span>Payment totals unavailable.</span><Button size="sm" variant="outline" onClick={() => void q.refetch()}>Retry</Button></div> : <div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Paid transactions</p><p className="mt-1 text-lg font-bold">{rwf(q.data.paid)}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Pending transactions</p><p className="mt-1 text-lg font-bold">{rwf(q.data.pending)}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Transactions</p><p className="mt-1 text-lg font-bold">{q.data.count}</p></div></div>}</Card>;
}


export function PaymentDisputesAdmin() {
  const { user, session } = useApp();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["payment-disputes-admin", session?.user.id],
    enabled: !!session && user?.roles.includes("admin") === true,
    queryFn: async () => {
      // The generated Supabase types are refreshed separately after schema changes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.from("payment_disputes").select("id,contract_id,payment_transaction_id,reason,status,created_at,resolution_note").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as Array<{id:string;contract_id:string;payment_transaction_id:string;reason:string;status:string;created_at:string;resolution_note:string|null}>;
    },
  });
  if (!user?.roles.includes("admin")) return null;
  const resolve = async (id: string, decision: "resolved_payer" | "resolved_recipient" | "closed") => {
    const note = window.prompt("Resolution note (optional):") ?? "";
    setBusyId(id);
    try {
      // The generated Supabase types are refreshed separately after schema changes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { error } = await db.rpc("resolve_payment_dispute", { _dispute_id: id, _decision: decision, _note: note });
      if (error) throw error;
      toast.success("Payment dispute resolved and both parties notified.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["payment-disputes-admin"] }),
        qc.invalidateQueries({ queryKey: ["payment-disputes"] }),
        qc.invalidateQueries({ queryKey: ["payment-transactions"] }),
      ]);
    } catch (e) { toast.error((e as Error).message || "Could not resolve dispute."); }
    finally { setBusyId(null); }
  };
  return <Card className="mt-4"><div className="flex items-center justify-between gap-2"><div><h2 className="font-bold">Payment dispute administration</h2><p className="text-sm text-muted-foreground">Review disputes and record an auditable resolution.</p></div><ShieldAlert className="size-5 text-primary"/></div>
    {q.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading disputes…</p> : q.isError ? <div className="mt-3 flex items-center gap-2 text-sm text-destructive"><span>Could not load disputes.</span><Button size="sm" variant="outline" onClick={() => void q.refetch()}>Retry</Button></div> : !q.data?.length ? <p className="mt-3 text-sm text-muted-foreground">No payment disputes recorded.</p> : <ul className="mt-3 divide-y">{q.data.map(d => <li key={d.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><Pill tone={d.status === "closed" || d.status.startsWith("resolved") ? "success" : "warning"}>{d.status.replaceAll("_"," ")}</Pill><span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span></div><p className="mt-2 text-sm">{d.reason}</p><p className="mt-1 text-xs text-muted-foreground">Contract {d.contract_id} · Payment {d.payment_transaction_id}</p>{d.resolution_note && <p className="mt-2 text-xs text-muted-foreground">Resolution: {d.resolution_note}</p>}{["open","under_review"].includes(d.status) && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={busyId === d.id} onClick={() => void resolve(d.id,"resolved_payer")}>Resolve for payer</Button><Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => void resolve(d.id,"resolved_recipient")}>Resolve for recipient</Button><Button size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => void resolve(d.id,"closed")}>Close</Button></div>}</li>)}</ul>}
  </Card>;
}
