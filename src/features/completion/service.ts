import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Completion = Database["public"]["Tables"]["contract_completions"]["Row"];
export type CompletionEvent = Database["public"]["Tables"]["completion_events"]["Row"];
export type VerifiedExperience = Database["public"]["Tables"]["verified_experiences"]["Row"];
export type ReputationEvidence = Database["public"]["Tables"]["reputation_evidence"]["Row"];
export type CompletionStatus = Database["public"]["Enums"]["completion_status"];
export type ContractStatus = Database["public"]["Enums"]["contract_status"];

export type MilestoneSummary = {
  status: Database["public"]["Enums"]["milestone_status"];
};

export type EvidenceSummary = {
  verifiedProjects: number;
  onTimeCompletions: number;
  repeatEmployers: number;
  verifiedMilestones: number;
  verifiedRecommendations: number;
  verifiedCollaborations: number;
};

export function completionReadiness(
  contractStatus: ContractStatus,
  milestones: MilestoneSummary[],
): { eligible: boolean; reason: string | null } {
  if (contractStatus !== "active") {
    return { eligible: false, reason: "Only active contracts can be completed." };
  }

  if (milestones.some((milestone) => milestone.status !== "approved")) {
    return {
      eligible: false,
      reason: "Approve all milestones before requesting completion.",
    };
  }

  return { eligible: true, reason: null };
}

export function evidenceSummary(evidence: Array<Pick<ReputationEvidence, "evidence_type">>): EvidenceSummary {
  return evidence.reduce<EvidenceSummary>(
    (summary, item) => {
      if (item.evidence_type === "verified_project_completed") summary.verifiedProjects += 1;
      if (item.evidence_type === "verified_on_time_completion") summary.onTimeCompletions += 1;
      if (item.evidence_type === "repeat_employer_relationship") summary.repeatEmployers += 1;
      if (item.evidence_type === "verified_milestone_completion") summary.verifiedMilestones += 1;
      if (item.evidence_type === "verified_recommendation") summary.verifiedRecommendations += 1;
      if (item.evidence_type === "verified_collaboration") summary.verifiedCollaborations += 1;
      return summary;
    },
    {
      verifiedProjects: 0,
      onTimeCompletions: 0,
      repeatEmployers: 0,
      verifiedMilestones: 0,
      verifiedRecommendations: 0,
      verifiedCollaborations: 0,
    },
  );
}

export const completionsKey = ["contract-completions"] as const;
export const verifiedExperienceKey = ["verified-experiences"] as const;
export const reputationEvidenceKey = ["reputation-evidence"] as const;

export async function listMyCompletions(): Promise<Completion[]> {
  const { data, error } = await supabase
    .from("contract_completions")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listMyCompletionEvents(completionId: string): Promise<CompletionEvent[]> {
  const { data, error } = await supabase
    .from("completion_events")
    .select("*")
    .eq("completion_id", completionId)
    .order("at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listVerifiedExperiences(): Promise<VerifiedExperience[]> {
  const { data, error } = await supabase
    .from("verified_experiences")
    .select("*")
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listReputationEvidence(): Promise<ReputationEvidence[]> {
  const { data, error } = await supabase
    .from("reputation_evidence")
    .select("*")
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function requestCompletion(contractId: string, note?: string) {
  const { data, error } = await supabase.rpc("request_completion", {
    _contract_id: contractId,
    _request_note: note?.trim() || undefined,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function withdrawCompletionRequest(contractId: string, note?: string) {
  const { data, error } = await supabase.rpc("withdraw_completion_request", {
    _contract_id: contractId,
    _note: note?.trim() || undefined,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function rejectCompletion(contractId: string, note?: string) {
  const { data, error } = await supabase.rpc("reject_completion", {
    _contract_id: contractId,
    _note: note?.trim() || undefined,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function confirmCompletion(contractId: string, note?: string) {
  const { data, error } = await supabase.rpc("confirm_completion", {
    _contract_id: contractId,
    _note: note?.trim() || undefined,
  });
  if (error) throw new Error(error.message);
  return data;
}
