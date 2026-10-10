-- Trigger functions are invoked by their owning trigger; they are not public RPC endpoints.
revoke all on function public.notify_employment_offer_created() from public, anon, authenticated;
