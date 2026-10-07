create or replace function public.guard_completion_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status = 'confirmed' then
    raise exception 'Confirmed completion is immutable';
  end if;
  if new.contract_id <> old.contract_id then
    raise exception 'Completion contract identity is immutable';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'requested' and new.status in ('rejected','confirmed'))
    or (old.status = 'rejected' and new.status = 'requested')
  ) then
    raise exception 'Invalid completion transition % -> %', old.status, new.status;
  end if;
  new.updated_at := now();
  return new;
end;
$$;