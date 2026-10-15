-- These routines are trigger-only or scheduled maintenance entry points.
-- Trigger execution does not require callers to retain direct RPC EXECUTE grants.
revoke execute on function public.close_expired_opportunities() from authenticated;
revoke execute on function public.close_position_when_employment_starts() from authenticated;
revoke execute on function public.enforce_team_opportunity_size() from authenticated;
revoke execute on function public.guard_single_company_position() from authenticated;
revoke execute on function public.guard_single_pending_employment_offer() from authenticated;
revoke execute on function public.notify_milestone_change() from authenticated;
revoke execute on function public.notify_opportunity_status_change() from authenticated;
revoke execute on function public.notify_opportunity_terms_change() from authenticated;
revoke execute on function public.reject_expired_opportunity_application() from authenticated;
revoke execute on function public.set_new_application_terms_version() from authenticated;
revoke execute on function public.sync_trust_after_payment() from authenticated;
revoke execute on function public.sync_trust_after_verified_experience() from authenticated;
