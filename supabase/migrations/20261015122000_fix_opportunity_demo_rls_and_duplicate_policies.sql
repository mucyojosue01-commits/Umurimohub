-- Demo opportunities are read-only. The previous permissive creator policies
-- could OR-bypass the stricter business-member policies and mutate demo rows.
drop policy if exists "opportunities business member delete" on public.opportunities;
drop policy if exists "opportunities business member insert" on public.opportunities;
drop policy if exists "opportunities business member update" on public.opportunities;

alter policy "opportunities creator delete" on public.opportunities
  using (
    (
      created_by = auth.uid()
      or (
        business_id is not null
        and is_business_member(business_id, array['owner'::text, 'admin'::text])
      )
    )
    and coalesce(is_demo, false) = false
  );

alter policy "opportunities creator insert" on public.opportunities
  with check (
    created_by = auth.uid()
    and (business_id is null or is_business_member(business_id))
    and coalesce(is_demo, false) = false
  );

alter policy "opportunities creator update" on public.opportunities
  using (
    (
      created_by = auth.uid()
      or (business_id is not null and is_business_member(business_id))
    )
    and coalesce(is_demo, false) = false
  )
  with check (
    (
      created_by = auth.uid()
      or (business_id is not null and is_business_member(business_id))
    )
    and coalesce(is_demo, false) = false
  );

-- Remove duplicate permissive read policies; keep one identical policy per table.
drop policy if exists "parties read completion events" on public.completion_events;
drop policy if exists "parties read completions" on public.contract_completions;
drop policy if exists "milestone events parties read" on public.milestone_events;
drop policy if exists "milestones parties read" on public.milestones;
