export type NeighborhoodPresence = 'online' | 'offline' | 'disabled' | 'unknown';
export interface NeighborhoodResident {
  id: string;
  label: string;
  email: string;
  workspaceId: string | null;
  ug: string | null;
  kind: 'admin' | 'sector';
  disabled: boolean;
  presence: NeighborhoodPresence;
  lastSeenAt: string | null;
}
export interface NeighborhoodAccount {
  email: string;
  firebaseUid?: string;
  status: string;
  accountType: string;
  workspaceId?: string;
  ug?: string;
  lastLoginAt?: string;
}
export interface NeighborhoodSession {
  uid: string;
  accountEmail: string;
  expiresAt: string;
  lastSeenAt: string;
}
export const NEIGHBORHOOD_BLOCK_SIZE: number;
export function buildNeighborhoodResidents(
  accounts?: NeighborhoodAccount[],
  sessions?: NeighborhoodSession[],
  options?: { now?: number; sessionsAvailable?: boolean }
): NeighborhoodResident[];
export function neighborhoodQuota(snapshot: {
  billableReadUnits: number;
  billingReference?: { readUnitsDailyLimit: number };
} | null | undefined): {
  known: boolean; percentage: number | null; waterLevel: number; exceeded: boolean;
};
export function neighborhoodPages(residents: NeighborhoodResident[], page: number, size?: number): {
  page: number;
  pageCount: number;
  displayed: NeighborhoodResident[];
};
