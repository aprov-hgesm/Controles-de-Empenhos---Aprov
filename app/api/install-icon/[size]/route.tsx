import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 4_000_000;
const SOURCE_PATH = join(process.cwd(), 'public', 'emprovex-logo.png');
const VALID_SIZES = new Set(['32', '180', '192', '512']);
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';

// The exact uploaded PNG is packaged with the server route by Next.js file tracing.
// No Firestore read, external URL or new API credential is necessary.
let cachedLogo: string | null | undefined;
let pending: Promise<string | null> | null = null;

async function logoData(): Promise<string | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  if (!pending) {
    pending = readFile(SOURCE_PATH)
      .then((bytes) => {
        if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
        // Only allow a valid PNG signature; never interpret the file as HTML/SVG.
        if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
        return `data:image/png;base64,${bytes.toString('base64')}`;
      })
      .catch(() => null)
      .then((image) => {
        if (image) cachedLogo = image;
        return image;
      })
      .finally(() => { pending = null; });
  }
  return pending;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ size: string }> }
) {
  const { size: rawSize } = await context.params;
  if (!VALID_SIZES.has(rawSize)) return new Response('Not Found', { status: 404 });

  const size = Number(rawSize);
  const logo = await logoData();
  const maskable = size === 512 && new URL(request.url).searchParams.get('maskable') === '1';
  // The supplied file already includes the full official wordmark and blue background.
  // Render at full size for regular icons; reserve a safe zone for adaptive masks.
  const markSize = maskable ? Math.round(size * 0.76) : size;

  const result = new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        justifyContent: 'center', alignItems: 'center',
        background: '#00288e',
      }}>
        {logo ? (
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

  result.headers.set('Cache-Control', logo ? CACHE_CONTROL : 'public, max-age=30, s-maxage=60');
  result.headers.set('X-Emprovex-Icon-Source', logo ? 'institutional' : 'fallback');
  result.headers.set('X-Content-Type-Options', 'nosniff');
  return result;
}
