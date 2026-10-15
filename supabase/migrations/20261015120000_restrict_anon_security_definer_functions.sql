-- Keep public directory search callable without a session; all other SECURITY DEFINER
-- functions identified by the production advisor are internal or require authentication.
revoke execute on function public.apply_training(uuid,text) from anon, public;
revoke execute on function public.close_expired_opportunities() from anon, public;
revoke execute on function public.close_position_when_employment_starts() from anon, public;
revoke execute on function public.confirm_contract_payment_received(uuid) from anon, public;
revoke execute on function public.create_contract_payment(uuid) from anon, public;
revoke execute on function public.create_referral(text,text,text) from anon, public;
revoke execute on function public.enforce_team_opportunity_size() from anon, public;
revoke execute on function public.guard_single_company_position() from anon, public;
revoke execute on function public.guard_single_pending_employment_offer() from anon, public;
revoke execute on function public.is_active_contract_team_member(text) from anon, public;
revoke execute on function public.mark_contract_payment_paid(uuid,text) from anon, public;
revoke execute on function public.notify_milestone_change() from anon, public;
revoke execute on function public.notify_opportunity_status_change() from anon, public;
revoke execute on function public.notify_opportunity_terms_change() from anon, public;
revoke execute on function public.rate_completed_contract(uuid,integer,text) from anon, public;
revoke execute on function public.reaccept_cancelled_contract(uuid) from anon, public;
revoke execute on function public.recalculate_actor_trust(text,text) from anon, public;
revoke execute on function public.reject_expired_opportunity_application() from anon, public;
revoke execute on function public.respond_training_application(uuid,boolean,text) from anon, public;
revoke execute on function public.set_new_application_terms_version() from anon, public;
revoke execute on function public.shortlist_training_application(uuid) from anon, public;
revoke execute on function public.sync_trust_after_payment() from anon, public;
revoke execute on function public.sync_trust_after_verified_experience() from anon, public;
revoke execute on function public.update_contract(uuid,text,text,bigint,date,date,text) from anon, public;

-- Grant the authenticated role only the application RPCs intended to be called by users.
grant execute on function public.apply_training(uuid,text) to authenticated;
grant execute on function public.confirm_contract_payment_received(uuid) to authenticated;
grant execute on function public.create_contract_payment(uuid) to authenticated;
grant execute on function public.create_referral(text,text,text) to authenticated;
grant execute on function public.mark_contract_payment_paid(uuid,text) to authenticated;
grant execute on function public.rate_completed_contract(uuid,integer,text) to authenticated;
grant execute on function public.reaccept_cancelled_contract(uuid) to authenticated;
grant execute on function public.respond_training_application(uuid,boolean,text) to authenticated;
grant execute on function public.shortlist_training_application(uuid) to authenticated;
grant execute on function public.update_contract(uuid,text,text,bigint,date,date,text) to authenticated;
