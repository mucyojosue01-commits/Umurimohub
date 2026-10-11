-- Ensure automatic deadline closure is installed and remains reproducible from migrations.
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      execute 'select cron.unschedule(jobid) from cron.job where jobname = ''close-expired-opportunities-hourly''';
    exception when undefined_table or undefined_function then null;
    end;
    execute 'select cron.schedule(''close-expired-opportunities-hourly'', ''0 * * * *'', ''select public.close_expired_opportunities();'')';
  else
    raise exception 'pg_cron is unavailable; opportunity deadline closure cannot be scheduled';
  end if;
end;
$$;
