import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MoreVertical, ArrowLeft, CircleCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { useCatalog } from "@/features/data/catalog";
import { Avatar, Card, Pill } from "@/features/ui/kit";
import { CompletionPanel } from "@/features/completion/panels";
import { MilestonesPanel } from "@/features/milestones/panels";
import { useContracts, EditContractForm } from "@/features/contracts/panels";
import { cancelContract, deleteContract, contractsKey, reacceptCancelledContract, createContractPayment, markContractPaymentPaid, confirmContractPaymentReceived, rateCompletedContract } from "@/features/contracts/service";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { rwf } from "@/features/data/demo";
import { Star, CreditCard } from "lucide-react";

export const Route = createFileRoute("/contracts/$id")({
  head: () => ({ meta: [{ title: "Contract — UmurimoHub" }] }),
  component: Page,
  notFoundComponent: () => <div className="container-page py-20 text-center">Contract not found. <Link className="text-primary" to="/dashboard">Back to dashboard</Link></div>,
});

function Page() {
  const { id } = Route.useParams();
  const { user } = useApp();
  const { getBusiness, getWorker, getTeam } = useCatalog();
  const qc = useQueryClient();
  const q = useContracts();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const contract = q.data?.find((x) => x.id === id);
  if (!q.isLoading && !contract) throw notFound();
  if (!contract) return <div className="container-page py-20 text-center text-muted-foreground">Loading contract…</div>;

  const isBusiness = user?.businessIds.includes(contract.business_id) ?? false;
  const isParty = Boolean(
    (contract.worker_id && contract.worker_id === user?.workerId) ||
    (contract.team_id && user?.leadTeamIds.includes(contract.team_id)),
  );
  const business = getBusiness(contract.business_id);
  const worker = contract.worker_id ? getWorker(contract.worker_id) : undefined;
  const team = contract.team_id ? getTeam(contract.team_id) : undefined;
  const partyName = worker?.name ?? team?.name ?? "Contract party";
  const partyAvatar = worker?.avatarUrl ?? team?.avatarUrl;

  const terminate = async () => {
    if (!window.confirm("Terminate this contract? The project will be recorded as cancelled and the other party will be notified.")) return;
    try {
      await cancelContract(contract.id);
      toast.success("Contract terminated");
      await qc.invalidateQueries({ queryKey: contractsKey });
      setMenu(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const [payment, setPayment] = useState<{ id: string; amount_rwf: number; status: string; payment_reference: string | null } | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [financeBusy, setFinanceBusy] = useState(false);
  const paymentQ = useQuery({
    queryKey: ["contract-payment", contract.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_payments").select("id,amount_rwf,status,payment_reference").eq("contract_id", contract.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const ratingQ = useQuery({
    queryKey: ["contract-rating", contract.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_ratings").select("score,review,subject_type,subject_id").eq("contract_id", contract.id).eq("rater_user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const doFinance = async (fn: () => Promise<unknown>, success: string) => {
    setFinanceBusy(true);
    try {
      await fn();
      toast.success(success);
      await Promise.all([paymentQ.refetch(), ratingQ.refetch()]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFinanceBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this proposed contract?")) return;
    try {
      await deleteContract(contract.id);
      toast.success("Contract deleted");
      window.location.href = "/dashboard";
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="container-page py-10">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Dashboard</Link>
      <Card className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Pill tone={contract.status === "active" ? "success" : contract.status === "proposed" ? "primary" : "muted"}>{contract.status}</Pill><span className="text-sm text-muted-foreground">{rwf(contract.amount_rwf)}</span></div>
            <h1 className="mt-3 text-3xl font-extrabold">{contract.title}</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">{contract.scope}</p>
          </div>
          <div className="relative">
            <Button size="icon" variant="outline" aria-label="Contract actions" onClick={() => setMenu((v) => !v)}><MoreVertical className="size-5" /></Button>
            {menu && (
              <div className="absolute right-0 top-12 z-30 w-52 rounded-2xl border bg-popover p-1 shadow-xl">
                {isBusiness && contract.status === "proposed" && <button className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setEditing(true); setMenu(false); }}>Edit proposal</button>}
                {isBusiness && contract.status === "proposed" && <button className="block w-full rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-muted" onClick={() => void remove()}>Delete proposal</button>}
                {contract.status === "cancelled" && (isBusiness || isParty) && <button className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => void doFinance(() => reacceptCancelledContract(contract.id), "Cancelled contract re-accepted and active")}>Re-accept contract</button>}
                {isBusiness && ["proposed","active"].includes(contract.status) && <button className="block w-full rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-muted" onClick={() => void terminate()}>Terminate project</button>}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Start</p><p className="font-medium">{contract.start_date ?? "Not set"}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">End</p><p className="font-medium">{contract.end_date ?? "Not set"}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Payments</p><p className="font-medium">Not enabled yet</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Project process</p><p className="font-medium">Milestones → completion</p></div>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="font-bold">Project parties</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {business && <Link to="/businesses/$id" params={{ id: business.id }} className="flex items-center gap-2 rounded-xl border p-3 hover:bg-muted"><Avatar initials={business.name.slice(0,2).toUpperCase()} src={business.avatarUrl} alt={business.name} size="sm" /><span><span className="block font-medium">{business.name}</span><span className="text-xs text-muted-foreground">Hiring business</span></span></Link>}
          {(worker || team) && <Link to={worker ? "/workers/$id" : "/teams/$id"} params={{ id: worker?.id ?? team!.id }} className="flex items-center gap-2 rounded-xl border p-3 hover:bg-muted"><Avatar initials={partyName.slice(0,2).toUpperCase()} src={partyAvatar} alt={partyName} size="sm" /><span><span className="block font-medium">{partyName}</span><span className="text-xs text-muted-foreground">{worker ? "Individual worker" : "Team"}</span></span></Link>}
        </div>
      </Card>

      <div className="mt-6"><MilestonesPanel contracts={[contract]} /></div>

      <Card className="mt-6">
        <div className="flex items-center gap-2"><CircleCheck className="size-5 text-primary" /><div><h2 className="font-bold">Contract process</h2><p className="text-sm text-muted-foreground">The live workflow for this project.</p></div></div>
        <ol className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ["Proposal", contract.status === "proposed" ? "Waiting for acceptance" : "Recorded"],
            ["Milestones", contract.status === "active" ? "Manage deliverables" : "Locked when inactive"],
            ["Completion", contract.status === "completed" ? "Confirmed" : "Awaiting completion"],
            ["Termination", contract.status === "cancelled" ? "Project terminated" : "Available to the hiring business"],
          ].map(([label, detail]) => <li key={label} className="rounded-xl border p-3"><p className="font-medium">{label}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></li>)}
        </ol>
        {contract.status === "cancelled" && (isBusiness || isParty) && <Button className="mt-4" onClick={() => void doFinance(() => reacceptCancelledContract(contract.id), "Cancelled contract re-accepted and active")}>Re-accept contract</Button>}
        {isBusiness && ["proposed","active"].includes(contract.status) && <Button className="mt-4" variant="outline" onClick={() => void terminate()}><XCircle className="size-4" />Terminate project</Button>}
      </Card>

      <CompletionPanel contracts={[contract]} />

      <Card className="mt-6">
        <div className="flex items-center gap-2"><CreditCard className="size-5 text-primary" /><div><h2 className="font-bold">Payment & rating</h2><p className="text-sm text-muted-foreground">Record payment after completion and leave a verified rating for the party you worked with.</p></div></div>
        {contract.status !== "completed" ? (
          <p className="mt-3 text-sm text-muted-foreground">Payment and rating unlock after the project is completed.</p>
        ) : (
          <div className="mt-4 space-y-5">
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">Project payment</h3>
              {paymentQ.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading payment…</p> : paymentQ.isError ? <div className="mt-2 flex items-center gap-2 text-sm text-destructive">Could not load payment. <Button size="sm" variant="outline" onClick={() => void paymentQ.refetch()}>Retry</Button></div> : !paymentQ.data ? (
                isBusiness ? <Button className="mt-3" disabled={financeBusy} onClick={() => void doFinance(async () => { await createContractPayment(contract.id); }, "Payment obligation created")}>Create payment obligation</Button> : <p className="mt-2 text-sm text-muted-foreground">The hiring business has not created the payment obligation yet.</p>
              ) : (
                <div className="mt-3 rounded-xl bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{rwf(paymentQ.data.amount_rwf)}</span><Pill tone={paymentQ.data.status === "confirmed" ? "success" : paymentQ.data.status === "paid" ? "primary" : "muted"}>{paymentQ.data.status}</Pill></div>
                  {paymentQ.data.payment_reference && <p className="mt-1 text-xs text-muted-foreground">Reference: {paymentQ.data.payment_reference}</p>}
                  {isBusiness && paymentQ.data.status === "pending" && <Button size="sm" className="mt-3" disabled={financeBusy} onClick={() => { const ref = window.prompt("Payment reference (optional):") ?? ""; void doFinance(() => markContractPaymentPaid(paymentQ.data!.id, ref), "Payment marked paid"); }}>Mark paid</Button>}
                  {isParty && paymentQ.data.status === "paid" && <Button size="sm" className="mt-3" disabled={financeBusy} onClick={() => void doFinance(() => confirmContractPaymentReceived(paymentQ.data!.id), "Payment confirmed received")}>Confirm payment received</Button>}
                  {paymentQ.data.status === "confirmed" && <p className="mt-2 text-xs text-success">Payment has been confirmed received.</p>}
                </div>
              )}
            </div>
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">Your rating</h3>
              {ratingQ.data ? <div className="mt-2 flex items-center gap-2"><div className="flex">{[1,2,3,4,5].map((n) => <Star key={n} className={"size-5 " + (n <= ratingQ.data.score ? "fill-accent text-accent" : "text-muted-foreground")} />)}</div><span className="text-sm">{ratingQ.data.score}/5</span></div> : (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-1" aria-label="Choose rating">{[1,2,3,4,5].map((n) => <button key={n} type="button" aria-label={n + " stars"} onClick={() => setRating(n)}><Star className={"size-6 " + (n <= rating ? "fill-accent text-accent" : "text-muted-foreground")} /></button>)}</div>
                  <textarea rows={3} className="w-full rounded-xl border bg-card p-3 text-sm" value={review} onChange={(e) => setReview(e.target.value)} placeholder="Describe the work relationship and outcome (optional)" />
                  <Button disabled={financeBusy || rating < 1} onClick={() => void doFinance(() => rateCompletedContract(contract.id, rating, review), "Rating saved and trust updated")}>Submit rating</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle>Edit contract proposal</DialogTitle></DialogHeader>
          {editing && <EditContractForm contract={contract} onDone={() => setEditing(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
