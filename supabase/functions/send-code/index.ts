// Supabase Edge Function: send-code
// Sends a verification code to the given email using Gmail SMTP.
// Required env vars (set as Supabase secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
//
// Expected payload: { email: string, confirmEmail?: string }
// Response: { ok: true } on success.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabaseClient.ts";
import { sendEmail } from "../_shared/mailer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CODES_TABLE = "waitlist_codes";
const CODE_TTL_MINUTES = 15;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

function randomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch (_) {
    return json(400, { error: "invalid_json" });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const confirm = payload.confirmEmail ? String(payload.confirmEmail || "").trim().toLowerCase() : email;
  if (!email || !confirm) return json(400, { error: "missing_email" });
  if (email !== confirm) return json(400, { error: "emails_do_not_match" });

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    console.error("[send-code] env error", err);
    return json(500, { error: "missing_env_vars" });
  }

  const code = randomCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

  try {
    const { error } = await supabase
      .from(CODES_TABLE)
      .upsert(
        { email, code, expires_at: expiresAt, used: false, created_at: new Date().toISOString() },
        { onConflict: "email" },
      );
    if (error) {
      console.error("[send-code] upsert error", error);
      return json(500, { error: "db_error" });
    }
  } catch (err) {
    console.error("[send-code] db exception", err);
    return json(500, { error: "db_exception" });
  }

  const subject = "Your NEXCONET verification code";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 520px;">
      <h2 style="margin: 0 0 12px;">Your verification code</h2>
      <p style="margin: 0 0 12px;">Use this code to verify your email for NEXCONET waitlist access:</p>
      <p style="display: inline-block; padding: 12px 16px; background: #0ea5e9; color: #fff; font-weight: 700; letter-spacing: 1px; border-radius: 8px;">
        ${code}
      </p>
      <p style="margin: 16px 0 12px;">This code expires in ${CODE_TTL_MINUTES} minutes.</p>
      <p style="margin: 16px 0 0;">Thanks,<br/>The NEXCONET Team</p>
    </div>
  `;
  const text = [
    "Your verification code",
    `Code: ${code}`,
    `Expires in ${CODE_TTL_MINUTES} minutes.`,
    "",
    "Thanks,",
    "The NEXCONET Team",
  ].join("\n");

  try {
    await sendEmail({ to: email, subject, html, text });
  } catch (err) {
    console.error("[send-code] mail send error", err);
    return json(500, { error: "email_send_failed" });
  }

  return json(200, { ok: true });
});
