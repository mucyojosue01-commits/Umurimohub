-- Explicit API/realtime exposure for Phase C tables.
grant select on public.contract_completions, public.completion_events,
  public.verified_experiences, public.reputation_evidence to authenticated;
