'use client';
import Image from 'next/image';
import {useState} from 'react';
import {UserRound} from 'lucide-react';

export const CREDIT_PROFILES=[
  {id:'GESTOR',name:'Gestão'},
  {id:'APROV',name:'Aprovisionamento'},
  {id:'ALMOX',name:'Almoxarifado'},
  {id:'FARM',name:'Farmácia'},
  {id:'LAC',name:'Laboratório'},
  {id:'ODONTO',name:'Odontologia'},
] as const;
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
  return <span aria-hidden="true" className={'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-300/30 bg-[#10243f] text-slate-100 shadow-sm '+className} style={{width:size,height:size}}>
    {src&&!failed?<Image src={src} alt="" width={size} height={size} quality={75} className="h-full w-full object-cover" onError={()=>setFailed(true)}/>:<UserRound style={{width:size*.48,height:size*.48}}/>}
  </span>;
}
