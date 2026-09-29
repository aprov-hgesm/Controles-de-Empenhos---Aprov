'use client';

import { getGoogleOAuthClientId } from './googleDriveWorkspace';
import { normalizePlatformEmail } from './platformIdentity';

export const GOOGLE_GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const GOOGLE_USERINFO_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const GOOGLE_MAIL_SCOPES = GOOGLE_GMAIL_SEND_SCOPE + ' ' + GOOGLE_USERINFO_EMAIL_SCOPE;
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

interface GoogleOAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleOAuthTokenClient {
  requestAccessToken(config?: {
    prompt?: string;
    scope?: string;
    include_granted_scopes?: boolean;
    login_hint?: string;
  }): void;
}

interface GoogleOAuth2Api {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    include_granted_scopes?: boolean;
    prompt?: string;
    login_hint?: string;
    callback: (response: GoogleOAuthTokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }): GoogleOAuthTokenClient;
}

type GoogleIdentityWindow = Window & {
  google?: {
    accounts?: {
      oauth2?: GoogleOAuth2Api;
    };
  };
};

interface GmailRuntime {
  workspaceId: string;
  email: string;
  accessToken: string;
  expiresAtMs: number;
}

export interface WorkspaceGmailSendInput {
  workspaceId: string;
  expectedSenderEmail: string;
  to: string;
  subject: string;
  bodyText: string;
  attachment: Blob;
  attachmentName: string;
}

export interface WorkspaceGmailSendResult {
  messageId: string;
  threadId?: string;
  senderEmail: string;
}

let activeGmailRuntime: GmailRuntime | null = null;

function assertHeaderSafe(value: string, label: string): string {
  const sanitized = value.trim();
  if (!sanitized || /[\r\n]/.test(sanitized)) {
    throw new Error(label + ' inválido para envio de e-mail.');
  }
  return sanitized;
}

function normalizeRecipientEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('O fornecedor não possui um e-mail válido para envio.');
  }
  return email;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function utf8Base64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

function base64UrlFromUtf8(value: string): string {
  return utf8Base64(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function requestGmailAccessToken(
  workspaceId: string,
  expectedEmailInput: string
): Promise<GmailRuntime> {
  if (typeof window === 'undefined') {
    throw new Error('A autorização do Gmail precisa ser iniciada no navegador.');
  }

  const expectedEmail = normalizePlatformEmail(expectedEmailInput);
  if (!expectedEmail) {
    throw new Error('A conta configurada no Google Drive não possui e-mail válido.');
  }

  if (
    activeGmailRuntime
    && activeGmailRuntime.workspaceId === workspaceId
    && activeGmailRuntime.email === expectedEmail
    && activeGmailRuntime.expiresAtMs - TOKEN_EXPIRY_SAFETY_MS > Date.now()
  ) {
    return activeGmailRuntime;
  }

  const oauth2 = (window as GoogleIdentityWindow).google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('O serviço de autorização do Google ainda está carregando. Aguarde alguns segundos e tente novamente.');
  }

  const token = await new Promise<{ accessToken: string; expiresAtMs: number }>((resolve, reject) => {
    let settled = false;
    const rejectOnce = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    const client = oauth2.initTokenClient({
      client_id: getGoogleOAuthClientId(),
      scope: GOOGLE_MAIL_SCOPES,
      include_granted_scopes: false,
      prompt: 'select_account',
      login_hint: expectedEmail,
      callback: (response) => {
        if (settled) return;
        if (response.error) {
          rejectOnce(
            response.error_description?.trim()
            || 'O Google não autorizou o envio de e-mail pelo EMPROVEX.'
          );
          return;
        }
        if (!response.access_token) {
          rejectOnce('O Google não retornou autorização temporária para a Gmail API.');
          return;
        }
        const expiresInSeconds = Number(response.expires_in);
        if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
          rejectOnce('O Google não informou a validade da autorização temporária do Gmail.');
          return;
        }
        settled = true;
        resolve({
          accessToken: response.access_token,
          expiresAtMs: Date.now() + expiresInSeconds * 1000,
        });
      },
      error_callback: (error) => {
        if (error.type === 'popup_closed') {
          rejectOnce('A janela de autorização do Gmail foi fechada antes da conclusão.');
          return;
        }
        if (error.type === 'popup_failed_to_open') {
          rejectOnce('O navegador bloqueou a janela de autorização do Gmail. Permita pop-ups e tente novamente.');
          return;
        }
        rejectOnce('Não foi possível abrir a autorização do Gmail.');
      },
    });

    client.requestAccessToken({
      prompt: 'select_account',
      scope: GOOGLE_MAIL_SCOPES,
      include_granted_scopes: false,
      login_hint: expectedEmail,
    });
  });

  const identityResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: 'Bearer ' + token.accessToken },
    cache: 'no-store',
  });
  if (!identityResponse.ok) {
    throw new Error('Não foi possível confirmar a Conta Google autorizada para o envio.');
  }
  const identity = (await identityResponse.json()) as { email?: string };
  const authorizedEmail = normalizePlatformEmail(identity.email || '');

  if (authorizedEmail !== expectedEmail) {
    throw new Error(
      'A Conta Google selecionada para o Gmail não corresponde à conta configurada no Drive deste setor. '
      + 'Selecione ' + expectedEmail + ' e tente novamente.'
    );
  }

  activeGmailRuntime = {
    workspaceId,
    email: authorizedEmail,
    accessToken: token.accessToken,
    expiresAtMs: token.expiresAtMs,
  };
  return activeGmailRuntime;
}

