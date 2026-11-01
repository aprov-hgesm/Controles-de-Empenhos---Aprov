/**
 * API Gmail R1 (envio de cronograma ja usa Gmail no navegador).
 * Aqui OAuth offline, consentido pelo dono, sem Firebase SDK nem token do browser.
 */
import { Buffer } from 'node:buffer';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const IDENTITY_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

function environment(name: string) {
  const value = process.env[name]?.trim();
  if (!value || /[\r\n]/.test(value)) throw new Error('ADMIN_DIGEST_GMAIL_CONFIG_' + name);
  return value;
}

function validEmail(value: string) {
  const e = value.trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e)) throw new Error('ADMIN_DIGEST_GMAIL_EMAIL_INVALID');
  return e;
}

export function makeGmailMessage(input: { from: string; to: string; subject: string; text: string }) {
  const from = validEmail(input.from);
  const to = validEmail(input.to);
  if (!input.subject || /[\r\n]/.test(input.subject) || input.subject.length > 240
      || input.text.length > 20000) throw new Error('ADMIN_DIGEST_GMAIL_MESSAGE_INVALID');
  const mime = [
    'From: ' + from,
    'To: ' + to,
    'Subject: =?UTF-8?B?' + Buffer.from(input.subject).toString('base64') + '?=',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(input.text, 'utf8').toString('base64'),
    '',
  ].join('\r\n');
  return Buffer.from(mime, 'utf8').toString('base64url');
}

export async function sendAdminDigestViaGmail(input: { from: string; to: string; subject: string; text: string }) {
  const from = validEmail(input.from);
  const raw = makeGmailMessage(input);
  const refreshed = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: environment('EMPROVEX_ADMIN_DIGEST_GMAIL_CLIENT_ID'),
      client_secret: environment('EMPROVEX_ADMIN_DIGEST_GMAIL_CLIENT_SECRET'),
      refresh_token: environment('EMPROVEX_ADMIN_DIGEST_GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (!refreshed.ok) throw new Error('ADMIN_DIGEST_GMAIL_REFRESH_' + refreshed.status);
  const credentials = await refreshed.json() as { access_token?: string };
  if (!credentials.access_token) throw new Error('ADMIN_DIGEST_GMAIL_TOKEN_MISSING');
  const headers = { Authorization: 'Bearer ' + credentials.access_token };
  const identityResponse = await fetch(IDENTITY_URL, {
    headers, cache: 'no-store', signal: AbortSignal.timeout(12000),
  });
  if (!identityResponse.ok) throw new Error('ADMIN_DIGEST_GMAIL_IDENTITY_' + identityResponse.status);
  const identity = await identityResponse.json() as { email?: string; email_verified?: boolean };
  if (!identity.email || validEmail(identity.email) !== from || identity.email_verified !== true) {
    throw new Error('ADMIN_DIGEST_GMAIL_SENDER_MISMATCH');
  }
  const sent = await fetch(SEND_URL, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
    cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  if (!sent.ok) throw new Error('ADMIN_DIGEST_GMAIL_SEND_' + sent.status);
  const data = await sent.json() as { id?: string };
  if (!data.id) throw new Error('ADMIN_DIGEST_GMAIL_SEND_NO_ID');
  return data.id;
}
