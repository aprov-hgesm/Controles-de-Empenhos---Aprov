import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import {
  assertEmpenhoPath,
  documentValidationErrorResponse,
  isBlobConfigured,
  isEmpenhoDocumentFeatureEnabled,
  MAX_EMPENHO_PDF_BYTES,
  normalizeEmpenhoId,
} from '../../../../lib/server/empenhoDocumentSecurity';
import {
  authenticationErrorResponse,
  requireAuthorizedFirebaseUser,
} from '../../../../lib/server/firebaseIdToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UploadClientPayload {
  empenhoId: string;
}

function configurationError(): Response | null {
  if (!isEmpenhoDocumentFeatureEnabled()) {
    return Response.json(
      { error: 'Armazenamento de documentos ainda não foi habilitado.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (!isBlobConfigured()) {
    return Response.json(
      { error: 'Vercel Blob privado ainda não foi conectado ao projeto.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return null;
}

export async function POST(request: Request): Promise<Response> {
  const configurationFailure = configurationError();
  if (configurationFailure) return configurationFailure;

  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        await requireAuthorizedFirebaseUser(request);

        let payload: UploadClientPayload;
        try {
          payload = JSON.parse(clientPayload || '') as UploadClientPayload;
        } catch {
          throw new Error('Dados de upload inválidos.');
        }

        const empenhoId = normalizeEmpenhoId(payload.empenhoId);
        assertEmpenhoPath(pathname, empenhoId);

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: MAX_EMPENHO_PDF_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 60,
        };
      },
    });

    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const authenticationFailure = authenticationErrorResponse(error);
    if (authenticationFailure) return authenticationFailure;

    const validationFailure = documentValidationErrorResponse(error);
    if (validationFailure) return validationFailure;

    console.error('Falha ao autorizar upload de nota de empenho.');
    return Response.json(
      { error: 'Não foi possível autorizar o envio do PDF.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
