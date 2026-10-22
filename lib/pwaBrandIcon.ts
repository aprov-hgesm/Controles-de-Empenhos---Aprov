/**
 * EMPROVEX R363: resolve only the institutional logo already used by the
 * application. This module never handles workspace/user data.
 */
const MAX_DATA_URL_LENGTH = 3_000_000;

export const EMPROVEX_PWA_ICON_SIZES = [32, 180, 192, 512] as const;

export function isEmprovexPwaIconSize(value: string): value is '32' | '180' | '192' | '512' {
  return /^(32|180|192|512)$/.test(value);
}

export function safeInstitutionalLogoSource(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const source = raw.trim();
  if (!source || source.length > MAX_DATA_URL_LENGTH) return null;

  // The existing institutional branding supports data URLs as well as Firebase Storage URLs.
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(source)) {
    return source;
  }
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const trusted =
      host === 'firebasestorage.googleapis.com'
      || host === 'storage.googleapis.com'
      || host.endsWith('.googleusercontent.com')
      || host.endsWith('.public.blob.vercel-storage.com')
      || host === 'res.cloudinary.com';
    return trusted ? url.toString() : null;
  } catch {
    return null;
  }
}
