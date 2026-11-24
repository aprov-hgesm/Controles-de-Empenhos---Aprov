'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onIdTokenChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { CreditMember } from '@/lib/server/creditControlAuth';

export function useCreditSession(){
  const [user,setUser]=useState<User|null>(null);
  const [member,setMember]=useState<CreditMember|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const reload=useRef<()=>void>(()=>undefined);

  useEffect(()=>{
    let live=true, generation=0;
    let pending:AbortController|null=null;
    const load=async(next:User|null)=>{
      const id=++generation;
      pending?.abort();
      const controller=new AbortController();
      pending=controller;
      setUser(next);setMember(null);setError('');setLoading(Boolean(next));
      if(!next)return;
      const current=()=>live&&id===generation&&!controller.signal.aborted&&auth.currentUser?.uid===next.uid;
      try{
        const token=await next.getIdToken();
        if(!current())return;
        const response=await fetch('/api/controle-credito/sessao',{
          headers:{authorization:'Bearer '+token},cache:'no-store',signal:controller.signal,
        });
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.error||'Não foi possível validar o acesso.');
        if(payload.member?.uid!==next.uid)throw new Error('Identidade da sessão incompatível.');
        if(current())setMember(payload.member);
      }catch(e){
        if(current())setError(e instanceof Error?e.message:'Não foi possível validar o acesso.');
      }finally{if(current())setLoading(false);}
    };
    reload.current=()=>{void load(auth.currentUser);};
    const unsubscribe=onIdTokenChanged(auth,next=>{void load(next);});
    return()=>{live=false;generation++;pending?.abort();unsubscribe();reload.current=()=>undefined;};
  },[]);

  const retry=useCallback(()=>reload.current(),[]);
  const signOut=useCallback(async()=>{await firebaseSignOut(auth);},[]);
  const authorized=Boolean(user&&member&&user.uid===member.uid&&auth.currentUser?.uid===user.uid);
  return {user,member:authorized?member:null,loading,error,signOut,retry};
}
export type CreditSession=ReturnType<typeof useCreditSession>;
