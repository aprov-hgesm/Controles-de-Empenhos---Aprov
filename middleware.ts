import {NextRequest,NextResponse} from 'next/server';

// A private hospital QA Cloud Run revision must not expose EMPROVEX financial,
// billing, business, administrative or workspace endpoints from the shared
// Next.js artifact. The outer Cloud Run IAM invoker check is also mandatory.
export function middleware(request:NextRequest) {
  if(process.env.HOSPITAL_GCP_QA_ENABLED!=='1')return NextResponse.next();
  const enabled=process.env.NODE_ENV==='production'
    &&process.env.HOSPITAL_FIRESTORE_PROJECT_ID==='cozinha-dietetica'
    &&process.env.GOOGLE_CLOUD_PROJECT==='cozinha-dietetica'
    &&process.env.K_SERVICE==='cozinha-dietetica-qa'
    &&process.env.HOSPITAL_GCP_QA_PRIVATE==='1';
  if(!enabled)return new NextResponse(null,{status:503,headers:{'Cache-Control':'no-store'}});
  const path=request.nextUrl.pathname;
  const permitted=path==='/cozinha-dietetica'
    ||path.startsWith('/cozinha-dietetica/')
    ||path.startsWith('/api/hospital/')
    ||path.startsWith('/_next/')
    ||path==='/favicon.ico'
    ||path==='/manifest.webmanifest'
    ||path==='/manifest.json'
    ||path.startsWith('/icons/');
  if(!permitted)return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});
  return NextResponse.next();
}
export const config={matcher:['/:path*']};
