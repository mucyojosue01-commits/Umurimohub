-- Restrict contract deletion to signed-in users.
revoke execute on function public.delete_contract(uuid) from anon;
revoke execute on function public.delete_contract(uuid) from public;
grant execute on function public.delete_contract(uuid) to authenticated;
