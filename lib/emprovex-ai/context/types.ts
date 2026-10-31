/** W4 R1 — semantic interpretation only. No I/O, credentials or data authorization. */
export const W3_VERSION = 'emprovex.ai.query.v1' as const;
export type Domain = 'IN_SCOPE'|'OUT_OF_SCOPE'|'UNCERTAIN';
export type Route = 'DETERMINISTIC'|'CLARIFY'|'MODEL_ELIGIBLE'|'UNSUPPORTED'|'REJECT_MUTATION'|'OUT_OF_SCOPE';
export type W3Intent = 'supplier_contact_find'|'commitment_get'|'commitment_total_balance'|
  'commitment_previous_open_list'|'schedule_sent_history_list'|'invoice_registration_period_list'|
  'warehouse_stock_get'|'warehouse_material_locations_list';
export type Intent = W3Intent | 'invoice_by_material_period'|'invoice_issued_period'|
  'invoice_by_number'|'supplier_by_commitment'|'warehouse_by_location'|'delivery_late_list'|
  'validity_alerts'|'warehouse_movement'|'inventory_status'|'general_document_search'|
  'operational_procedure'|'navigation'|'future_operation'|'unknown';
export type W3Query = {version:typeof W3_VERSION;intent:W3Intent;params:Record<string,unknown>};
export type Relative = {kind:'relative';value:string};
export type AiPeriodInput = Relative|{start:string;endExclusive:string};
export type ContextRefs = {commitmentId?:string; materialQuery?:string; supplierName?:string; supplierCnpj?:string};
export type ShortContext = {sessionId:string;workspaceId:string;updatedAt:number;refs:ContextRefs};
export type TrustedScope = {sessionId:string;workspaceId:string};
/** Scope MUST come from a server-validated session, never from message/parameters. */
export type Input = {message:string;now?:Date;scope?:TrustedScope;previous?:ShortContext};
export type Dimensions = {
  intention:string|null;document:string|null;material:string|null;situation:string|null;
  period:AiPeriodInput|null;identity:{type:string;original:string;value:string}|null;
  quantity:string|null;location:string|null;relationship:string|null;format:string|null;
};
export type ModelProposal = {schema:'emprovex.ai.modelProposal.v1';userText:string;
  allowedIntents:readonly W3Intent[];maxOutputTokens:128;temperature:0;
  context:ContextRefs;jsonOnly:true};
export type Result = {domain:Domain;route:Route;intent:Intent;confidence:number;
  /** Compatibility score only; not a statistically calibrated probability. */
  confidenceKind:'HEURISTIC_NOT_CALIBRATED';
  filterAudit?:{requested:string[];represented:string[];unhandled:string[]};
  dimensions:Dimensions;entities:Record<string,string|number>;query?:W3Query;
  question?:string;reason:string;nextContext?:ShortContext;model?:ModelProposal;
  metrics:{durationMs:number;estimatedWork:number;qwenCalls:0}};
