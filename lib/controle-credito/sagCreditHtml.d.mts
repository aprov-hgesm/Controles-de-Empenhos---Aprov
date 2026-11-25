import type { SagCreditCell } from './sagCreditText';
export interface SagHtmlCreditSequence {
  sequence: string;
  totalCents: number;
  origin: SagCreditCell[];
  destination: SagCreditCell[];
}
export interface SagHtmlCreditDraft {
  number: string;
  fullNumber: string;
  issuingUg: string;
  beneficiaryUg: string;
  issueDate: string;
  operation: string;
  decentralization: string;
  sourceSystem: string;
  description: string;
  deadline: string | null;
  documentTotalCents: number;
  totalCents: number;
  sequences: SagHtmlCreditSequence[];
  warnings: string[];
  requiresReview: true;
}
export function parseSagCreditHtml(html: string, expectedUg: string | readonly string[]): SagHtmlCreditDraft;
