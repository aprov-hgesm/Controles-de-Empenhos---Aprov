'use client';
import {useEffect,useRef,useState} from 'react';
import type {User} from 'firebase/auth';
import {api,cancelled,errorText,query} from '../client';
export type CreditChoice={id:string;number:string;beneficiaryUg:string;description:string;deadline:string|null;availableCents:number};
export function useCreditChoices(user:User,year:string,enabled:boolean,version=0){
  const [state,setState]=useState<{key:string;choices:CreditChoice[];loading:boolean;error:string}>({key:'',choices:[],loading:false,error:''});
  const [retry,setRetry]=useState(0);
  const key=user.uid+':'+year+':'+version+':'+retry;
  const cache=useRef<{key:string;choices:CreditChoice[]}|null>(null);
  useEffect(()=>{if(!enabled)return;const controller=new AbortController();if(cache.current?.key===key){setState({key,choices:cache.current.choices,loading:false,error:''});return;}
    setState({key,choices:[],loading:true,error:''});
    void api<{choices:CreditChoice[]}>(user,'/financeiro'+query({year,mode:'nc-choices'}),controller.signal).then(r=>{if(!controller.signal.aborted){cache.current={key,choices:r.choices};setState({key,choices:r.choices,loading:false,error:''});}}).catch(e=>{if(!controller.signal.aborted&&!cancelled(e))setState({key,choices:[],loading:false,error:errorText(e)});});
    return()=>controller.abort();
  },[user,year,key,enabled]);
  return {choices:state.key===key?state.choices:[],loading:enabled&&(state.key!==key||state.loading),error:state.key===key?state.error:'',retry:()=>setRetry(x=>x+1)};
}
