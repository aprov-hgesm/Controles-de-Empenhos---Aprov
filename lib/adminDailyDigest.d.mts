export function brazilDay(date?: Date): string;
export function buildAdminDigest(input: {
  day: string;
  now: string;
  accounts: Array<{ status: string; refundReviewStatus?: string; grace48ReviewStatus?: string }> | null;
  cycles: Array<{ referenceMonth: string; status: string; dueDate?: string }> | null;
  usage: { billableReadUnits: number; billableRealtimeReadUnits: number; billableWriteUnits: number; dataThrough?: string | null } | null;
  uptime: { total: number; passed: number } | null;
  errors5xx: number | null;
}): { subject: string; text: string };
