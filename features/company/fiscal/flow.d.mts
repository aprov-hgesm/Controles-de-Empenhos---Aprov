export class FiscalUiError extends Error {readonly code:string; constructor(code:string,message?:string)}
export type FiscalProfile={companyId:string;workspaceId:string;cnpj:string;name:string;legalName:string};
export type FiscalConnection={state:'unavailable'|'not_configured'|'integrity_error'|'connected'|'pending_verification'|'disconnected'|'revoked';environment?:'homologacao'|'producao';verifiedAt?:string|null;credentialVersion?:number|null};
export type FiscalCapability={companyId:string;issuerCnpj:string;environment:string;canIssue:boolean};
export type FiscalDraft={companyId:string;issuerCnpj:string;orderId:string;recipientCnpj:string;recipientName:string;series:number;number:number;items:unknown[]};
export type FiscalIssueSummary={id:string;companyId:string;issuerCnpj:string;status:string;createdAt:string;accessKey:string|null;authorizationProtocol:string|null;authorizationVerified:boolean};
export const FISCAL_STATES:Readonly<Record<string,string>>;
export function selectVerifiedProfile(payload:unknown,sessionWorkspaceId:string):FiscalProfile;
export function safeConnection(payload:unknown,profile:FiscalProfile|null):FiscalConnection;
export function displayIssueState(issue:{status:string}|null):string;
export function issueIsAuthorized(issue:unknown):boolean;
export function fiscalSubmissionGate(args:{profile:FiscalProfile|null;connection:FiscalConnection|null;capabilities:FiscalCapability|null;draft:FiscalDraft|null;confirmed:boolean;busy:boolean;uncertain:boolean}):{allowed:boolean;code:string;message:string};
export function safeIssues(payload:unknown,profile:FiscalProfile|null):FiscalIssueSummary[];
export function createTenantRequestBoundary():Readonly<{
 rotate:(companyId:string|null)=>number;
 capture:(companyId:string)=>{signal:AbortSignal;current:()=>boolean};
 lockSubmission:(companyId:string,key:string)=>(()=>void)|null;
 activeCompanyId:string|null;
}>;