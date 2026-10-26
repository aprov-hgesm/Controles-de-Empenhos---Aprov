import { NextResponse } from 'next/server';
import firebaseConfig from '../../../../firebase-applet-config.json';
import { getGoogleAccessToken } from '../../../../lib/server/sectorProvisioningAdmin';
import { verifyFounderFirebaseRequest } from '../../../../lib/server/firebaseFounderAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const VALID_STATUS = new Set(['novo','contatado','em_teste','concluido','descartado']);

type FirestoreValue = { stringValue?: string; timestampValue?: string };
type FirestoreDocument = { name: string; fields?: Record<string, FirestoreValue>; updateTime?: string };
const field = (record: FirestoreDocument, key: string): string =>
  record.fields?.[key]?.stringValue || record.fields?.[key]?.timestampValue || '';

async function requireFounder(request: Request) {
  return verifyFounderFirebaseRequest(request.headers.get('authorization'));
}
function baseUrl(): string {
  return 'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(firebaseConfig.projectId)
    +'/databases/'+encodeURIComponent(firebaseConfig.firestoreDatabaseId)
    +'/documents/platformAccessRequests';
}
function securityFailure(error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error
    ? Number((error as { status?: number }).status) : 503;
  return NextResponse.json({ ok: false, error: status === 401 || status === 403 ? 'Acesso administrativo não autorizado.' : 'Serviço indisponível.' },
    { status: status === 401 || status === 403 ? status : 503, headers: {'Cache-Control':'no-store'} });
}
export async function GET(request: Request) {
  try {
    await requireFounder(request);
    const token = await getGoogleAccessToken();
    const response = await fetch(baseUrl()+'?pageSize=100', {
      headers: { Authorization: 'Bearer '+token }, cache: 'no-store',
    });
    if (!response.ok) throw new Error('Falha na leitura administrativa: '+response.status);
    const data = await response.json() as { documents?: FirestoreDocument[] };
    const records = (data.documents || []).map(d => ({
      id: d.name.split('/').pop() || '',
      nomeCompleto: field(d, 'nomeCompleto'), patente: field(d, 'patente'),
      organizacaoMilitar: field(d, 'organizacaoMilitar'), email: field(d, 'email'),
      whatsapp: field(d, 'whatsapp'), status: field(d, 'status') || 'novo',
      createdAt: field(d, 'createdAt'), updatedAt: field(d, 'updatedAt'),
      version: d.updateTime || '',
    })).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ ok: true, records }, { headers: {'Cache-Control':'no-store'} });
  } catch (error) { return securityFailure(error); }
}
export async function PATCH(request: Request) {
  try {
    await requireFounder(request);
    const body = await request.json() as { id?: string; status?: string; version?: string };
    if (!body || !/^[a-f0-9]{64}$/.test(body.id || '') || !VALID_STATUS.has(body.status || '')
      || !body.version || !Number.isFinite(Date.parse(body.version))) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 });
    }
    const token = await getGoogleAccessToken();
    const now = new Date().toISOString();
    const url = baseUrl()+'/'+body.id+'?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt'
      +'&currentDocument.updateTime='+encodeURIComponent(body.version);
    const response = await fetch(url,{
      method:'PATCH', headers:{ Authorization:'Bearer '+token,'Content-Type':'application/json' },
      body: JSON.stringify({ fields: {
        status:{stringValue:body.status},updatedAt:{timestampValue:now}
      }}), cache:'no-store',
    });
    if (!response.ok) return NextResponse.json({ok:false,error:response.status===412?'A solicitação foi alterada. Atualize a lista.':'Falha ao salvar o atendimento.'},
      {status:response.status===412?409:503});
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  } catch (error) { return securityFailure(error); }
}
