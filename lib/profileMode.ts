'use client';

import { HGESM_SECTOR_EMAIL } from './hgesmWorkspace';
import { normalizePlatformEmail } from './platformIdentity';

export type EmprovexProfileMode = 'sector' | 'platformAdmin';

const PROFILE_MODE_STORAGE_KEY = 'emprovex_profile_mode_v1';

export function hasDualProfileAccess(email?: string | null): boolean {
  if (!email) return false;
  return normalizePlatformEmail(email) === HGESM_SECTOR_EMAIL;
}

export function getActiveProfileMode(email?: string | null): EmprovexProfileMode {
  if (!hasDualProfileAccess(email)) return 'sector';
  if (typeof window === 'undefined') return 'sector';

  try {
    return sessionStorage.getItem(PROFILE_MODE_STORAGE_KEY) === 'platformAdmin'
      ? 'platformAdmin'
      : 'sector';
  } catch {
    return 'sector';
  }
}

export function setActiveProfileMode(mode: EmprovexProfileMode): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PROFILE_MODE_STORAGE_KEY, mode);
  } catch {
    // Session storage is an interface preference only. Authorization remains in Firebase.
  }
}

export function resetActiveProfileMode(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PROFILE_MODE_STORAGE_KEY);
  } catch {
    // No-op.
  }
}
