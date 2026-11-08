import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ProfileError, validCompanyId } from './core.mjs';
export const PROFILE_COOKIE = '__Host-emprovex-company-profile';
const TTL_SECONDS=600;
/** Secret is exclusively server-side, generated/configured by W10; no client or Firestore copies. */
function key(secret) {
  if (typeof secret!=='string' || !/^[A-Za-z0-9_-]{43,}$/.test(secret)
    || Buffer.from(secret,'base64url').length<32) throw new ProfileError('PROFILE_INTEGRATION_REQUIRED',503);
  return Buffer.from(secret,'base64url');
}
function sessionKey(session) {
  if (!session || typeof session.uid!=='string' || !session.uid
    || !Number.isSafeInteger(session.authTime) || session.authTime<=0) throw new ProfileError('PROFILE_IDENTITY_FORBIDDEN',403);
  return session;
}
export function signProfileSelection(companyId, sessionInput, secret, now=Math.floor(Date.now()/1000)) {
  const session=sessionKey(sessionInput);
  if (!validCompanyId(companyId) || !Number.isSafeInteger(now)) throw new ProfileError('PROFILE_INVALID_INPUT',400);
  const payload={v:1,companyId,uid:session.uid,authTime:session.authTime,iat:now,exp:now+TTL_SECONDS,
    nonce:randomBytes(12).toString('base64url')};
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac=createHmac('sha256',key(secret)).update(body).digest('base64url');
  return body+'.'+mac;
}
export function verifyProfileSelection(value, sessionInput, secret, now=Math.floor(Date.now()/1000)) {
  const session=sessionKey(sessionInput);
  const signingKey=key(secret);
  if (typeof value!=='string' || value.length>1100 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new ProfileError('PROFILE_NOT_AUTHORIZED',403);
  }
  const [body,supplied]=value.split('.');
  const actual=createHmac('sha256',signingKey).update(body).digest();
  const signed=Buffer.from(supplied,'base64url');
  if (signed.length!==actual.length || !timingSafeEqual(signed,actual)) throw new ProfileError('PROFILE_NOT_AUTHORIZED',403);
  let payload;
  try { payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8')); }
  catch { throw new ProfileError('PROFILE_NOT_AUTHORIZED',403); }
  if (!payload || payload.v!==1 || !validCompanyId(payload.companyId)
    || payload.uid!==session.uid || payload.authTime!==session.authTime
    || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)
    || payload.exp-payload.iat!==TTL_SECONDS || payload.iat>now+30 || now>=payload.exp
    || !/^[A-Za-z0-9_-]{16}$/.test(payload.nonce)) throw new ProfileError('PROFILE_NOT_AUTHORIZED',403);
  return payload.companyId;
}
/** A multi-CNPJ account cannot silently return to its primary tenant when a
 * short-lived selection cookie disappears. Single-company W0 stays compatible. */
export function resolveUnselectedCompany(baseCompanyId, candidateIds) {
  if (!validCompanyId(baseCompanyId) || !Array.isArray(candidateIds)
    || !candidateIds.includes(baseCompanyId) || candidateIds.some(id => !validCompanyId(id))) {
    throw new ProfileError('PROFILE_NOT_AUTHORIZED', 403);
  }
  if (candidateIds.some(id => id !== baseCompanyId)) {
    throw new ProfileError('PROFILE_SELECTION_REQUIRED', 403);
  }
  return baseCompanyId;
}

export function profileSetCookie(value) {
  if (typeof value!=='string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new ProfileError('PROFILE_INVALID_INPUT',400);
  }
  return `${PROFILE_COOKIE}=${value}; Path=/; Max-Age=${TTL_SECONDS}; Secure; HttpOnly; SameSite=Strict`;
}
export function profileClearCookie() {
  return `${PROFILE_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict`;
}
