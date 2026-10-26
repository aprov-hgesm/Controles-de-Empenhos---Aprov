import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import firebaseConfig from '../../../../firebase-applet-config.json';
import { getGoogleAccessToken } from '../../../../lib/server/sectorProvisioningAdmin';
import { createRequestSecurityContext, enforceBestEffortBurstLimit, readBoundedJsonRequest } from '../../../../lib/server/requestSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value.normalize('NFC').trim().replace(/\s+/g, ' ').slice(0, max + 1)
    : '';
}
function field(value: string) { return { stringValue: value }; }

export async function POST(request: Request) {
  const security = createRequestSecurityContext(request, 'public-access-request');
  try {
    enforceBestEffortBurstLimit(security, 'lead:'+security.clientKey, 6, 60_000);
    const input = await readBoundedJsonRequest<Record<string, unknown>>(request, security, 4096);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 });
    }
    // Campo oculto preenchido por robôs: resposta neutra, sem persistência.
    if (clean(input.website, 300)) return NextResponse.json({ ok: true });
    const nomeCompleto = clean(input.nomeCompleto, 140);
    const patente = clean(input.patente, 80);
    const organizacaoMilitar = clean(input.organizacaoMilitar, 160);
    const email = clean(input.email, 254).toLowerCase();
    const whatsapp = clean(input.whatsapp, 22);
    if (nomeCompleto.length < 5 || nomeCompleto.split(/\s+/).length < 2
       || !patente || patente.length > 80 || organizacaoMilitar.length < 3
       || organizacaoMilitar.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
       || email.length > 254 || !/^\+55[1-9][0-9]{9,10}$/.test(whatsapp)) {
      return NextResponse.json({ ok: false, error: 'Confira os campos e tente novamente.' }, { status: 400 });
    }
    const id = createHash('sha256').update(email).digest('hex');
    const now = new Date().toISOString();
    const api = 'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(firebaseConfig.projectId)
      +'/databases/'+encodeURIComponent(firebaseConfig.firestoreDatabaseId)
      +'/documents/platformAccessRequests?documentId='+id;
    const token = await getGoogleAccessToken();
    const saved = await fetch(api, {
      method: 'POST', cache: 'no-store',
      headers: { Authorization: 'Bearer '+token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        nomeCompleto: field(nomeCompleto), patente: field(patente),
        organizacaoMilitar: field(organizacaoMilitar), email: field(email),
        whatsapp: field(whatsapp), source: field('emprovex-institucional'),
        status: field('novo'), createdAt: { timestampValue: now },
        updatedAt: { timestampValue: now },
      }}),
    });
    // Formulário idempotente por e-mail: repetição não altera o histórico do atendimento.
    if (saved.status === 409 || saved.ok) return NextResponse.json({ ok: true }, { headers: {'Cache-Control':'no-store'} });
    console.error('EMPROVEX_PUBLIC_LEAD_WRITE_FAILED', { status: saved.status, requestId: security.requestId });
    return NextResponse.json({ ok: false, error: 'Não foi possível receber a solicitação. Tente novamente.' }, { status: 503 });
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'httpStatus' in error
      ? Number((error as { httpStatus?: number }).httpStatus) : 503;
    const httpStatus = [400, 413, 429].includes(status) ? status : 503;
    return NextResponse.json(
      { ok: false, error: httpStatus === 429 ? 'Muitas solicitações. Aguarde e tente novamente.' : 'Não foi possível processar a solicitação.' },
      { status: httpStatus, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
