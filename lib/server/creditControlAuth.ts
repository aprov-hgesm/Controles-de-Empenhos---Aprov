import firebaseConfig from '../../firebase-applet-config.json';
import { verifyFirebaseRequest } from './firebaseFounderAuth';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';

export class CreditAccessError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export type CreditMember = {
  uid: string; email: string; ug: string; role: 'gestor' | 'centro'; centerId: string | null;
};
/** Module access is opt-in, server-only, and independent from existing workspace privileges. */
export async function requireCreditMember(request: Request, managerOnly = false): Promise<CreditMember> {
  if (process.env.EMPROVEX_CREDIT_CONTROL_ENABLED !== '1') {
    throw new CreditAccessError(503, 'Controle de Crédito ainda não habilitado neste ambiente.');
  }
  const identity = await verifyFirebaseRequest(request.headers.get('authorization'));
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(identity.uid) || !['password','google.com'].includes(identity.signInProvider)) {
    throw new CreditAccessError(403, 'Identidade não autorizada.');
  }
  const lookup = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(firebaseConfig.apiKey), {
    method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({idToken:identity.idToken}), cache:'no-store',
  });
  if (!lookup.ok) throw new CreditAccessError(401,'Sessão inválida ou expirada.');
  const current = (await lookup.json()).users?.[0];
  if (!current || current.disabled === true || current.emailVerified !== true || current.localId !== identity.uid
    || String(current.email).toLowerCase() !== identity.email) throw new CreditAccessError(403,'Identidade não autorizada.');
  const root = 'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(firebaseConfig.projectId)+'/databases/'+encodeURIComponent('emprovex-credito')+'/documents';
  const response = await fetch(root+'/creditControlMembers/'+encodeURIComponent(identity.uid), {
    headers:{authorization:'Bearer '+await getGoogleAccessToken()}, cache:'no-store',
  });
  if (response.status===404) throw new CreditAccessError(403,'Usuário sem acesso ao Controle de Crédito.');
  if (!response.ok) throw new CreditAccessError(503,'Não foi possível verificar a autorização.');
  const fields = (await response.json()).fields;
  const uid=fields?.uid?.stringValue, email=fields?.email?.stringValue, ug=fields?.ug?.stringValue;
  const role=fields?.role?.stringValue, centerId=fields?.centerId?.stringValue ?? null;
  if (fields?.active?.booleanValue!==true || uid!==identity.uid || email!==identity.email || !/^\d{6}$/.test(ug??'')
    || (role!=='gestor'&&role!=='centro') || (role==='centro'&&(!centerId||!/^[A-Za-z0-9_-]{1,64}$/.test(centerId)))
    || (role==='gestor'&&centerId!==null) || (managerOnly&&role!=='gestor')) {
    throw new CreditAccessError(403,'Perfil não autorizado para esta operação.');
  }
  return {uid,email,ug,role,centerId};
}
