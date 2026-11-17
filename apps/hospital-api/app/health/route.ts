export const runtime='nodejs';
export const dynamic='force-dynamic';

// Cloud Run reserva alguns caminhos terminados em "z", incluindo /healthz.
// A verificacao deve usar /health, que atravessa o proxy do Google Cloud.
export async function GET(){
  return Response.json({status:'ok',service:'cozinha-dietetica-api'},{
    status:200,
    headers:{
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'
    }
  });
}
