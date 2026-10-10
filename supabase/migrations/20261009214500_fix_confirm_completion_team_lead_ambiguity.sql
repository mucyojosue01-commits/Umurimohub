-- Fix ambiguous is_team_lead overload in completion confirmation.
-- Keep this production hotfix reproducible in the repository migration history.

CREATE OR REPLACE FUNCTION public.confirm_completion(_contract_id uuid, _note text DEFAULT NULL::text)
RETURNS public.completion_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  c record;
  cc record;
  actor uuid := (select auth.uid());
  caller_is_business boolean;
  caller_is_worker boolean;
  caller_is_team boolean;
  requester_is_business boolean;
  requester_is_worker boolean;
  requester_is_team boolean;
  milestone_count integer;
  approved_count integer;
  ve_id uuid;
  completion_event_id bigint;
  subject_type text;
  subject_id text;
  other_contracts integer;
  milestone record;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING errcode='42501'; END IF;
  SELECT * INTO c FROM public.contracts WHERE id=_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found' USING errcode='P0002'; END IF;
  IF c.status <> 'active' THEN RAISE EXCEPTION 'Only active contracts can be confirmed'; END IF;
  SELECT * INTO cc FROM public.contract_completions WHERE contract_id=c.id FOR UPDATE;
  IF NOT FOUND OR cc.status <> 'requested' THEN RAISE EXCEPTION 'No pending completion request found'; END IF;
  IF cc.requested_by = actor THEN RAISE EXCEPTION 'Requester cannot confirm their own completion request' USING errcode='42501'; END IF;

  requester_is_business := EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id=c.business_id AND bm.user_id=cc.requested_by);
  requester_is_worker := c.worker_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.worker_profiles wp WHERE wp.id=c.worker_id AND wp.user_id=cc.requested_by);
  requester_is_team := c.team_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id=c.team_id AND t.lead_user_id=cc.requested_by);
  caller_is_business := EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id=c.business_id AND bm.user_id=actor);
  caller_is_worker := c.worker_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.worker_profiles wp WHERE wp.id=c.worker_id AND wp.user_id=actor);
  caller_is_team := c.team_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id=c.team_id AND t.lead_user_id=actor);

  IF NOT (requester_is_business OR requester_is_worker OR requester_is_team) THEN
    RAISE EXCEPTION 'Completion request is not owned by a contracting party' USING errcode='42501';
  END IF;
  IF requester_is_business THEN
    IF NOT (caller_is_worker OR caller_is_team) THEN RAISE EXCEPTION 'Only the worker or team lead counterparty can confirm completion' USING errcode='42501'; END IF;
  ELSE
    IF NOT caller_is_business THEN RAISE EXCEPTION 'Only the hiring business counterparty can confirm completion' USING errcode='42501'; END IF;
  END IF;

  SELECT count(*)::integer, count(*) FILTER (WHERE status='approved')::integer
    INTO milestone_count, approved_count FROM public.milestones WHERE contract_id=c.id;
  IF milestone_count > 0 AND approved_count <> milestone_count THEN
    RAISE EXCEPTION 'All milestones must be approved before completion can be confirmed';
  END IF;

  UPDATE public.contract_completions SET status='confirmed', confirmed_by=actor, confirmed_at=now(), completed_at=now() WHERE id=cc.id;
  UPDATE public.contracts SET status='completed', completed_at=now() WHERE id=c.id;
  INSERT INTO public.completion_events(completion_id,contract_id,actor,event_type,from_status,to_status,note)
    VALUES(cc.id,c.id,actor,'confirmed','requested','confirmed',left(_note,5000)) RETURNING id INTO completion_event_id;
  INSERT INTO public.contract_events(contract_id,actor,event_type,from_status,to_status,note)
    VALUES(c.id,actor,'completed','active','completed',left(_note,1000));

  IF c.worker_id IS NOT NULL THEN subject_type:='worker'; subject_id:=c.worker_id::text;
  ELSE subject_type:='team'; subject_id:=c.team_id::text; END IF;

  INSERT INTO public.verified_experiences(contract_id,completion_id,opportunity_id,business_id,worker_id,team_id,title,scope,amount_rwf,currency,start_date,end_date,completed_at,milestone_count,approved_milestone_count,verified_at)
    VALUES(c.id,cc.id,c.opportunity_id,c.business_id,c.worker_id,c.team_id,c.title,c.scope,c.amount_rwf,c.currency,c.start_date,c.end_date,now(),milestone_count,approved_count,now())
    ON CONFLICT (contract_id) DO UPDATE SET completion_id=EXCLUDED.completion_id
    RETURNING id INTO ve_id;

  INSERT INTO public.reputation_evidence(subject_type,subject_id,evidence_type,source_contract_id,source_experience_id,source_event_id,occurred_at,metadata)
    VALUES(subject_type,subject_id,'verified_project_completed',c.id,ve_id,completion_event_id,now(),jsonb_build_object('milestone_count',milestone_count))
    ON CONFLICT DO NOTHING;
  IF c.end_date IS NOT NULL AND now()::date <= c.end_date THEN
    INSERT INTO public.reputation_evidence(subject_type,subject_id,evidence_type,source_contract_id,source_experience_id,source_event_id,occurred_at,metadata)
      VALUES(subject_type,subject_id,'verified_on_time_completion',c.id,ve_id,completion_event_id,now(),'{}'::jsonb) ON CONFLICT DO NOTHING;
  END IF;
  FOR milestone IN SELECT m.id,m.approved_at FROM public.milestones m WHERE m.contract_id=c.id AND m.status='approved' LOOP
    INSERT INTO public.reputation_evidence(subject_type,subject_id,evidence_type,source_contract_id,source_experience_id,source_event_id,occurred_at,metadata)
      SELECT subject_type,subject_id,'verified_milestone_completion',c.id,ve_id,me.id,coalesce(milestone.approved_at,now()),jsonb_build_object('milestone_id',milestone.id)
      FROM public.milestone_events me WHERE me.milestone_id=milestone.id AND me.event_type='approved'
      ORDER BY me.at DESC LIMIT 1 ON CONFLICT DO NOTHING;
  END LOOP;
  SELECT count(*)::integer INTO other_contracts FROM public.contracts prior
    WHERE prior.business_id=c.business_id AND prior.status='completed' AND prior.id<>c.id
      AND ((subject_type='worker' AND prior.worker_id::text=subject_id) OR (subject_type='team' AND prior.team_id::text=subject_id));
  IF other_contracts > 0 THEN
    INSERT INTO public.reputation_evidence(subject_type,subject_id,evidence_type,source_contract_id,source_experience_id,occurred_at,metadata)
      VALUES(subject_type,subject_id,'repeat_employer_relationship',c.id,ve_id,now(),jsonb_build_object('prior_completed_contracts',other_contracts)) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.notifications(user_id,kind,text,link)
    SELECT bm.user_id,'completion_confirmed','Contract completed: '||c.title,'/dashboard' FROM public.business_members bm WHERE bm.business_id=c.business_id;
  IF c.worker_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,kind,text,link)
      SELECT wp.user_id,'completion_confirmed','Contract completed: '||c.title,'/dashboard' FROM public.worker_profiles wp WHERE wp.id=c.worker_id AND wp.user_id IS NOT NULL;
    INSERT INTO public.notifications(user_id,kind,text,link)
      SELECT wp.user_id,'verified_experience_created','Verified work history created: '||c.title,'/dashboard' FROM public.worker_profiles wp WHERE wp.id=c.worker_id AND wp.user_id IS NOT NULL;
  ELSE
    INSERT INTO public.notifications(user_id,kind,text,link)
      SELECT t.lead_user_id,'completion_confirmed','Team contract completed: '||c.title,'/dashboard' FROM public.teams t WHERE t.id=c.team_id AND t.lead_user_id IS NOT NULL;
    INSERT INTO public.notifications(user_id,kind,text,link)
      SELECT t.lead_user_id,'verified_experience_created','Verified team experience created: '||c.title,'/dashboard' FROM public.teams t WHERE t.id=c.team_id AND t.lead_user_id IS NOT NULL;
  END IF;
  RETURN 'confirmed';
END;
$function$;

NOTIFY pgrst, 'reload schema';
