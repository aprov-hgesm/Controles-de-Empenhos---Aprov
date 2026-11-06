'use client';
import { auth } from '../../../lib/firebase';

export async function companyApi(path:string, method:'GET'|'POST'|'PATCH'='GET', payload?:unknown) {
  const user=auth.currentUser;
  if (!user) throw new Error('A sessão empresarial não está disponível.');
  const token=await user.getIdToken();
  const response=await fetch('/api/company/'+path,{
    method,cache:'no-store',
    headers:{authorization:'Bearer '+token,
      ...(payload ? {'content-type':'application/json','idempotency-key':crypto.randomUUID()} : {})},
    ...(payload ? {body:JSON.stringify(payload)} : {}),
  });
  const result=await response.json() as {ok:boolean;result?:unknown;code?:string};
  if (!response.ok || !result.ok) throw new Error(result.code || 'Não foi possível consultar os dados.');
  return result.result;
}
export async function companyList<T>(path:string) {
  const data=await companyApi(path) as {items:T[];nextCursor:string|null};
  return data;
}
