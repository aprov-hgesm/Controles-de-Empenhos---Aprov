'use client';
import Image from 'next/image';
import {useState} from 'react';
import {UserRound} from 'lucide-react';

export const CREDIT_PROFILES=[
  {id:'GESTOR',name:'Gestor'},
  {id:'APROV',name:'Aprovisionamento'},
  {id:'ALMOX',name:'Almoxarifado'},
  {id:'FARM',name:'Farmácia'},
  {id:'LAC',name:'Laboratório'},
  {id:'ODONTO',name:'Odontologia'},
] as const;
export function creditProfileName(profile:string|null|undefined){const key=profile?.toUpperCase()??'';return CREDIT_PROFILES.find(p=>p.id===key)?.name||profile||'Centro de custos';}
const originals:Record<string,string>={
  GESTOR:'Imagem  - Perfil Gestor.png',APROV:'Imagem  - Perfil Aprov.png',ALMOX:'Imagem  - Perfil Almox.png',FARM:'Imagem  - Perfil Farm.png',LAC:'Imagem  - Perfil LAC.png',ODONTO:'Imagem  - Perfil Odonto.png',
};
export function CreditProfileAvatar({profile,size=40,className=''}:{profile:string|null|undefined;size?:number;className?:string}){
  const key=profile?.toUpperCase()??'',filename=Object.prototype.hasOwnProperty.call(originals,key)?originals[key]:undefined;
  const src=filename?'/branding/'+encodeURIComponent(filename):'';
  return <ProfileImage key={src} src={src} size={size} className={className}/>;
}
function ProfileImage({src,size,className}:{src:string;size:number;className:string}){
  const [failed,setFailed]=useState(false);
  return <span aria-hidden="true" className={'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full '+className} style={{width:size,height:size}}>
    {src&&!failed?<Image src={src} alt="" width={size} height={size} quality={75} className="h-full w-full rounded-full object-contain" onError={()=>setFailed(true)}/>:<span className="flex h-full w-full items-center justify-center rounded-full bg-slate-700/15 text-slate-400"><UserRound style={{width:size*.48,height:size*.48}}/></span>}
  </span>;
}
