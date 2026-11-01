import { NextResponse } from 'next/server';
import firebaseConfig from '../../../../firebase-applet-config.json';
import { getGoogleAccessToken } from '../../../../lib/server/sectorProvisioningAdmin';
import { verifyFounderFirebaseRequest } from '../../../../lib/server/firebaseFounderAuth';
import {
  listAccessRequestPage, parseAccessRequestPatch, validAccessRequestPageToken,
} from '../../../../lib/server/accessRequestSupport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireFounder(request: Request) {
  return verifyFounderFirebaseRequest(request.headers.get('authorization'));
}

function baseUrl(): string {
  return 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(firebaseConfig.projectId)
    + '/databases/' + encodeURIComponent(firebaseConfig.firestoreDatabaseId)
    + '/documents/platformAccessRequests';
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
function securityFailure(error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error
    ? Number((error as { status?: number }).status) : 503;
  return json({
    ok: false,
    error: status === 401 || status === 403
      ? 'Acesso administrativo não autorizado.' : 'Serviço indisponível.',
  }, status === 401 || status === 403 ? status : 503);
}

export async function GET(request: Request) {
  try {
    await requireFounder(request);
    const pageToken = new URL(request.url).searchParams.get('pageToken');
    if (!validAccessRequestPageToken(pageToken)) {
      return json({ ok: false, error: 'Página inválida.' }, 400);
    }
    const token = await getGoogleAccessToken();
    const page = await listAccessRequestPage(baseUrl(), token, pageToken);
    return json({ ok: true, ...page });
  } catch (error) { return securityFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    await requireFounder(request);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
      return json({ ok: false, error: 'Conteúdo JSON obrigatório.' }, 400);
    }
    const declaredLength = Number(request.headers.get('content-length') || '0');
    if (declaredLength > 4096) return json({ ok: false, error: 'Dados muito extensos.' }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 4096) {
      return json({ ok: false, error: 'Dados muito extensos.' }, 413);
    }
    let input: unknown;
    try { input = JSON.parse(raw); }
    catch { return json({ ok: false, error: 'JSON inválido.' }, 400); }
    const patch = parseAccessRequestPatch(input, new Date().toISOString());
    if (!patch) return json({ ok: false, error: 'Dados inválidos.' }, 400);
    const token = await getGoogleAccessToken();
    const params = new URLSearchParams();
    for (const path of patch.fieldPaths) params.append('updateMask.fieldPaths', path);
    params.set('currentDocument.updateTime', patch.version);
    const response = await fetch(baseUrl() + '/' + patch.id + '?' + params.toString(), {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: patch.fields }),
      cache: 'no-store',
    });
    if (!response.ok) {
      return json({
        ok: false,
        error: response.status === 412
          ? 'Esta solicitação foi atualizada por outra sessão. Atualize a lista.'
          : 'Falha ao salvar o atendimento.',
      }, response.status === 412 ? 409 : 503);
    }
    return json({ ok: true });
  } catch (error) { return securityFailure(error); }
}
