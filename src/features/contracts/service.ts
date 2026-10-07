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

export const contractsKey = ["contracts"] as const;

export function validateProposal(input: ContractProposal): string | null {
  const title = input.title.trim();
  const scope = input.scope.trim();
  if (title.length < 3 || title.length > 200) return "Title must be 3–200 characters.";
  if (scope.length < 10 || scope.length > 5000) return "Scope must be 10–5,000 characters.";
  if (!Number.isInteger(input.amountRwf) || input.amountRwf <= 0)
    return "Amount must be a whole number of RWF above 0.";
  if (input.startDate && input.endDate && input.endDate < input.startDate)
    return "End date must be on or after the start date.";
  return null;
}

export async function listMyContracts(): Promise<Contract[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createContract(input: ContractProposal): Promise<string> {
  const { data, error } = await supabase.rpc("create_contract", {
    _application_id: input.applicationId,
    _title: input.title.trim(),
    _scope: input.scope.trim(),
    _amount_rwf: input.amountRwf,
    _start_date: input.startDate ?? null,
    _end_date: input.endDate ?? null,
    _terms: input.terms?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function respondContract(id: string, accept: boolean, note?: string) {
  const { data, error } = await supabase.rpc("respond_contract", {
    _contract_id: id,
    _accept: accept,
    _note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelContract(id: string, note?: string) {
  const { data, error } = await supabase.rpc("cancel_contract", {
    _contract_id: id,
    _note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data;
}