function encodedWord(value: string): string {
  return '=?UTF-8?B?' + utf8Base64(value) + '?=';
}

async function buildRawMimeMessage(input: WorkspaceGmailSendInput, senderEmail: string): Promise<string> {
  const recipient = normalizeRecipientEmail(input.to);
  const subject = assertHeaderSafe(input.subject, 'Assunto');
  const attachmentName = assertHeaderSafe(input.attachmentName, 'Nome do anexo');
  const boundary = 'emprovex_' + crypto.randomUUID().replace(/-/g, '');
  const attachmentBytes = new Uint8Array(await input.attachment.arrayBuffer());
  const attachmentBase64 = bytesToBase64(attachmentBytes);

  const lines = [
    'From: ' + senderEmail,
    'To: ' + recipient,
    'Subject: ' + encodedWord(subject),
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    utf8Base64(input.bodyText),
    '',
    '--' + boundary,
    'Content-Type: application/pdf; name="' + attachmentName + '"',
    'Content-Disposition: attachment; filename="' + attachmentName + '"',
    'Content-Transfer-Encoding: base64',
    '',
    attachmentBase64,
    '',
    '--' + boundary + '--',
    '',
  ];

  return base64UrlFromUtf8(lines.join('\r\n'));
}

async function readGmailError(response: Response): Promise<never> {
  let message = '';
  try {
    const payload = (await response.json()) as { error?: { message?: string; status?: string } };
    message = payload.error?.message || '';
  } catch {
    // Resposta sem JSON útil.
  }

  if (response.status === 401) {
    activeGmailRuntime = null;
    throw new Error('A autorização temporária do Gmail expirou. Tente enviar novamente.');
  }
  if (response.status === 403 && /accessNotConfigured|disabled|has not been used/i.test(message)) {
    throw new Error('A Gmail API ainda não está habilitada no projeto Google Cloud do EMPROVEX.');
  }
  throw new Error(message || 'O Gmail recusou o envio do cronograma.');
}

export async function authorizeWorkspaceGmail(
  workspaceId: string,
  expectedSenderEmail: string
): Promise<{ senderEmail: string }> {
  const runtime = await requestGmailAccessToken(workspaceId, expectedSenderEmail);
  return { senderEmail: runtime.email };
}

export async function sendWorkspaceGmailMessage(
  input: WorkspaceGmailSendInput
): Promise<WorkspaceGmailSendResult> {
  const runtime = await requestGmailAccessToken(input.workspaceId, input.expectedSenderEmail);
  const raw = await buildRawMimeMessage(input, runtime.email);

  const response = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + runtime.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
    cache: 'no-store',
  });

  if (!response.ok) await readGmailError(response);
  const payload = (await response.json()) as { id?: string; threadId?: string };
  if (!payload.id) {
    throw new Error('O Gmail não retornou o identificador da mensagem enviada.');
  }

  return {
    messageId: payload.id,
    threadId: payload.threadId,
    senderEmail: runtime.email,
  };
}
