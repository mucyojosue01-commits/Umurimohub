import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Contract = Database["public"]["Tables"]["contracts"]["Row"];
export type ContractStatus = Database["public"]["Enums"]["contract_status"];

export type ContractProposal = {
  applicationId: string;
  title: string;
  scope: string;
  amountRwf: number;
  startDate?: string;
  endDate?: string;
  terms?: string;
};

/** Client-side mirror of database rules, for early feedback only. The database is authoritative. */
export function validateProposal(p: ContractProposal): string | null {
  if (p.title.trim().length < 3 || p.title.trim().length > 200)
    return "Title must be 3–200 characters.";
  if (p.scope.trim().length < 10) return "Describe the scope in at least 10 characters.";
  if (!Number.isInteger(p.amountRwf) || p.amountRwf <= 0)
    return "Amount must be a whole number of RWF above 0.";
  if (p.startDate && p.endDate && p.endDate < p.startDate)
    return "End date must be after start date.";
  return null;
}

export const contractsKey = ["contracts"] as const;

export async function listMyContracts(): Promise<Contract[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createContract(p: ContractProposal) {
  const { data, error } = await supabase.rpc("create_contract", {
    _application_id: p.applicationId,
    _title: p.title,
    _scope: p.scope,
    _amount_rwf: p.amountRwf,
    ...(p.startDate ? { _start_date: p.startDate } : {}),
    ...(p.endDate ? { _end_date: p.endDate } : {}),
    ...(p.terms ? { _terms: p.terms } : {}),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function respondContract(id: string, accept: boolean) {
  const { data, error } = await supabase.rpc("respond_contract", {
    _contract_id: id,
    _accept: accept,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelContract(id: string) {
  const { data, error } = await supabase.rpc("cancel_contract", { _contract_id: id });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateContract(id: string, p: Omit<ContractProposal, "applicationId">) {
  const { data, error } = await supabase.rpc("update_contract", {
    _contract_id: id,
    _title: p.title,
    _scope: p.scope,
    _amount_rwf: p.amountRwf,
    _start_date: p.startDate ?? null,
    _end_date: p.endDate ?? null,
    _terms: p.terms ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteContract(id: string) {
  const { error } = await supabase.rpc("delete_contract", { _contract_id: id });
  if (error) throw new Error(error.message);
}


export async function reacceptCancelledContract(id: string) {
  const { data, error } = await supabase.rpc("reaccept_cancelled_contract", { _contract_id: id });
  if (error) throw new Error(error.message);
  return data;
}

export async function createContractPayment(id: string) {
  const { data, error } = await supabase.rpc("create_contract_payment", { _contract_id: id });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function markContractPaymentPaid(id: string, reference?: string) {
  const { data, error } = await supabase.rpc("mark_contract_payment_paid", { _payment_id: id, _reference: reference ?? null });
  if (error) throw new Error(error.message);
  return data;
}

export async function confirmContractPaymentReceived(id: string) {
  const { data, error } = await supabase.rpc("confirm_contract_payment_received", { _payment_id: id });
  if (error) throw new Error(error.message);
  return data;
}

export async function rateCompletedContract(id: string, score: number, review: string) {
  const { data, error } = await supabase.rpc("rate_completed_contract", { _contract_id: id, _score: score, _review: review });
  if (error) throw new Error(error.message);
  return data as string;
}
