-- Qualify rating score to avoid collision with the PL/pgSQL local variable.
-- Also calculate repeat evidence before using it in the trust score.

create or replace function public.recalculate_actor_trust(_subject_type text,_subject_id text)
returns numeric language plpgsql security definer set search_path=public
as $$
declare completed_count int; paid_count int; rating_avg numeric; rating_count int; repeat_count int; score numeric;
begin
  select count(*)::int into completed_count from public.verified_experiences
   where (_subject_type='worker' and worker_id=_subject_id)
      or (_subject_type='team' and team_id=_subject_id)
      or (_subject_type='business' and business_id=_subject_id);
  select count(*)::int into paid_count from public.contract_payments p
   join public.contracts c on c.id=p.contract_id
   where p.status in ('paid','confirmed')
     and ((_subject_type='worker' and c.worker_id=_subject_id)
       or (_subject_type='team' and c.team_id=_subject_id)
       or (_subject_type='business' and c.business_id=_subject_id));
  select coalesce(avg(cr.score),0),count(*)::int into rating_avg,rating_count
   from public.contract_ratings as cr
   where cr.subject_type=_subject_type and cr.subject_id=_subject_id;
  select count(*)::int into repeat_count
   from public.reputation_evidence
   where subject_type=_subject_type and subject_id=_subject_id and evidence_type='repeat_employer_relationship';
  score := least(100, greatest(0,
    least(40, completed_count * 8)
    + least(25, paid_count * 5)
    + rating_avg * 6
    + least(10, repeat_count * 5)
  ));
  if _subject_type='worker' then
    update public.worker_profiles
      set trust_score=score,rating=case when rating_count>0 then rating_avg else rating end,reviews=rating_count,
          rep=jsonb_build_object(
            'completion',case when completed_count>0 then least(100,completed_count*20) else 0 end,
            'onTime',case when completed_count>0 then least(100,completed_count*20) else 0 end,
            'response',coalesce((rep->>'response')::numeric,0),
            'repeat',repeat_count,'verifiedProjects',completed_count,'recommendations',coalesce((rep->>'recommendations')::int,0)
          )
      where id=_subject_id;
  elsif _subject_type='team' then
    update public.teams set trust_score=score,rating=case when rating_count>0 then rating_avg else rating end where id=_subject_id;
  elsif _subject_type='business' then
    update public.businesses set trust_score=score,rating=case when rating_count>0 then rating_avg else rating end where id=_subject_id;
  end if;
  return score;
end;
$$;
