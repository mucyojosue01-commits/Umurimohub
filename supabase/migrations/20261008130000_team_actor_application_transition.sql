create or replace function public.apply_as_actor(_opportunity_id text,_applicant_type text,_note text default '',_team_id text default null,_business_id text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); app_id uuid; opp record;
begin
 if uid is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 select * into opp from public.opportunities where id=_opportunity_id and status='open' for update;
 if not found then raise exception 'Opportunity not available' using errcode='P0002'; end if;
 if _applicant_type not in('individual','team','business') then raise exception 'Invalid applicant type'; end if;
 if not (_applicant_type=any(opp.eligible_actor_types)) then raise exception 'This opportunity does not accept this applicant type'; end if;
 if _applicant_type='team' and (_team_id is null or not public.is_team_lead(_team_id,uid)) then raise exception 'You must lead the selected team' using errcode='42501'; end if;
 if _applicant_type='business' and (_business_id is null or not public.is_business_member(_business_id,array['owner','admin','member'])) then raise exception 'You are not a member of the selected business' using errcode='42501'; end if;
 if _applicant_type='team' then
   update public.applications set status='withdrawn', updated_at=now()
   where opportunity_id=_opportunity_id and applicant_user_id=uid and applicant_type='individual' and status not in('withdrawn','rejected');
 end if;
 if _applicant_type='individual' and exists(select 1 from public.applications a where a.opportunity_id=_opportunity_id and a.applicant_user_id=uid and a.applicant_type in('team','business') and a.status not in('withdrawn','rejected')) then raise exception 'You already applied here as a team or business; withdraw that application before applying individually'; end if;
 if _applicant_type in('team','business') and exists(select 1 from public.applications a where a.opportunity_id=_opportunity_id and a.applicant_user_id=uid and a.applicant_type='individual' and a.status not in('withdrawn','rejected')) then raise exception 'You already applied individually here; withdraw that application before applying as another actor'; end if;
 insert into public.applications(opportunity_id,applicant_user_id,team_id,applicant_team_id,applicant_business_id,applicant_type,kind,note)
 values(_opportunity_id,uid,_team_id,_team_id,_business_id,_applicant_type,case when _applicant_type='team' then 'team' when _applicant_type='business' then 'business' else 'individual' end,left(coalesce(_note,''),2000))
 returning id into app_id;
 return app_id;
end $$;