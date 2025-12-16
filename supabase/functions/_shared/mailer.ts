// Gmail SMTP mailer for Supabase Edge Functions (Deno runtime).
// Required env vars (set as Supabase function secrets):
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587        # or 465 if you prefer implicit TLS
//   SMTP_USER=nexconet.official@gmail.com
//   SMTP_PASS=yrovsrrwcorjoshl  // Google App Password without spaces
//   MAIL_FROM="NEXCONET Beta <nexconet.official@gmail.com>"
// These values are read at runtime; keep secrets in Supabase, not in source.

import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";
import { writeAll } from "https://deno.land/std@0.177.0/streams/write_all.ts";

// smtp client expects deprecated Deno.writeAll (removed in Deno 2). Provide shim.
if (!(Deno as any).writeAll) {
  (Deno as any).writeAll = writeAll;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const host = getEnv("SMTP_HOST");
  const portRaw = getEnv("SMTP_PORT");
  const port = Number(portRaw);
  const user = getEnv("SMTP_USER");
  const pass = getEnv("SMTP_PASS");
  const from = Deno.env.get("MAIL_FROM") ?? user;

  if (!Number.isFinite(port)) {
    throw new Error(`Invalid SMTP_PORT: ${portRaw}`);
  }

  const client = new SmtpClient();
  const connect = async () => {
    if (port === 465) {
      await client.connectTLS({ hostname: host, port, username: user, password: pass });
    } else {
      // Gmail supports STARTTLS on 587
      await client.connect({ hostname: host, port, username: user, password: pass });
    }
  };

  try {
    await connect();
    await client.send({
      from,
      to,
      subject,
      content: text,
      html,
    });
  } catch (err) {
    console.error("[mailer] send failed", err);
    throw err;
  } finally {
    try {
      await client.close();
    } catch (_) {
      // ignore close errors
    }
  }
}
