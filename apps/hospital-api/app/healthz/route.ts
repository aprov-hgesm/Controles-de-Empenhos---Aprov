export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return Response.json({status:'ok',service:'cozinha-dietetica-api'},
  {status:200,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
