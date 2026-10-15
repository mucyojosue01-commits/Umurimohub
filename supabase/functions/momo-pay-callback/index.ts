import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Public callback endpoint: never trusts callback payloads. It queries MTN's
// authenticated status endpoint before changing a payment to paid or failed.
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return reply({ error: "Payment service is not configured." }, 503);
  const requestUrl = new URL(req.url);
  let transactionId = requestUrl.searchParams.get("transactionId");
  if (req.method === "POST") {
    try {
      const payload = await req.json();
      transactionId ||= typeof payload.externalId === "string" ? payload.externalId : null;
    } catch { /* Provider callbacks may be empty; use the configured URL query. */ }
  }
  if (!transactionId) return reply({ error: "Missing transactionId." }, 400);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: payment } = await admin.from("payment_transactions").select("*").eq("id", transactionId).maybeSingle();
  if (!payment) return reply({ error: "Payment not found." }, 404);
  if (payment.status === "paid") return reply({ ok: true, status: "paid", idempotent: true });
  if (!["pending", "processing"].includes(payment.status) || !payment.provider_reference) return reply({ ok: true, status: payment.status, ignored: true });
  const sub = Deno.env.get("MOMO_SUBSCRIPTION_KEY"), apiUser = Deno.env.get("MOMO_API_USER"), apiKey = Deno.env.get("MOMO_API_KEY");
  if (!sub || !apiUser || !apiKey) return reply({ error: "MoMo Pay credentials are not configured." }, 503);
  const base = (Deno.env.get("MOMO_BASE_URL") || "https://sandbox.momodeveloper.mtn.com").replace(/\/$/, "");
  const target = Deno.env.get("MOMO_TARGET_ENVIRONMENT") || "sandbox";
  try {
    const tokenResponse = await fetch(base + "/collection/token/", { method: "POST", headers: { Authorization: "Basic " + btoa(apiUser + ":" + apiKey), "Ocp-Apim-Subscription-Key": sub, "X-Target-Environment": target } });
    if (!tokenResponse.ok) return reply({ error: "Could not authenticate with MoMo Pay." }, 502);
    const token = await tokenResponse.json();
    const providerResponse = await fetch(base + "/collection/v1_0/requesttopay/" + encodeURIComponent(payment.provider_reference), { headers: { Authorization: "Bearer " + token.access_token, "Ocp-Apim-Subscription-Key": sub, "X-Target-Environment": target } });
    if (!providerResponse.ok) return reply({ error: "Could not verify payment with the provider." }, 502);
    const provider = await providerResponse.json(), providerStatus = String(provider.status || "").toUpperCase();
    const status = ["SUCCESSFUL", "SUCCESS"].includes(providerStatus) ? "paid" : ["FAILED", "REJECTED"].includes(providerStatus) ? "failed" : null;
    if (!status) return reply({ ok: true, status: payment.status, providerStatus });
    const patch = status === "paid"
      ? { status, paid_at: new Date().toISOString(), failure_reason: null }
      : { status, failed_at: new Date().toISOString(), failure_reason: "Provider reported payment failure" };
    const { data: changed } = await admin.from("payment_transactions").update(patch).eq("id", payment.id).in("status", ["pending", "processing"]).select("id").maybeSingle();
    if (changed) {
      const { data: contract } = await admin.from("contracts").select("title,worker_id,team_id").eq("id", payment.contract_id).maybeSingle();
      const title = contract?.title || "your contract";
      const notices = [{ user_id: payment.payer_user_id, kind: status === "paid" ? "payment_paid" : "payment_failed", text: status === "paid" ? "MoMo Pay confirmed " + payment.amount_rwf + " RWF for " + title + "." : "MoMo Pay payment failed for " + title + ".", link: "/contracts/" + payment.contract_id }];
      if (contract?.worker_id) {
        const { data: worker } = await admin.from("worker_profiles").select("user_id").eq("id", contract.worker_id).maybeSingle();
        if (worker?.user_id && worker.user_id !== payment.payer_user_id) notices.push({ user_id: worker.user_id, kind: status === "paid" ? "payment_paid" : "payment_failed", text: status === "paid" ? "MoMo Pay received " + payment.amount_rwf + " RWF for " + title + "." : "MoMo Pay payment failed for " + title + ".", link: "/contracts/" + payment.contract_id });
      } else if (contract?.team_id) {
        const { data: team } = await admin.from("teams").select("lead_user_id").eq("id", contract.team_id).maybeSingle();
        if (team?.lead_user_id && team.lead_user_id !== payment.payer_user_id) notices.push({ user_id: team.lead_user_id, kind: status === "paid" ? "payment_paid" : "payment_failed", text: status === "paid" ? "MoMo Pay received " + payment.amount_rwf + " RWF for " + title + "." : "MoMo Pay payment failed for " + title + ".", link: "/contracts/" + payment.contract_id });
      }
      await admin.from("notifications").insert(notices);
    }
    return reply({ ok: true, status });
  } catch (error) { console.error("MoMo callback verification failed", error); return reply({ error: "Could not verify payment status." }, 502); }
});