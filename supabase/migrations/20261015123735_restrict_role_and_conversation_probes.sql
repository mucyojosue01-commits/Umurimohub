-- These helpers are used by RLS policies with auth.uid(). Prevent arbitrary RPC
-- arguments from probing another user's roles or private conversation membership.
create or replace function public.has_role(_role public.app_role, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    (
      _user_id = auth.uid()
      or exists (
        select 1
        from public.user_roles caller_role
        where caller_role.user_id = auth.uid()
          and caller_role.role = 'admin'::public.app_role
      )
    )
    and exists (
      select 1
      from public.user_roles target_role
      where target_role.user_id = _user_id
        and target_role.role = _role
    );
$function$;

create or replace function public.is_conversation_member(
  _conversation_id uuid,
  _user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    (
      _user_id = auth.uid()
      or exists (
        select 1
        from public.user_roles caller_role
        where caller_role.user_id = auth.uid()
          and caller_role.role = 'admin'::public.app_role
      )
    )
    and exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = _conversation_id
        and cm.user_id = _user_id
    );
$function$;
