// Gmail SMTP mailer for beta invite codes.
// Reads credentials from environment variables (e.g. .env.local or hosting config):
// SMTP_HOST=smtp.gmail.com
// SMTP_PORT=587
// SMTP_USER=nexconet.official@gmail.com
// SMTP_PASS=yrovsrrwcorjoshl  // Google App Password (spaces removed)
// MAIL_FROM="NEXCONET Beta <nexconet.official@gmail.com>"
// Keep the App Password in env only; do not hardcode secrets in source.

import nodemailer from 'nodemailer';

let cachedTransporter = null;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass || Number.isNaN(port)) {
    throw new Error('Missing SMTP configuration (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)');
  }

  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    requireTLS: true,
  });

  return cachedTransporter;
}

export async function sendBetaInvite(email, code) {
  if (!email || !code) {
    throw new Error('email and code are required to send a beta invite');
  }

  const to = String(email).trim();
  const inviteCode = String(code).trim();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const subject = 'Your NEXCONET beta invite';

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 560px;">
      <h2 style="margin: 0 0 12px;">Your NEXCONET beta invite</h2>
      <p style="margin: 0 0 12px;">Hi there,</p>
      <p style="margin: 0 0 12px;">Here is your beta invite code:</p>
      <p style="display: inline-block; padding: 12px 16px; background: #0ea5e9; color: #ffffff; font-weight: 700; letter-spacing: 1px; border-radius: 8px;">
        ${inviteCode}
      </p>
      <p style="margin: 16px 0 12px;">Paste this code into the invite prompt in the app to unlock beta access.</p>
      <p style="margin: 16px 0 0;">Thanks,<br/>The NEXCONET Team</p>
    </div>
  `;

  const text = [
    'Your NEXCONET beta invite',
    '',
    'Hi there,',
    'Here is your beta invite code:',
    inviteCode,
    '',
    'Paste this code into the invite prompt in the app to unlock beta access.',
    '',
    'Thanks,',
    'The NEXCONET Team',
  ].join('\n');

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('[sendBetaInvite] failed to send invite email', err);
    throw err;
  }
}

export default sendBetaInvite;
