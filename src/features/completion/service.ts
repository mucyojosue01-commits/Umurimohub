import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
export type Completion = Tables<"contract_completions">;
export type CompletionEvent = Tables<"completion_events">;
export type VerifiedExperience = Tables<"verified_experiences">;
export type ReputationEvidence = Tables<"reputation_evidence">;
export type CompletionStatus = Completion["status"];
export type ContractStatus = Database["public"]["Enums"]["contract_status"];
export type MilestoneSummary = { status: Tables<"milestones">["status"] };
export type EvidenceSummary = {verifiedProjects:number;onTimeCompletions:number;repeatEmployers:number;verifiedMilestones:number;verifiedRecommendations:number;verifiedCollaborations:number};
export function completionReadiness(contractStatus:ContractStatus,milestones:MilestoneSummary[]){if(contractStatus!=="active")return{eligible:false,reason:"Only active contracts can be completed."};if(milestones.some(m=>m.status!=="approved"))return{eligible:false,reason:"Approve all milestones before requesting completion."};return{eligible:true,reason:null};}
export function evidenceSummary(evidence:Array<Pick<ReputationEvidence,"evidence_type">>):EvidenceSummary{return evidence.reduce((s,i)=>{if(i.evidence_type==="verified_project_completed")s.verifiedProjects++;if(i.evidence_type==="verified_on_time_completion")s.onTimeCompletions++;if(i.evidence_type==="repeat_employer_relationship")s.repeatEmployers++;if(i.evidence_type==="verified_milestone_completion")s.verifiedMilestones++;if(i.evidence_type==="verified_recommendation")s.verifiedRecommendations++;if(i.evidence_type==="verified_collaboration")s.verifiedCollaborations++;return s;},{verifiedProjects:0,onTimeCompletions:0,repeatEmployers:0,verifiedMilestones:0,verifiedRecommendations:0,verifiedCollaborations:0});}
export const completionsKey=["contract-completions"] as const;
export const verifiedExperienceKey=["verified-experiences"] as const;
export const reputationEvidenceKey=["reputation-evidence"] as const;
export async function listMyCompletions(){const {data,error}=await supabase.from("contract_completions").select("*").order("updated_at",{ascending:false});if(error)throw error;return data??[];}
export async function listMyCompletionEvents(id:string){const {data,error}=await supabase.from("completion_events").select("*").eq("completion_id",id).order("at");if(error)throw error;return data??[];}
export async function listVerifiedExperiences(){const {data,error}=await supabase.from("verified_experiences").select("*").order("completed_at",{ascending:false});if(error)throw error;return data??[];}
export async function listReputationEvidence(){const {data,error}=await supabase.from("reputation_evidence").select("*").order("occurred_at",{ascending:false});if(error)throw error;return data??[];}
export async function requestCompletion(id:string,note?:string){const {data,error}=await supabase.rpc("request_completion",{_contract_id:id,...(note?.trim()?{_request_note:note.trim()}: {})});if(error)throw new Error(error.message);return data;}
export async function withdrawCompletionRequest(id:string,note?:string){const {data,error}=await supabase.rpc("withdraw_completion_request",{_contract_id:id,...(note?.trim()?{_note:note.trim()}: {})});if(error)throw new Error(error.message);return data;}
export async function rejectCompletion(id:string,note?:string){const {data,error}=await supabase.rpc("reject_completion",{_contract_id:id,...(note?.trim()?{_note:note.trim()}: {})});if(error)throw new Error(error.message);return data;}
export async function confirmCompletion(id:string,note?:string){const {data,error}=await supabase.rpc("confirm_completion",{_contract_id:id,...(note?.trim()?{_note:note.trim()}: {})});if(error)throw new Error(error.message);return data;}
