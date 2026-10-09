-- Fix contract workflow authorization: is_team_lead(text) conflicts with
-- is_team_lead(text, uuid DEFAULT auth.uid()) when called with one argument.
-- Use the explicit two-argument overload so contract and milestone reads work.
CREATE OR REPLACE FUNCTION public.is_contract_party(_cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.contracts c
    WHERE c.id = _cid
      AND (
        public.is_business_member(c.business_id)
        OR (c.worker_id IS NOT NULL AND c.worker_id = public.my_worker_id())
        OR (
          c.team_id IS NOT NULL
          AND public.is_team_lead(c.team_id, auth.uid())
        )
      )
  );
$function$;

NOTIFY pgrst, 'reload schema';
