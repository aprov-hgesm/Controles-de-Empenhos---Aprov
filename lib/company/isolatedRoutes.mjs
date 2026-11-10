// Restrict the isolated Cloud Run deployment to company-only routes.
// This is defense-in-depth; it does not replace Firebase Auth or server authorization.
const exact = new Set([
  '/entrar-empresa', '/empresa', '/empresa-convite',
  '/manifest.webmanifest', '/favicon.ico',
  '/emprovex-logo.png',
]);
const prefixes = [
  '/empresa/', '/empresa-convite/', '/api/company/',
  '/_next/', '/api/install-icon/',
];
export function isolatedCompanyRouteDecision(pathname, isolated) {
  if (!isolated) return 'pass'; // The military deployment is unchanged.
  if (pathname === '/') return 'redirect';
  if (exact.has(pathname) || prefixes.some(prefix => pathname.startsWith(prefix))) {
    return 'pass';
  }
  return 'block';
}
