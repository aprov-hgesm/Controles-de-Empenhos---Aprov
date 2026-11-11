import {HospitalError,assertHospital,assertIdentifier} from '../../../../features/hospital/core/domain.mjs';
/** Trusted scopes can only be minted after server token verification and DB membership lookup. */
const trusted = new WeakSet();
const grant = Object.freeze({
  UNIT:['patient:read','patient:write','admission:read','admission:write','map:read','map:write','meal:read','meal:write','incident:write'],
  KITCHEN:['patient:read','admission:read','map:read','meal:read','meal:production','meal:distribution','incident:write'],
  NUTRITION:['patient:read','admission:read','map:read','meal:read','nutrition:read','nutrition:write','incident:write'],
  HOSPITAL_ADMIN:['hospital:manage','membership:manage','audit:read'],
});
/** Production adapter: requires initialized Firebase Admin default app and performs revocation check. */
export async function verifyFirebaseHospitalToken(token) {
  const {getAuth}=await import('firebase-admin/auth');
  return getAuth().verifyIdToken(token,true);
}
/** The ONLY trust boundary: never use UID/role/unit claims supplied by HTTP body or query. */
export async function resolveHospitalScope({authorization,organizationId,store,verifyToken=verifyFirebaseHospitalToken}) {
  assertIdentifier(organizationId,'organizationId');
  assertHospital(typeof authorization==='string'&&/^Bearer \S+$/.test(authorization),'UNAUTHORIZED','Firebase Bearer token obrigatório');
  assertHospital(typeof verifyToken==='function'&&store&&typeof store.findMembership==='function','UNAVAILABLE','Verificador e storage hospitalar indisponíveis');
  let identity;
  try {identity=await verifyToken(authorization.slice(7));}
  catch {throw new HospitalError('UNAUTHORIZED','Token inválido ou revogado');}
  const uid=identity?.uid;
  assertHospital(typeof uid==='string'&&uid.length>0,'UNAUTHORIZED','Identidade não verificada');
  const member=store.findMembership(organizationId,uid);
  assertHospital(member&&member.active===true,'FORBIDDEN','Sem vínculo hospitalar ativo nesta organização');
  assertHospital(member.organizationId===organizationId,'FORBIDDEN','Organização divergente');
  const org=store.findOrganization(organizationId);
  assertHospital(org&&org.active===true&&org.ug===member.ug,'FORBIDDEN','UG hospitalar não corresponde ao vínculo');
  assertHospital(Array.isArray(member.roles)&&member.roles.length>0&&member.roles.every(role=>grant[role]),'FORBIDDEN','Papel hospitalar inválido');
  const scope=Object.freeze({uid,organizationId,ug:org.ug,membershipId:member.id,roles:Object.freeze([...member.roles]),unitIds:Object.freeze([...member.unitIds]),active:true});
  trusted.add(scope); return scope;
}
export function requireHospitalPermission(scope,permission,unitId) {
  assertHospital(scope&&trusted.has(scope)&&scope.active===true,'UNAUTHORIZED','Escopo não verificado pelo servidor');
  assertHospital(typeof permission==='string'&&Object.values(grant).some(list=>list.includes(permission)),'FORBIDDEN','Permissão desconhecida');
  assertHospital(scope.roles.some(role=>grant[role]?.includes(permission)),'FORBIDDEN',`Sem permissão ${permission}`);
  if(unitId!==undefined&&unitId!==null) {
    assertIdentifier(unitId,'unitId');
    assertHospital(scope.unitIds.includes(unitId),'FORBIDDEN','Unidade fora do vínculo autorizado');
  } else assertHospital(['hospital:manage','membership:manage','audit:read'].includes(permission),'FORBIDDEN','A operação clínica exige unitId');
  return scope;
}
export function requireHospitalOrganization(scope,organizationId) {
  assertHospital(scope&&trusted.has(scope),'UNAUTHORIZED','Escopo não confiável');
  assertHospital(scope.organizationId===organizationId,'FORBIDDEN','Acesso entre OMs proibido');
  return scope;
}
