-- Keep trust scores synchronized with verified work and payment evidence.

create or replace function public.sync_trust_after_verified_experience()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.worker_id is not null then perform public.recalculate_actor_trust('worker',new.worker_id); end if;
  if new.team_id is not null then perform public.recalculate_actor_trust('team',new.team_id); end if;
  if new.business_id is not null then perform public.recalculate_actor_trust('business',new.business_id); end if;
  return new;
end;
$$;

drop trigger if exists verified_experience_sync_trust on public.verified_experiences;
create trigger verified_experience_sync_trust
after insert on public.verified_experiences
for each row execute function public.sync_trust_after_verified_experience();

create or replace function public.sync_trust_after_payment()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.status in ('paid','confirmed') and old.status is distinct from new.status then
    if new.recipient_worker_id is not null then perform public.recalculate_actor_trust('worker',new.recipient_worker_id); end if;
    if new.recipient_team_id is not null then perform public.recalculate_actor_trust('team',new.recipient_team_id); end if;
    perform public.recalculate_actor_trust('business',new.payer_business_id);
  end if;
  return new;
end;
$$;

drop trigger if exists contract_payment_sync_trust on public.contract_payments;
create trigger contract_payment_sync_trust
after update on public.contract_payments
for each row execute function public.sync_trust_after_payment();
