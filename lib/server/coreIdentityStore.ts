/**
 * Leitura AUTORITATIVA das identidades do banco principal pelo servidor.
 * O Firebase ID token autentica o solicitante, mas NUNCA é usado como
 * credencial de leitura privilegiada. Escopo de caminhos explicitamente restrito.
 */
import firebaseConfig from '../../firebase-applet-config.json';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';

export interface CoreIdentityDocument {
  fields?: Record<string, { stringValue?: string }>;
}

export class CoreIdentityStoreError extends Error {
  constructor(public readonly status: 403 | 503) {
    super('CORE_IDENTITY_STORE_UNAVAILABLE');
    this.name = 'CoreIdentityStoreError';
  }
}

function emulatorBase(): string | null {
  if (process.env.EMPROVEX_E2E_SERVER_AUTH !== '1') return null;
  const host = process.env.FIRESTORE_EMULATOR_HOST?.trim() || '';
  const projectId = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim() || '';
  if (process.env.NODE_ENV === 'production' ||
      !/^(?:127\.0\.0\.1|localhost):\d{2,5}$/.test(host) ||
      !projectId.startsWith('demo-')) {
    throw new CoreIdentityStoreError(503);
  }
  return 'http://' + host + '/v1/projects/' + encodeURIComponent(projectId)
    + '/databases/(default)/documents';
}

export async function readCoreIdentityDocument(path: string): Promise<CoreIdentityDocument | null> {
  const sections = path.split('/');
  // Nunca permitir que caminhos de documentos sejam definidos pelo navegador.
  const allowed = sections.length === 2
    && ((sections[0] === 'platformAccounts'
      && /^[^/@\s]+@[^/@\s]+\.[^/@\s]+$/.test(sections[1]))
      || (sections[0] === 'workspaces'
      && /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(sections[1])));
  if (!allowed) throw new CoreIdentityStoreError(403);

  const localBase = emulatorBase();
  const base = localBase || ('https://firestore.googleapis.com/v1/projects/'
    + encodeURIComponent(firebaseConfig.projectId) + '/databases/'
    + encodeURIComponent(firebaseConfig.firestoreDatabaseId) + '/documents');
  // No Emulator, a identidade administrativa "owner" ignora Rules como IAM.
  const token = localBase ? 'owner' : await getGoogleAccessToken();
  let response: Response;
  try {
    response = await fetch(base + '/' + sections.map(encodeURIComponent).join('/'), {
      headers: { authorization: 'Bearer ' + token },
      cache: 'no-store',
    });
  } catch {
    throw new CoreIdentityStoreError(503);
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new CoreIdentityStoreError(503);
  try {
    const doc = await response.json() as CoreIdentityDocument;
    if (!doc || typeof doc.fields !== 'object' || !doc.fields) {
      throw new CoreIdentityStoreError(503);
    }
    return doc;
  } catch {
    throw new CoreIdentityStoreError(503);
  }
}
