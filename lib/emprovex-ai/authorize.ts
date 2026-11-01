/** Authorizer estritamente read-only, sem atualizacao de claims nem espelho de cobranca. */
import { verifyFirebaseRequest } from '../server/firebaseFounderAuth';
import { getGoogleAccessToken } from '../server/sectorProvisioningAdmin';
import {w6DataTarget,getW6GoogleAccessToken,verifyW6FirebaseRequest} from './integration/w6Isolation';
import {aiProductionPilotEnabled} from './integration/environment';
import {getAiProductionGoogleAccessToken} from './integration/productionPilot';
import { HGESM_SECTOR_EMAIL, HGESM_WORKSPACE_ID, HGESM_UG } from '../hgesmWorkspace';
import { isFounderSignInProvider, isValidUnitUg, isValidWorkspaceId,
  normalizePlatformEmail } from '../platformIdentity';
import { warehouseModuleEnabled } from '../warehouse/featureFlag';
import { decideBillingAccess } from '../billingAccess';
import { billingCycleId, paidServicePeriod, billingCycleReferenceForPeriod,
  renewalGraceDaysForAccount, getReferenceMonth, type BillingAccount,
  type BillingCycle } from '../billing';
import { coreDocument } from './reader';
import { AiExecutionError } from './response';
import type { AiIntent } from './contracts';

