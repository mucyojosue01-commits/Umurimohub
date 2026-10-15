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
  if (!payment) return reply({ error: "Payment not found." }, 404);
  if (payment.payer_user_id !== user.id) return reply({ error: "Only the payer can verify provider status." }, 403);
  if (!["pending", "processing"].includes(payment.status)) return reply({ status: payment.status });
  if (!payment.provider_reference) return reply({ status: payment.status, configured: false, message: "Payment has not been submitted to MoMo Pay yet." });
  const sub = Deno.env.get("MOMO_SUBSCRIPTION_KEY"), apiUser = Deno.env.get("MOMO_API_USER"), apiKey = Deno.env.get("MOMO_API_KEY");
  if (!sub || !apiUser || !apiKey) return reply({ status: payment.status, configured: false, message: "MoMo Pay credentials are not configured." });
  const base = (Deno.env.get("MOMO_BASE_URL") || "https://sandbox.momodeveloper.mtn.com").replace(/\/$/, "");
  const target = Deno.env.get("MOMO_TARGET_ENVIRONMENT") || "sandbox";
  try {
    const tr = await fetch(base + "/collection/token/", { method: "POST", headers: { Authorization: "Basic " + btoa(apiUser + ":" + apiKey), "Ocp-Apim-Subscription-Key": sub, "X-Target-Environment": target } });
    if (!tr.ok) return reply({ error: "Could not authenticate with MoMo Pay." }, 502);
    const token = await tr.json();
    const sr = await fetch(base + "/collection/v1_0/requesttopay/" + encodeURIComponent(payment.provider_reference), { headers: { Authorization: "Bearer " + token.access_token, "Ocp-Apim-Subscription-Key": sub, "X-Target-Environment": target } });
    if (!sr.ok) return reply({ error: "Could not verify payment status with MoMo Pay." }, 502);
    const provider = await sr.json(), providerStatus = String(provider.status || "").toUpperCase();
    let nextStatus: string | null = null;
    if (["SUCCESSFUL", "SUCCESS"].includes(providerStatus)) nextStatus = "paid";
    if (["FAILED", "REJECTED"].includes(providerStatus)) nextStatus = "failed";
    if (nextStatus) {
      const patch = nextStatus === "paid" ? { status: "paid", paid_at: new Date().toISOString(), failure_reason: null } : { status: "failed", failed_at: new Date().toISOString(), failure_reason: "Provider reported payment failure" };
      const { data: changed } = await admin.from("payment_transactions").update(patch).eq("id", payment.id).in("status", ["pending", "processing"]).select("id").maybeSingle();
      if (changed && nextStatus === "paid") {
        const { data: c } = await admin.from("contracts").select("title,worker_id,team_id").eq("id", payment.contract_id).maybeSingle();
        const title = c?.title || "your contract";
        const notices = [{ user_id: user.id, kind: "payment_paid", text: "MoMo Pay confirmed " + payment.amount_rwf + " RWF for " + title + ".", link: "/contracts/" + payment.contract_id }];
        if (c?.worker_id) { const { data: w } = await admin.from("worker_profiles").select("user_id").eq("id", c.worker_id).maybeSingle(); if (w?.user_id && w.user_id !== user.id) notices.push({ user_id: w.user_id, kind: "payment_paid", text: "MoMo Pay received " + payment.amount_rwf + " RWF for " + title + ".", link: "/contracts/" + payment.contract_id }); }
        else if (c?.team_id) { const { data: t } = await admin.from("teams").select("lead_user_id").eq("id", c.team_id).maybeSingle(); if (t?.lead_user_id && t.lead_user_id !== user.id) notices.push({ user_id: t.lead_user_id, kind: "payment_paid", text: "MoMo Pay received " + payment.amount_rwf + " RWF for " + title + ".", link: "/contracts/" + payment.contract_id }); }
        await admin.from("notifications").insert(notices);
      }
      return reply({ status: nextStatus, providerStatus });
    }
    return reply({ status: payment.status, providerStatus });
  } catch (error) { console.error("MoMo status check failed", error); return reply({ error: "Could not verify provider status." }, 502); }
});