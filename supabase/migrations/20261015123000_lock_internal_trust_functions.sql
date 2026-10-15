-- Trust scores are derived from verified records and must not be directly writable
-- through the exposed RPC API. Trigger-owned calls continue to execute as the function owner.
revoke execute on function public.recalculate_actor_trust(text,text) from authenticated;

-- This trigger routine only creates the membership notification for NEW rows.
revoke execute on function public.notify_team_membership_change() from authenticated;
