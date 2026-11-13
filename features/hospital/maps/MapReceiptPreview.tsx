'use client';

import {useState} from 'react';
import {CheckCircle2,Clock3,FileDown,Printer,ShieldCheck} from 'lucide-react';
import {downloadMapReceipt,openMapReceiptForPrint,type MapReceiptDocument} from '../printing/map-receipt';

type Receipt=Pick<MapReceiptDocument,'mapId'|'unitId'|'localDate'|'cycleId'|'submittedAt'|'submittedByUid'|'submissionVersion'|'currentVersion'|'late'|'status'>;
type Meal={mealType:'PRIMARY'|'SECONDARY';status:string;recipientType?:string};
type Props={
 receipt:Receipt;meals:Meal[];unitLabel:string;
 receivedAt?:string|null;receivedByUid?:string|null;
 hasLateAmendment?:boolean;
};
const stamp=(at:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',
 dateStyle:'short',timeStyle:'short'}).format(new Date(at));
const date=(day:string)=>day.split('-').reverse().join('/');

export function MapReceiptPreview({receipt,meals,unitLabel,receivedAt,receivedByUid,hasLateAmendment}:Props){
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const current=meals.filter(x=>x.status!=='CANCELLED');
 const primary=current.filter(x=>x.mealType==='PRIMARY').length;
 const secondary=current.filter(x=>x.mealType==='SECONDARY').length;
 const companion=current.filter(x=>x.recipientType==='COMPANION').length;
 const received=Boolean(receivedAt);
 const content:MapReceiptDocument={
  mapId:receipt.mapId,unitId:receipt.unitId,unitLabel,localDate:receipt.localDate,
  cycleId:receipt.cycleId,submittedAt:receipt.submittedAt,submittedByUid:receipt.submittedByUid,
  submissionVersion:receipt.submissionVersion,currentVersion:receipt.currentVersion,
  status:receipt.status,late:receipt.late,hasLateAmendment,
  receivedAt,receivedByUid,primaryCount:primary,secondaryCount:secondary,companionCount:companion
 };
 const download=()=>{
  setError('');setNotice('');
  try{downloadMapReceipt(content);setNotice('Comprovante A4 salvo em PDF.');}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível gerar o comprovante.');}
 };
 const print=()=>{
  setError('');setNotice('');
  try{
   const mode=openMapReceiptForPrint(content);
   setNotice(mode==='preview'?'O comprovante foi aberto isoladamente para impressão.':
    'O navegador bloqueou a nova aba; o PDF foi baixado para impressão.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível abrir a impressão.');}
 };
 return <section data-testid="map-receipt" aria-label="Comprovante de envio do mapa" className="hospital-panel overflow-hidden border border-blue-100 text-slate-800">
  <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-[#0a1d3c] to-[#123f80] px-5 py-5 text-white sm:px-7">
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-sky-200">EMPROVEX · Cozinha Dietética</p>
      <h3 className="mt-1 text-xl font-extrabold tracking-tight">Comprovante de envio</h3>
      <p className="mt-1 text-xs text-blue-100">Registro institucional do mapa · {receipt.cycleId}h</p>
    </div>
    <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold">
      {received?<CheckCircle2 size={16}/>:<Clock3 size={16}/>}
      {received?'Recebimento confirmado':'Envio registrado'}
    </span>
  </div>
  <div className="space-y-5 p-5 sm:p-7">
    <div className="grid gap-3 sm:grid-cols-3">
      {[
       {label:'Unidade',value:unitLabel},
       {label:'Data do mapa',value:date(receipt.localDate)},
       {label:'Horário',value:receipt.cycleId+'h'}
      ].map(item=><div key={item.label} className="rounded-xl border border-slate-100 bg-[#f7faff] px-4 py-3">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#64809e]">{item.label}</p>
        <p className="mt-2 text-sm font-extrabold text-[#173b69]">{item.value}</p>
      </div>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {[
       {label:'Refeições principais',value:primary},
       {label:'Refeições secundárias',value:secondary},
       {label:'Acompanhantes',value:companion}
      ].map(item=><div key={item.label} className="rounded-xl border border-slate-100 p-3">
        <p className="text-xs font-semibold text-slate-500">{item.label}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#174680]">{item.value}</p>
      </div>)}
    </div>
    <p className="text-xs text-slate-500">
      Quantitativos da versão atual do mapa. Acompanhantes integram o total de refeições principais.
      {receipt.currentVersion>receipt.submissionVersion?' Os adendos posteriores estão incluídos.':''}
    </p>
    <div className="grid gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
      <div><p className="text-xs font-semibold text-slate-500">Enviado pela unidade</p>
        <p className="mt-1 font-bold text-[#1b426f]">{stamp(receipt.submittedAt)}</p></div>
      <div><p className="text-xs font-semibold text-slate-500">Recebido pela Cozinha</p>
        <p className="mt-1 font-bold text-[#1b426f]">{receivedAt?stamp(receivedAt):'Aguardando confirmação'}</p></div>
      <div><p className="text-xs font-semibold text-slate-500">Versões</p>
        <p className="mt-1 font-semibold">Envio {receipt.submissionVersion} · atual {receipt.currentVersion}</p></div>
      <div><p className="text-xs font-semibold text-slate-500">Identificador de rastreio</p>
        <p className="mt-1 break-all font-mono text-[11px] text-slate-700">{receipt.mapId}</p></div>
    </div>
    {(receipt.late||hasLateAmendment)&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
      Este mapa registra solicitação fora do prazo ou adendo extraordinário. O comprovante não altera o fluxo de preparo.
    </p>}
    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
      <button data-testid="map-receipt-download" type="button" className="hospital-primary-action inline-flex items-center gap-2" onClick={download}>
        <FileDown size={16}/> Baixar comprovante PDF
      </button>
      <button data-testid="map-receipt-print" type="button" className="hospital-secondary-action inline-flex items-center gap-2" onClick={print}>
        <Printer size={16}/> Abrir para imprimir
      </button>
    </div>
    <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
      <ShieldCheck size={16} className="mt-0.5 shrink-0"/> Comprovante sem nomes, leitos ou diagnósticos. O envio não comprova preparo, distribuição ou entrega física.
    </p>
    {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">{error}</p>}
    {notice&&<p role="status" className="text-xs font-semibold text-emerald-800">{notice}</p>}
  </div>
 </section>;
}