export interface AiAccess {
  uid:string; email:string; workspaceId:string; ug:string; googleToken:string;
}
function field(doc:Record<string,unknown>|null,key:string):string {
  return typeof doc?.[key]==='string' ? doc[key] as string : '';
}
export function validateAiIdentity(input:{
  uid:string; email:string; account:Record<string,unknown>|null;
  workspace:Record<string,unknown>|null;
}): {workspaceId:string; ug:string} {
  const a=input.account, w=input.workspace;
  if (!a || !w || a.accountType!=='sector' || a.status!=='active'
    || a.firebaseUid!==input.uid || field(a,'email')!==input.email
    || (a.authProvider && a.authProvider!=='password')
    || !isValidWorkspaceId(field(a,'workspaceId'))
    || !isValidUnitUg(field(a,'ug'))
    || w.id!==a.workspaceId || w.status!=='active'
    || w.authorizedEmail!==input.email || w.ug!==a.ug)
    throw new AiExecutionError('AI_WORKSPACE_FORBIDDEN',403);
  return {workspaceId:field(a,'workspaceId'),ug:field(a,'ug')};
}
async function authorizeBilling(
  access:AiAccess
):Promise<void> {
  // Mesmas condicoes comerciais do portal, sem o reparo de espelho que escreve no Warehouse.
  const [config,accountRaw]=await Promise.all([
    coreDocument('platformBillingConfig/main',access.googleToken),
    coreDocument('billingAccounts/'+access.workspaceId,access.googleToken),
  ]);
  const qaLive=process.env.EMPROVEX_BILLING_QA_WORKSPACE_ID===access.workspaceId
    && process.env.INFINITEPAY_BILLING_ENABLED==='1'
    && process.env.INFINITEPAY_BILLING_SCOPE==='pilot'
    && process.env.INFINITEPAY_BILLING_PILOT_WORKSPACE_ID===access.workspaceId;
  const globalLive=process.env.EMPROVEX_BILLING_ENFORCEMENT_ENABLED==='1'
    && process.env.INFINITEPAY_BILLING_ENABLED==='1'
    && config?.billingMode==='enforce' && config?.requirePayment===true;
  const live=globalLive||qaLive;
  if(!live)return;
  if (!accountRaw || accountRaw.workspaceId!==access.workspaceId
    || accountRaw.ug!==access.ug || accountRaw.authorizedEmail!==access.email)
    throw new AiExecutionError('AI_BILLING_FORBIDDEN',403);
  const account=accountRaw as unknown as BillingAccount;
  const period=paidServicePeriod(account);
  const currentMonth=period?billingCycleReferenceForPeriod(account,period):getReferenceMonth();
  const priorMonth=period && period.periodNumber>1
    ? getReferenceMonth(new Date(new Date(period.startsAt).getTime()-24*3600*1000)):null;
  const [current,prior]=await Promise.all([
    coreDocument('billingCycles/'+billingCycleId(access.workspaceId,currentMonth),access.googleToken),
    priorMonth?coreDocument('billingCycles/'+billingCycleId(access.workspaceId,priorMonth),access.googleToken):Promise.resolve(null),
  ]);
  const validCycle=(value:Record<string,unknown>|null):BillingCycle|null=>{
    if(!value)return null;
    if (value.workspaceId!==access.workspaceId || value.ug!==access.ug) throw new AiExecutionError('AI_BILLING_INTEGRITY',503);
    return value as unknown as BillingCycle;
  };
  const decision=decideBillingAccess(account,validCycle(current),new Date(),validCycle(prior),
    renewalGraceDaysForAccount(account, Number(config?.gracePeriodDays)||0));
  if(!decision.allowed)throw new AiExecutionError('AI_BILLING_FORBIDDEN',403);
}
export async function prepareAiAccess(authorization:string|null):Promise<AiAccess> {
  // Only W6 uses the isolated Firebase issuer + managed Google credentials.
  // Incomplete W6 configuration throws; never fall back to production Auth/Firestore.
  const w6=w6DataTarget();
  const verified=w6?await verifyW6FirebaseRequest(authorization):await verifyFirebaseRequest(authorization);
  // Production pilot: a valid Firebase token is not enough. Only the
  // existing verified founder identity may proceed to Firestore reads.
  // This guard is evaluated BEFORE obtaining a Google access token.
  if(aiProductionPilotEnabled() &&
     !(verified.email===HGESM_SECTOR_EMAIL && isFounderSignInProvider(verified.signInProvider)))
    throw new AiExecutionError('AI_PILOT_FORBIDDEN',403);
  const googleToken=w6?await getW6GoogleAccessToken():
    aiProductionPilotEnabled()?await getAiProductionGoogleAccessToken():await getGoogleAccessToken();
  if(verified.email===HGESM_SECTOR_EMAIL && isFounderSignInProvider(verified.signInProvider)){
    const workspace=await coreDocument('workspaces/'+HGESM_WORKSPACE_ID,googleToken);
    if(!workspace || workspace.status!=='active'
      || workspace.ug!==HGESM_UG || workspace.authorizedEmail!==HGESM_SECTOR_EMAIL)
      throw new AiExecutionError('AI_FOUNDER_WORKSPACE_FORBIDDEN',403);
    return {uid:verified.uid,email:verified.email,workspaceId:HGESM_WORKSPACE_ID,ug:HGESM_UG,googleToken};
  }
  if(verified.signInProvider!=='password')throw new AiExecutionError('AI_PROVIDER_FORBIDDEN',403);
  const account=await coreDocument('platformAccounts/'+verified.email,googleToken);
  if(!account || !isValidWorkspaceId(field(account,'workspaceId')))
    throw new AiExecutionError('AI_ACCOUNT_FORBIDDEN',403);
  const workspace=await coreDocument('workspaces/'+field(account,'workspaceId'),googleToken);
  const identity=validateAiIdentity({uid:verified.uid,email:normalizePlatformEmail(verified.email),account,workspace});
  const access={uid:verified.uid,email:verified.email,...identity,googleToken};
  await authorizeBilling(access);
  return access;
}

/** Gate por contrato executado novamente em toda consulta, inclusive nos follow-ups. */
export function authorizeAiIntent(_access:AiAccess,intent:AiIntent):void {
  if(intent.startsWith('warehouse_')&&!warehouseModuleEnabled)
    throw new AiExecutionError('AI_MODULE_DISABLED',403);
}
/** Compatibilidade W3: identidade/assinatura e modulo continuam obrigatorios. */
export async function authorizeAi(authorization:string|null,intent:AiIntent):Promise<AiAccess> {
  const access=await prepareAiAccess(authorization);
  authorizeAiIntent(access,intent);
  return access;
}
