import { del, get } from '@vercel/blob';
import {
  assertEmpenhoPath,
  documentValidationErrorResponse,
  isBlobConfigured,
  normalizeEmpenhoId,
} from '../../../../lib/server/empenhoDocumentSecurity';
import {
  assertInvoiceUploadPath,
  normalizeInvoiceId,
} from '../../../../lib/server/invoiceDocumentSecurity';
import {
  authenticationErrorResponse,
  requireAuthorizedFirebaseUser,
} from '../../../../lib/server/firebaseIdToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BlobDocumentKind = 'empenho' | 'invoice';

interface DecommissionRequestBody {
  kind?: unknown;
  empenhoId?: unknown;
  invoiceId?: unknown;
  pathname?: unknown;
}

function configurationError(): Response | null {
  if (!isBlobConfigured()) {
    return Response.json(
      { error: 'O Vercel Blob legado não está disponível neste ambiente.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return null;
}

function normalizeKind(value: unknown): BlobDocumentKind {
  if (value === 'empenho' || value === 'invoice') return value;
  throw new Error('Tipo de documento inválido para descomissionamento.');
}

function assertLegacyPath(body: DecommissionRequestBody): {
  kind: BlobDocumentKind;
  empenhoId: string;
  invoiceId?: string;
  pathname: string;
} {
  const kind = normalizeKind(body.kind);
  const empenhoId = normalizeEmpenhoId(body.empenhoId);

  if (kind === 'empenho') {
    return {
      kind,
      empenhoId,
      pathname: assertEmpenhoPath(body.pathname, empenhoId),
    };
  }

  const invoiceId = normalizeInvoiceId(body.invoiceId);
  return {
    kind,
    empenhoId,
    invoiceId,
    pathname: assertInvoiceUploadPath(body.pathname, empenhoId, invoiceId),
  };
}

async function blobExists(pathname: string): Promise<boolean> {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return false;
  await result.stream.cancel().catch(() => undefined);
  return true;
}

async function verifyDeleted(pathname: string): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!(await blobExists(pathname))) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

export async function POST(request: Request): Promise<Response> {
  const configurationFailure = configurationError();
  if (configurationFailure) return configurationFailure;

  try {
    await requireAuthorizedFirebaseUser(request);
    const body = (await request.json()) as DecommissionRequestBody;
    const target = assertLegacyPath(body);

    const existedBefore = await blobExists(target.pathname);
    if (existedBefore) {
      await del(target.pathname);
    }

    const deleted = await verifyDeleted(target.pathname);
    if (!deleted) {
      return Response.json(
        { error: 'A cópia legada ainda foi encontrada no Blob após a exclusão.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return Response.json(
      {
        status: existedBefore ? 'deleted' : 'already-missing',
        pathname: target.pathname,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const authenticationFailure = authenticationErrorResponse(error);
    if (authenticationFailure) return authenticationFailure;

    const validationFailure = documentValidationErrorResponse(error);
    if (validationFailure) return validationFailure;

    console.error('Falha no descomissionamento controlado do Vercel Blob.', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Não foi possível remover a cópia legada do Blob.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
