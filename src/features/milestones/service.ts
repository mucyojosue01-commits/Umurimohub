import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
export type MilestoneEvent = Database["public"]["Tables"]["milestone_events"]["Row"];
export type MilestoneStatus = Database["public"]["Enums"]["milestone_status"];

export const milestoneStatuses = ["pending", "submitted", "disputed", "approved"] as const;

export type MilestoneInput = {
  contractId: string;
  sequence: number;
  title: string;
  description: string;
  amountRwf: number;
  dueDate: string;
};

export function validateMilestone(input: MilestoneInput): string | null {
  if (!Number.isInteger(input.sequence) || input.sequence <= 0) {
    return "Sequence must be a positive integer.";
  }
  if (!input.title.trim() || input.title.trim().length < 3 || input.title.trim().length > 200) {
    return "Title must be 3–200 characters.";
  }
  if (
    !input.description.trim() ||
    input.description.trim().length < 10 ||
    input.description.trim().length > 5000
  ) {
    return "Description must be 10–5000 characters.";
  }
  if (!Number.isInteger(input.amountRwf) || input.amountRwf <= 0) {
    return "Amount must be a whole number of RWF above 0.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    return "Due date must be a valid date.";
  }
  return null;
}

export const milestonesKey = ["milestones"] as const;

export function milestoneEventsKey(milestoneId: string) {
  return ["milestone-events", milestoneId] as const;
}

export async function listMyMilestones(): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .order("contract_id", { ascending: true })
    .order("sequence", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listMilestoneEvents(milestoneId: string): Promise<MilestoneEvent[]> {
  const { data, error } = await supabase
    .from("milestone_events")
    .select("*")
    .eq("milestone_id", milestoneId)
    .order("at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createMilestone(input: MilestoneInput) {
  const { data, error } = await supabase.rpc("create_milestone", {
    _contract_id: input.contractId,
    _sequence: input.sequence,
    _title: input.title,
    _description: input.description,
    _amount_rwf: input.amountRwf,
    _due_date: input.dueDate,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePendingMilestone(
  id: string,
  input: Omit<MilestoneInput, "contractId">,
) {
  const { data, error } = await supabase.rpc("update_pending_milestone", {
    _milestone_id: id,
    _sequence: input.sequence,
    _title: input.title,
    _description: input.description,
    _amount_rwf: input.amountRwf,
    _due_date: input.dueDate,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function deletePendingMilestone(id: string) {
  const { data, error } = await supabase.rpc("delete_pending_milestone", {
    _milestone_id: id,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function submitMilestone(id: string, submissionNote?: string) {
  const { data, error } = await supabase.rpc("submit_milestone", {
    _milestone_id: id,
    _submission_note: submissionNote?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function disputeMilestone(id: string, note?: string) {
  const { data, error } = await supabase.rpc("dispute_milestone", {
    _milestone_id: id,
    _note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function approveMilestone(id: string) {
  const { data, error } = await supabase.rpc("approve_milestone", {
    _milestone_id: id,
  });
  if (error) throw new Error(error.message);
  return data;
}
