-- Restore authenticated access to the contract-party predicate used by RLS policies.
-- The function is SECURITY DEFINER and performs its own contract-party check;
-- granting EXECUTE does not bypass the table policies that call it.
GRANT EXECUTE ON FUNCTION public.is_contract_party(uuid) TO authenticated;
