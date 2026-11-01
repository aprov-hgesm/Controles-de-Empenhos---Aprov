import { AI_RESPONSE_VERSION, CONTRACTS, type AiIntent, type AiResponse, type AiStatus, type AiEvidence } from './contracts';

export class AiExecutionError extends Error {
  constructor(public readonly code:string, public readonly httpStatus:number) {super(code);}
}
export type QueryOutcome = {
  status?: AiStatus; data: unknown; evidence?:AiEvidence[]; limitations?:string[];
  coverage?:'complete'|'incomplete'|'unknown'; nextCursor?:string|null; truncated?:boolean;
  examinedDocuments?:number;
};
export function makeAiResponse(
 intent:AiIntent, filters:Record<string,unknown>, outcome:QueryOutcome, start:number
):AiResponse {
  const truncated=outcome.truncated===true;
  return {
    version:AI_RESPONSE_VERSION, intent, contract:CONTRACTS[intent],
    status:outcome.status || (truncated?'partial':'ok'),
    data:outcome.data, filters, evidence:outcome.evidence || [],
    asOf:new Date().toISOString(),
    coverage:outcome.coverage || (truncated?'incomplete':'complete'),
    limitations:outcome.limitations || [],
    pagination: {nextCursor:outcome.nextCursor || null,truncated},
    metrics:{durationMs:Math.max(0,Date.now()-start),examinedDocuments:outcome.examinedDocuments ?? 0},
  };
}
