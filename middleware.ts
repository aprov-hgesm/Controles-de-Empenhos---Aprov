import { NextResponse, type NextRequest } from 'next/server';
import { isolatedCompanyRouteDecision } from './lib/company/isolatedRoutes.mjs';

/**
 * The main EMPROVEX runtime is deliberately unaffected.
 * On the separate company Cloud Run service, never serve military/admin APIs
 * or pages even though the same Next.js source tree is used to build the image.
 */
export function middleware(request: NextRequest) {
  const decision = isolatedCompanyRouteDecision(
    request.nextUrl.pathname,
    process.env.EMPROVEX_COMPANY_ISOLATED_RUNTIME === '1'
  );
  if (decision === 'pass') return NextResponse.next();
  if (decision === 'redirect') {
    return NextResponse.redirect(new URL('/entrar-empresa', request.url), 307);
  }
  return new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export const config = {
  matcher: '/:path*',
};
