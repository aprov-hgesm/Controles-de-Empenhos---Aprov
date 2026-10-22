import { ImageResponse } from 'next/og';
import firebaseConfig from '../../../../firebase-applet-config.json';
import { getGoogleAccessToken } from '../../../../lib/server/sectorProvisioningAdmin';
import { isEmprovexPwaIconSize, safeInstitutionalLogoSource } from '../../../../lib/pwaBrandIcon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BRAND_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 2_000_000;
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';
let sourceCache: { image: string | null; expiresAt: number } | null = null;
let pending: Promise<string | null> | null = null;

/** Read only the public logo field, from the same global settings used by the site. */
async function readLogoFromOfficialBranding(): Promise<string | null> {
  const configured = safeInstitutionalLogoSource(process.env.NEXT_PUBLIC_EMPROVEX_LOGO_URL);
  if (configured) return configured;

  const accessToken = await getGoogleAccessToken();
  const project = encodeURIComponent(firebaseConfig.projectId);
  const database = encodeURIComponent(firebaseConfig.firestoreDatabaseId);
  const endpoint = `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents/settings/global?mask.fieldPaths=logo`;
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(4_000),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const record = await response.json() as { fields?: { logo?: { stringValue?: unknown } } };
  return safeInstitutionalLogoSource(record.fields?.logo?.stringValue);
}

async function loadLogoImage(): Promise<string | null> {
  let source: string | null;
  try {
    source = await readLogoFromOfficialBranding();
  } catch {
    return null; // Development without production credentials: use site's EMP fallback.
  }
  if (!source) return null;
  if (source.startsWith('data:')) return source;
  try {
    // Never follow redirects into an unexpected private host.
    const response = await fetch(source, {
      redirect: 'error',
      headers: { Accept: 'image/png,image/jpeg,image/webp' },
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!type || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) return null;
    const announced = Number(response.headers.get('content-length') || '0');
    if (announced > MAX_IMAGE_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Cache per warm instance; CDN caches rendered PNGs, preventing per-install Firestore reads. */
async function officialLogoImage(): Promise<string | null> {
  if (sourceCache && sourceCache.expiresAt > Date.now()) return sourceCache.image;
  if (!pending) {
    pending = loadLogoImage().then((image) => {
      sourceCache = { image, expiresAt: Date.now() + BRAND_CACHE_TTL_MS };
      return image;
    }).finally(() => { pending = null; });
  }
  return pending;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> }
) {
  const { size: rawSize } = await context.params;
  if (!isEmprovexPwaIconSize(rawSize)) return new Response('Not Found', { status: 404 });
  const size = Number(rawSize);
  const logo = await officialLogoImage();
  const markSize = Math.round(size * 0.68);
  const rounded = Math.round(size * 0.19);
  const result = new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        justifyContent: 'center', alignItems: 'center',
        background: '#00288e', borderRadius: rounded,
      }}>
        {logo ? (
          // Preserve the exact institutional image; no restyling or cropping.
          <img src={logo} alt="" width={markSize} height={markSize}
            style={{ objectFit: 'contain' }} />
        ) : (
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            width: markSize, height: markSize, fontWeight: 900,
            letterSpacing: Math.max(0, size * 0.008), color: '#fff',
            fontFamily: 'sans-serif', fontSize: Math.round(size * 0.26),
          }}>EMP</div>
        )}
      </div>
    ),
    { width: size, height: size }
  );
  // Do not cache the fallback for a full day if the institutional source is temporarily unavailable.
  result.headers.set('Cache-Control', logo ? CACHE_CONTROL : 'public, max-age=30, s-maxage=60');
  // Exposes only whether the official image loaded; no URL or credentials.
  result.headers.set('X-Emprovex-Icon-Source', logo ? 'institutional' : 'fallback');
  result.headers.set('X-Content-Type-Options', 'nosniff');
  return result;
}
