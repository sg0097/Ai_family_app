import { env } from './env.js';

export interface Email {
  to: string;
  subject: string;
  text: string;
}

/** Send an email. In development it's printed to the server log instead (links included). */
export async function sendEmail(email: Email): Promise<void> {
  if (env.EMAIL_PROVIDER === 'fake' || !env.RESEND_API_KEY) {
    console.log(`[email:fake] to ${email.to} — ${email.subject}\n${email.text}\n`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
}
