import { NextResponse } from 'next/server';
import { requireCreditMember, creditAuthFailure } from '@/lib/server/creditControlAuth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{return NextResponse.json({member:await requireCreditMember(request)},{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){const failure=creditAuthFailure(error);return NextResponse.json({error:failure.error},{status:failure.status,headers:{'Cache-Control':'private, no-store'}});}
}
