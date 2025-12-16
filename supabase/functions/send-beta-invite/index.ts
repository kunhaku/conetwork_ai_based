import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabaseClient.ts";
import { corsHeaders, json, requireAdmin } from "../_shared/http.ts";
import { sendEmail } from "../_shared/mailer.ts";

const INVITES_TABLE = "beta_invites";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes O/0/I/1
const CODE_LENGTH = 8;
const MAX_CODE_ATTEMPTS = 5;

function randomInviteCode() {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    out += CODE_ALPHABET[idx];
  }
  return out;
}

async function generateUniqueCode(
  supabase: ReturnType<typeof getSupabaseClient>,
  email: string,
) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomInviteCode();
    const { data, error } = await supabase
      .from(INVITES_TABLE)
      .select("email")
      .eq("code", code)
      .neq("email", email)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[send-beta-invite] code lookup error", error);
      throw new Error("code_lookup_failed");
    }
    if (!data) return code;
  }
  throw new Error("code_collision");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "invalid", detail: "method_not_allowed" });
  }

  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  let payload: any = {};
  try {
    payload = await req.json();
  } catch (_) {
    return json(400, { ok: false, error: "invalid", detail: "invalid_json" });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const name = payload.name ? String(payload.name).trim() : "";
  const maxUsesRaw = payload.maxUses ?? payload.max_uses ?? 1;
  const maxUsesNumber = Number(maxUsesRaw);
  const maxUses = Number.isInteger(maxUsesNumber) && maxUsesNumber > 0 ? maxUsesNumber : 1;

  let expiresAt: string | null = null;
  if (payload.expiresAt || payload.expires_at) {
    const raw = String(payload.expiresAt || payload.expires_at);
    const d = new Date(raw);
    if (isNaN(d.getTime())) {
      return json(400, { ok: false, error: "invalid", detail: "invalid_expires_at" });
    }
    expiresAt = d.toISOString();
  }

  if (!email) {
    return json(400, { ok: false, error: "invalid", detail: "missing_email" });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    console.error("[send-beta-invite] env error", err);
    return json(500, { ok: false, error: "invalid", detail: "missing_env_vars" });
  }

  let code = "";
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      code = await generateUniqueCode(supabase, email);
    } catch (err) {
      if (String(err?.message || err) === "code_collision" && attempt < MAX_CODE_ATTEMPTS - 1) {
        continue;
      }
      console.error("[send-beta-invite] generate code error", err);
      return json(500, { ok: false, error: "invalid", detail: "code_generation_failed" });
    }

    const { error } = await supabase.from(INVITES_TABLE).upsert(
      {
        email,
        code,
        max_uses: maxUses,
        expires_at: expiresAt,
        used_count: 0,
        is_revoked: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

    if (!error) break;

    const isCollision = (error.message || "").toLowerCase().includes("beta_invites_code_key");
    if (!isCollision) {
      console.error("[send-beta-invite] upsert error", error);
      return json(500, { ok: false, error: "invalid", detail: "db_error" });
    }
    if (attempt === MAX_CODE_ATTEMPTS - 1) {
      console.error("[send-beta-invite] collision after retries", error);
      return json(500, { ok: false, error: "invalid", detail: "code_collision" });
    }
  }

  const subject = "Your NEXCONET invite code";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 520px;">
      <p style="margin: 0 0 12px;">Hi${name ? ` ${name}` : ""},</p>
      <p style="margin: 0 0 12px;">Here is your beta invite code for NEXCONET:</p>
      <p style="display: inline-block; padding: 12px 16px; background: #0ea5e9; color: #fff; font-weight: 700; letter-spacing: 1px; border-radius: 8px; font-size: 18px;">
        ${code}
      </p>
      <p style="margin: 16px 0 12px;">Use this code with your email (${email}) to unlock beta access. Each code can be used up to ${maxUses} time(s)${expiresAt ? ` before ${new Date(expiresAt).toUTCString()}` : ""}.</p>
      <ol style="margin: 0 0 12px 18px; padding: 0; color: #0f172a;">
        <li>Go to the NEXCONET beta gate.</li>
        <li>Enter your email and the invite code above.</li>
        <li>Enjoy early access and share feedback.</li>
      </ol>
      <p style="margin: 16px 0 0;">Thanks for being part of the beta!<br/>The NEXCONET Team</p>
    </div>
  `;
  const text = [
    `Hi${name ? ` ${name}` : ""},`,
    "Here is your NEXCONET beta invite code:",
    `Code: ${code}`,
    `Email: ${email}`,
    `Max uses: ${maxUses}`,
    expiresAt ? `Expires: ${new Date(expiresAt).toUTCString()}` : "",
    "",
    "Use this code with your email to access the beta.",
    "Thanks for joining!",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendEmail({ to: email, subject, html, text });
  } catch (err) {
    console.error("[send-beta-invite] mail send error", err);
    return json(500, { ok: false, error: "email_send_failed", detail: "smtp_failed" });
  }

  return json(200, { ok: true, email, code, maxUses, expiresAt });
});
