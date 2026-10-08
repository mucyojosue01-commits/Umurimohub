import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Untyped view of the client for tables/functions defined in supabase/migrations
 * that are not yet present in the generated types. Replace with the typed client
 * once those migrations are applied and types regenerate.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as unknown as SupabaseClient<any, "public", any>;

export type MilestoneStatus = "pending" | "submitted" | "disputed" | "approved";
export type CompletionStatus = "requested" | "rejected" | "confirmed";

export type MilestoneRow = {
  id: string;
  contract_id: string;
  sequence: number;
  title: string;
  description: string;
  amount_rwf: number;
  due_date: string;
  status: MilestoneStatus;
  submission_note: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  disputed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type MilestoneEventRow = {
  id: number;
  milestone_id: string;
  contract_id: string;
  actor: string | null;
  event_type: string;
  from_status: MilestoneStatus | null;
  to_status: MilestoneStatus;
  note: string | null;
  at: string;
};
export type CompletionRow = {
  id: string;
  contract_id: string;
  status: CompletionStatus;
  requested_by: string | null;
  requested_at: string | null;
  request_note: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type CompletionEventRow = {
  id: number;
  completion_id: string;
  contract_id: string;
  actor: string | null;
  event_type: string;
  note: string | null;
  at: string;
};
export type VerifiedExperienceRow = {
  id: string;
  contract_id: string;
  title: string;
  completed_at: string;
  [k: string]: unknown;
};
export type ReputationEvidenceRow = {
  id: string;
  evidence_type: string;
  occurred_at: string;
  [k: string]: unknown;
};
export type ConversationRow = {
  id: string;
  created_by: string;
  opportunity_id: string | null;
  subject: string | null;
  created_at: string;
};
export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
