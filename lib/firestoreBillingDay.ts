export const FIRESTORE_BILLING_TIME_ZONE = 'America/Los_Angeles' as const;

const billingDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: FIRESTORE_BILLING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const billingDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: FIRESTORE_BILLING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function dayKeyParts(dayKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) throw new Error('Dia de faturamento inválido.');
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function timeZoneParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const values = Object.fromEntries(
    billingDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function timeZoneOffsetMs(date: Date): number {
  const parts = timeZoneParts(date);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const epochWithoutMilliseconds = Math.floor(date.getTime() / 1000) * 1000;
  return representedAsUtc - epochWithoutMilliseconds;
}

function resolveBillingMidnight(dayKey: string): Date {
  const parts = dayKeyParts(dayKey);
  const targetWallClock = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);

  let guess = new Date(targetWallClock);
  let offset = timeZoneOffsetMs(guess);
  guess = new Date(targetWallClock - offset);

  // Re-evaluate after resolving the instant so daylight-saving transitions stay correct.
  offset = timeZoneOffsetMs(guess);
  return new Date(targetWallClock - offset);
}

export function getFirestoreBillingDayKey(date = new Date()): string {
  const values = Object.fromEntries(
    billingDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftFirestoreBillingDayKey(dayKey: string, days: number): string {
  const parts = dayKeyParts(dayKey);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return shifted.toISOString().slice(0, 10);
}

export function getFirestoreBillingDayWindow(dayKey: string): {
  dayKey: string;
  startedAt: string;
  endedAt: string;
  nextStartedAt: string;
} {
  const started = resolveBillingMidnight(dayKey);
  const nextDayKey = shiftFirestoreBillingDayKey(dayKey, 1);
  const nextStarted = resolveBillingMidnight(nextDayKey);
  return {
    dayKey,
    startedAt: started.toISOString(),
    endedAt: new Date(nextStarted.getTime() - 1).toISOString(),
    nextStartedAt: nextStarted.toISOString(),
  };
}
