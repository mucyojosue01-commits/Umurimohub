create or replace function public.resolve_payment_dispute(_dispute_id uuid, _decision text, _note text default null)
returns public.payment_disputes language plpgsql security definer set search_path = public
as $function$
declare d public.payment_disputes%rowtype; c public.contracts%rowtype; p public.payment_transactions%rowtype; target_user uuid;
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Only platform administrators can resolve payment disputes' using errcode = '42501'; end if;
 if _decision not in ('resolved_payer','resolved_recipient','closed') then raise exception 'Invalid dispute resolution'; end if;
 if char_length(coalesce(_note,'')) > 5000 then raise exception 'Resolution note must be 5000 characters or fewer'; end if;
 select * into d from public.payment_disputes where id=_dispute_id for update;
 if not found then raise exception 'Dispute not found' using errcode='P0002'; end if;
 if d.status not in ('open','under_review') then raise exception 'Dispute has already been resolved'; end if;
 update public.payment_disputes set status=_decision,resolution_note=nullif(btrim(coalesce(_note,'')),''),resolved_by=auth.uid(),resolved_at=now(),updated_at=now() where id=d.id returning * into d;
 select * into c from public.contracts where id=d.contract_id;
 select * into p from public.payment_transactions where id=d.payment_transaction_id;
 if public.is_business_member(c.business_id) then
   select wp.user_id into target_user from public.worker_profiles wp where c.worker_id is not null and wp.id::text=c.worker_id limit 1;
   if target_user is null and c.team_id is not null then select t.lead_user_id into target_user from public.teams t where t.id::text=c.team_id limit 1; end if;
 else
   select bm.user_id into target_user from public.business_members bm where bm.business_id::text=c.business_id order by case when bm.role in ('owner','admin') then 0 else 1 end limit 1;
 end if;
 insert into public.notifications(user_id,kind,text,link)
 select distinct x.user_id,'payment_dispute_resolved','Payment dispute resolved for '||coalesce(c.title,'your contract')||' ('||_decision||').','/contracts/'||c.id::text
 from unnest(array[p.payer_user_id,target_user]) as x(user_id) where x.user_id is not null;
 return d;
end;
$function$;
revoke all on function public.resolve_payment_dispute(uuid,text,text) from public, anon;
grant execute on function public.resolve_payment_dispute(uuid,text,text) to authenticated;
