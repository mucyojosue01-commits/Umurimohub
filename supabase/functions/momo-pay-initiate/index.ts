import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply({ error: "Payment service is not configured." }, 503);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply({ error: "Sign in required." }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return reply({ error: "Invalid session." }, 401);
  let body: { paymentTransactionId?: string };
  try { body = await req.json(); } catch { return reply({ error: "Invalid request body." }, 400); }
  if (!body.paymentTransactionId) return reply({ error: "Payment transaction ID is required." }, 400);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: payment } = await admin.from("payment_transactions").select("*").eq("id", body.paymentTransactionId).maybeSingle();
  if (!payment) return reply({ error: "Payment request not found." }, 404);
  if (payment.payer_user_id !== user.id) return reply({ error: "Only the payer can initiate this payment." }, 403);
  if (!["pending", "processing"].includes(payment.status)) return reply({ error: "This payment is not awaiting initiation." }, 409);
  const subscriptionKey = Deno.env.get("MOMO_SUBSCRIPTION_KEY"), apiUser = Deno.env.get("MOMO_API_USER"), apiKey = Deno.env.get("MOMO_API_KEY");
  if (!subscriptionKey || !apiUser || !apiKey) return reply({ configured: false, status: payment.status, message: "MoMo Pay credentials are not configured; no money was charged." });
  if (!payment.payer_phone) return reply({ error: "Payer phone number is required." }, 400);
  const base = (Deno.env.get("MOMO_BASE_URL") || "https://sandbox.momodeveloper.mtn.com").replace(/\/$/, "");
  const target = Deno.env.get("MOMO_TARGET_ENVIRONMENT") || "sandbox";
  try {
    const tokenResponse = await fetch(base + "/collection/token/", { method: "POST", headers: { Authorization: "Basic " + btoa(apiUser + ":" + apiKey), "Ocp-Apim-Subscription-Key": subscriptionKey, "X-Target-Environment": target } });
    if (!tokenResponse.ok) return reply({ error: "MoMo Pay authentication failed. Check provider credentials and target environment." }, 502);
    const token = await tokenResponse.json(), reference = crypto.randomUUID();
    const phone = payment.payer_phone.replace(/[^0-9]/g, "").replace(/^0/, "250");
    const providerResponse = await fetch(base + "/collection/v1_0/requesttopay", {
      method: "POST",
      headers: { Authorization: "Bearer " + token.access_token, "Ocp-Apim-Subscription-Key": subscriptionKey, "X-Reference-Id": reference, "X-Target-Environment": target, "Content-Type": "application/json", "X-Callback-Url": url + "/functions/v1/momo-pay-callback?transactionId=" + encodeURIComponent(payment.id) },
      body: JSON.stringify({ amount: String(payment.amount_rwf), currency: "RWF", externalId: payment.id, payer: { partyIdType: "MSISDN", partyId: phone }, payerMessage: "UmurimoHub contract payment", payeeNote: "Contract " + payment.contract_id }),
    });
    if (providerResponse.status !== 202) {
      await admin.from("payment_transactions").update({ status: "failed", failure_reason: "Provider rejected request", failed_at: new Date().toISOString() }).eq("id", payment.id).in("status", ["pending", "processing"]);
      return reply({ error: "MoMo Pay rejected the request. Check the phone number and provider account." }, 502);
    }
    await admin.from("payment_transactions").update({ status: "processing", provider_reference: reference, provider_transaction_id: reference, metadata: { provider: "MTN MoMo Collection API", target_environment: target } }).eq("id", payment.id).in("status", ["pending", "processing"]);
    return reply({ configured: true, status: "processing", paymentTransactionId: payment.id, message: "Approve the mobile-money prompt on the payer's phone." }, 202);
  } catch (error) { console.error("MoMo initiation failed", error); return reply({ error: "MoMo Pay is temporarily unavailable. No payment success has been recorded." }, 502); }
});