-- Align the native core with the existing transaction-based test harness.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.user_roles drop constraint if exists user_roles_user_id_fkey;
alter table public.worker_profiles drop constraint if exists worker_profiles_user_id_fkey;
alter table public.businesses drop constraint if exists businesses_created_by_fkey;
alter table public.business_members drop constraint if exists business_members_user_id_fkey;
alter table public.teams drop constraint if exists teams_lead_user_id_fkey;
alter table public.applications drop constraint if exists applications_applicant_user_id_fkey;
alter table public.applications drop constraint if exists applications_referred_by_fkey;
alter table public.connections drop constraint if exists connections_requester_fkey;
alter table public.connections drop constraint if exists connections_addressee_fkey;
alter table public.referrals drop constraint if exists referrals_referrer_fkey;
alter table public.recommendations drop constraint if exists recommendations_from_user_fkey;
alter table public.recommendations drop constraint if exists recommendations_to_user_fkey;
alter table public.contract_completions drop constraint if exists contract_completions_requested_by_fkey;
alter table public.contract_completions drop constraint if exists contract_completions_confirmed_by_fkey;
alter table public.contract_completions drop constraint if exists contract_completions_rejected_by_fkey;
alter table public.completion_events drop constraint if exists completion_events_actor_fkey;
