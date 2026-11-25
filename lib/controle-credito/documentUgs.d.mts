export function creditDocumentUgs(tenantUg: string): string[];
export function allowsCreditDocumentUg(tenantUg: string, documentUg: unknown): documentUg is string;
export function creditRecordId(tenantUg: string, issuingUg: string, number: string, beneficiaryUg: string): string;
