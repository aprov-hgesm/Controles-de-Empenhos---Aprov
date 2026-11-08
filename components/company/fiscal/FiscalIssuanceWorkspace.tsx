'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useCompanySession } from '../CompanySessionContext';
import {
  createTenantRequestBoundary, selectVerifiedProfile, safeConnection, safeIssues,
  fiscalSubmissionGate, displayIssueState, cleanCnpj, type FiscalProfile, type FiscalConnection,
  type FiscalCapability, type FiscalIssueSummary, type FiscalDraft,
} from '../../../features/company/fiscal/flow.mjs';
import { createFiscalBrowserApi } from '../../../features/company/fiscal/api.mjs';

type FormValues = {
  orderId:string; recipientCnpj:string; recipientName:string; series:string; number:string;
  itemId:string; description:string; quantity:string; unitPrice:string;
  ncm:string; cfop:string; taxation:string;
};
const initialForm:FormValues={
  orderId:'',recipientCnpj:'',recipientName:'',series:'1',number:'',
  itemId:'',description:'',quantity:'1',unitPrice:'',
  ncm:'',cfop:'',taxation:'',
};
const inputClass='mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-600';
const cardClass='rounded-2xl border border-slate-200 bg-white p-5 sm:p-6';
const digits=(value:string)=>value.replace(/\D/g,'');
const formatCnpj=(raw:string)=>raw.replace(/^([A-Z0-9]{2})([A-Z0-9]{3})([A-Z0-9]{3})([A-Z0-9]{4})(\d{2})$/,'$1.$2.$3/$4-$5');
const formatBrl=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
const errorText=(error:unknown)=>error instanceof Error?error.message:'Serviço fiscal temporariamente indisponível.';
const makeIntentKey=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():'';
const isCapable=(data:Record<string,unknown>):FiscalCapability|null=>{
  const c=data.capabilities;
  if (!c||typeof c!=='object')return null;
  const obj=c as Record<string,unknown>;
  return typeof obj.companyId==='string' && typeof obj.issuerCnpj==='string'
    && typeof obj.environment==='string' && obj.canIssue===true
    ?{companyId:obj.companyId,issuerCnpj:cleanCnpj(obj.issuerCnpj),
      environment:obj.environment,canIssue:true}:null;
};

export function FiscalIssuanceWorkspace({getIdToken}:{getIdToken:()=>Promise<string>}) {
  const session=useCompanySession();
  const scope=session?.workspaceId||'';
  const boundary=useRef(createTenantRequestBoundary());
  const submitBusy=useRef(false);
  const api=useMemo(()=>createFiscalBrowserApi({getIdToken}),[getIdToken]);
  const [profile,setProfile]=useState<FiscalProfile|null>(null);
  const [connection,setConnection]=useState<FiscalConnection|null>(null);
  const [capabilities,setCapabilities]=useState<FiscalCapability|null>(null);
  const [issues,setIssues]=useState<FiscalIssueSummary[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [unavailable,setUnavailable]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [form,setForm]=useState<FormValues>(initialForm);
  const [review,setReview]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [uncertain,setUncertain]=useState(false);

  const wipe=useCallback(()=>{
    boundary.current.rotate(null);
    submitBusy.current=false;
    setProfile(null);setConnection(null);setCapabilities(null);setIssues([]);
    setForm({...initialForm});setReview(false);setConfirmed(false);
    setMessage('');setError('');setBusy(false);setUncertain(false);
    setUnavailable(true);setLoading(true);
  },[]);

  const refresh=useCallback(async()=>{
    if(!scope)return;
    const snapshot=boundary.current.capture(scope);
    setRefreshing(true);setError('');
    try{
      const profilePayload=await api.profiles(snapshot.signal);
      if(!snapshot.current())return;
      const active=selectVerifiedProfile(profilePayload,scope);
      setProfile(active);
      const [wlg,fiscal]=await Promise.allSettled([
        api.connection(snapshot.signal),api.nfe(snapshot.signal),
      ]);
      if(!snapshot.current())return;
      if(wlg.status==='fulfilled')setConnection(safeConnection(wlg.value,active));
      else setConnection({state:'unavailable'});
      if(fiscal.status==='fulfilled') {
        setUnavailable(false);
        setCapabilities(isCapable(fiscal.value));
        setIssues(safeIssues(fiscal.value,active));
      } else {
        setUnavailable(true);setCapabilities(null);setIssues([]);
        // 503 is an expected fail-closed backend; display it as not activated.
      }
    }catch(e){
      if(!snapshot.current())return;
      setProfile(null);setConnection(null);setCapabilities(null);setIssues([]);
      setUnavailable(true);setError(errorText(e));
    }finally{
      if(snapshot.current()){setLoading(false);setRefreshing(false);}
    }
  },[api,scope]);

  useEffect(()=>{
    if(!scope){wipe();return;}
    boundary.current.rotate(scope);
    setProfile(null);setConnection(null);setCapabilities(null);setIssues([]);
    setForm({...initialForm});setReview(false);setConfirmed(false);
    setUncertain(false);setUnavailable(true);setLoading(true);
    void refresh();
    return ()=>{boundary.current.rotate(null);};
  },[scope,refresh,wipe]);

  useEffect(()=>{
    const handler=(event:StorageEvent)=>{
      if(event.key!=='emprovex.company.profile.changed')return;
      wipe();window.location.replace('/empresa');
    };
    window.addEventListener('storage',handler);
    return ()=>window.removeEventListener('storage',handler);
  },[wipe]);

  const update=(key:keyof FormValues,value:string)=>{
    setForm(previous=>({...previous,[key]:value}));setReview(false);
    setConfirmed(false);setMessage('');
  };
  const draft=useMemo(():FiscalDraft|null=>{
    if(!profile)return null;
    return {
      companyId:profile.companyId,issuerCnpj:profile.cnpj,
      orderId:form.orderId.trim(),recipientCnpj:cleanCnpj(form.recipientCnpj),
      recipientName:form.recipientName.trim(),series:Number(form.series),number:Number(form.number),
      items:[{itemId:form.itemId.trim(),description:form.description.trim(),
        quantity:Number(form.quantity),unitPrice:form.unitPrice,
        ncm:digits(form.ncm),cfop:digits(form.cfop),taxation:form.taxation.trim()}],
    };
  },[form,profile]);
  const previewValid=Boolean(draft && draft.orderId && draft.recipientCnpj.length===14 &&
    /^\d{14}$/.test(draft.recipientCnpj) && draft.recipientName && form.itemId.trim() && form.description.trim() &&
    /^\d{8}$/.test(digits(form.ncm)) && /^\d{4}$/.test(digits(form.cfop)) &&
    form.taxation.trim() && Number.isSafeInteger(draft.series) && draft.series>=1 &&
    Number.isSafeInteger(draft.number) && draft.number>0 &&
    Number.isFinite(Number(form.quantity)) && Number(form.quantity)>0 &&
    /^\d+(?:[.,]\d{1,2})?$/.test(form.unitPrice) && Number(form.unitPrice.replace(',','.'))>0);
  const total=(Number(form.quantity)||0)*(Number(form.unitPrice.replace(',','.'))||0);
  const gate=fiscalSubmissionGate({
    profile,connection,capabilities,draft:previewValid?draft:null,
    confirmed:confirmed&&review,busy,uncertain,
  });

  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(!scope||!profile||!draft||!previewValid||!gate.allowed||submitBusy.current)return;
    const key=makeIntentKey();
    if(!key){setError('Navegador sem geração segura de identificador. Envio bloqueado.');return;}
    const release=boundary.current.lockSubmission(profile.companyId,key);
    if(!release)return;
    const snapshot=boundary.current.capture(profile.companyId);
    submitBusy.current=true;setBusy(true);setError('');setMessage('');
    try{
      // Exactly one POST per human-confirmed intent. No automatic retry on timeout.
      // Server still must independently verify W1 order, W3 RBAC, issuer and XML.
      const payload=await api.submit({
        action:'create_draft',orderId:draft.orderId,series:draft.series,number:draft.number,
        issuerCnpj:profile.cnpj,recipient:{cnpj:draft.recipientCnpj,name:draft.recipientName},
        items:draft.items,environment:'homologacao',
        confirmedIssuerCnpj:profile.cnpj,confirmedRecipientCnpj:draft.recipientCnpj,
      },key,snapshot.signal);
      if(!snapshot.current())return;
      if(payload.companyId!==profile.companyId ||
          payload.issuerCnpj!==profile.cnpj ||
          typeof payload.status!=='string'){
        setUncertain(true);
        setError('Resposta sem vínculo fiscal comprovado. Não reenviar; solicite conciliação.');
      } else {
        setMessage('Solicitação registrada. Consulte o estado fiscal; nenhuma autorização é presumida.');
        setReview(false);setConfirmed(false);
        await refresh();
      }
    }catch(e){
      if(!snapshot.current())return;
      if(e instanceof Error && 'code' in e && e.code==='UNKNOWN_OUTCOME'){
        setUncertain(true);
        setError('Resultado desconhecido após envio. Não clique novamente; consulte o status.');
      } else setError(errorText(e));
    }finally{
      release();submitBusy.current=false;
      if(snapshot.current())setBusy(false);
    }
  };

  return <section className="space-y-5 text-slate-900" aria-label="Portal fiscal empresarial">
    <header className="rounded-3xl border border-slate-200 bg-slate-950 px-5 py-6 text-white sm:px-7">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-300">EMPROVEX Empresas · Área fiscal</p>
      <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Emissão e acompanhamento de NF-e</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">Uma empresa por vez. Revisão humana obrigatória, status fiscal verificável e documentos privados.</p>
      <div className="mt-4 inline-flex rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
        HOMOLOGAÇÃO — sem valor fiscal · emissão real desabilitada
      </div>
    </header>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className={cardClass} aria-label="Identidade fiscal ativa">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Emitente verificado pelo servidor</p>
        {profile?<div className="mt-2">
          <h3 className="text-xl font-semibold">{profile.legalName}</h3>
          <p className="mt-1 text-sm">CNPJ {formatCnpj(profile.cnpj)}</p>
          <p className="mt-1 text-xs text-slate-500">Workspace: {profile.companyId}</p>
        </div>:<p className="mt-3 text-sm text-slate-600">{loading?'Validando perfil e autorização…':'Identidade fiscal indisponível. Nenhuma solicitação será enviada.'}</p>}
        <p className="mt-3 text-xs text-slate-500">Para trocar de empresa, use o seletor único no cabeçalho. A troca descarta intenções locais anteriores.</p>
      </section>
      <section className={cardClass} aria-label="Conexão fiscal">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Conexão fiscal deste CNPJ</p>
        <h3 className="mt-2 text-lg font-semibold">{connection?.state==='connected'?'Credencial cadastrada':connection?.state==='not_configured'?'Não configurada':'Conexão não disponível'}</h3>
        <p className="mt-2 text-sm text-slate-600">Ambiente: {connection?.environment==='homologacao'?'Homologação':connection?.environment==='producao'?'Produção (envio bloqueado)':'Não identificado'}</p>
        <p className="mt-1 text-sm text-slate-600">Verificação: {connection?.verifiedAt?'Registrada no servidor':'Pendente ou indisponível'}</p>
        <p className="mt-1 text-xs text-slate-500">Segredos e credenciais não são exibidos no navegador.</p>
        <button type="button" onClick={()=>void refresh()} disabled={!scope||loading||refreshing||busy}
          className="mt-4 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
          {refreshing?'Consultando…':'Reconsultar situação'}
        </button>
      </section>
    </div>

    {error&&<p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
    {message&&<p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900" role="status">{message}</p>}
    {unavailable&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">O serviço de emissão ainda não está habilitado. A conferência é local, não salva notas e não consulta documentos fiscais autorizados.</p>}

    <form onSubmit={submit} className={cardClass} aria-label="Prévia e revisão da NF-e">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Etapa 1 · Preencher</p>
          <h3 className="mt-1 text-xl font-semibold">Dados da intenção fiscal</h3></div>
        <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-600">Não salva dados no dispositivo</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">Preencha para revisão. O pedido, o vínculo fiscal, os tributos e o estoque ainda devem ser validados pelo backend antes de qualquer envio.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {([
          ['orderId','Pedido de origem','text'],['recipientCnpj','CNPJ do destinatário','text'],
          ['recipientName','Razão social do destinatário','text'],['series','Série','number'],
          ['number','Número proposto','number'],['itemId','ID do item no pedido','text'],
          ['description','Descrição do item','text'],['quantity','Quantidade','number'],
          ['unitPrice','Preço unitário (R$)','text'],['ncm','NCM (8 dígitos)','text'],
          ['cfop','CFOP (4 dígitos)','text'],['taxation','Regime tributário/CST-CSOSN','text'],
        ] as const).map(([key,label,type])=>
          <label key={key} className="block text-sm font-medium">{label}
            <input className={inputClass} type={type} value={form[key]}
              inputMode={key==='recipientCnpj'||key==='ncm'||key==='cfop'?'numeric':key==='unitPrice'?'decimal':undefined}
              min={type==='number'?'0':undefined} step={key==='quantity'?'any':'1'}
              maxLength={type==='text'?180:undefined}
              onChange={event=>update(key,event.target.value)}
              disabled={busy||!profile} autoComplete="off" />
          </label>
        )}
      </div>
      <p className="mt-4 text-sm text-slate-700">Subtotal informativo: <strong>{Number.isFinite(total)?formatBrl(total):'—'}</strong>. Tributação e total fiscal definitivo dependem da validação do motor.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" disabled={!profile||!previewValid||busy}
          onClick={()=>{setReview(true);setConfirmed(false);setError('');}}
          className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
          Gerar conferência local
        </button>
        <button type="button" disabled={busy} onClick={()=>{setForm({...initialForm});setReview(false);setConfirmed(false);/* Do NOT clear uncertain POST outcome on reset. */}}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">Descartar rascunho</button>
      </div>
      {!previewValid&&<p className="mt-3 text-xs text-slate-500">Para gerar a prévia, informe os campos do pedido, destinatário, item, valores e classificação fiscal.</p>}
      {profile && /[A-Z]/.test(profile.cnpj) && <p role="status" className="mt-4 text-sm text-amber-800">Este CNPJ alfanumérico é válido como identidade empresarial. O provedor fiscal ainda não confirmou suporte para emissão; nenhuma informação será convertida para dígitos.</p>}
      {review&&profile&&draft&&<section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5" aria-label="Confirmação fiscal">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Etapa 2 · Revisar e confirmar</p>
        <h4 className="mt-1 text-lg font-semibold">Conferência explícita</h4>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Emitente</dt><dd>{profile.legalName} · {formatCnpj(profile.cnpj)}</dd></div>
          <div><dt className="font-semibold">Destinatário</dt><dd>{draft.recipientName} · {formatCnpj(draft.recipientCnpj)}</dd></div>
          <div><dt className="font-semibold">Pedido</dt><dd>{draft.orderId}</dd></div>
          <div><dt className="font-semibold">Série e número</dt><dd>{draft.series} / {draft.number}</dd></div>
          <div><dt className="font-semibold">Classificação fiscal</dt><dd>NCM {digits(form.ncm)} · CFOP {digits(form.cfop)} · {form.taxation}</dd></div>
          <div><dt className="font-semibold">Ambiente</dt><dd>Homologação — sem valor fiscal</dd></div>
        </dl>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-blue-700" disabled={busy}/>
          <span>Conferi novamente o CNPJ emitente, o destinatário e os dados desta intenção. Estou ciente de que a prévia não é uma NF-e autorizada.</span>
        </label>
        <button type="submit" disabled={!gate.allowed||busy}
          title={!gate.allowed?gate.message:undefined}
          className="mt-4 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
          {busy?'Enviando uma única solicitação…':'Envio indisponível nesta etapa'}
        </button>
        {!gate.allowed&&<p role="status" className="mt-2 text-sm text-blue-900">{gate.message}</p>}
      </section>}
    </form>

    <section className={cardClass} aria-label="Consulta e histórico fiscal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Etapa 3 · Acompanhar</p>
          <h3 className="mt-1 text-xl font-semibold">Documentos do CNPJ ativo</h3></div>
        <button type="button" disabled={!profile||refreshing||busy}
          onClick={()=>void refresh()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
          Reconsultar status
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-600">HTTP 202 significa processamento. Apenas status autorizado com protocolo e verificação fiscal comprova a autorização.</p>
      {issues.length?<ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
        {issues.map(issue=><li key={issue.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0"><p className="break-all text-sm font-semibold">{issue.id}</p>
            <p className="text-xs text-slate-500">{issue.createdAt||'Data não informada'}</p></div>
          <span className="text-sm font-medium">{displayIssueState(issue)}</span>
          <div className="w-full text-xs text-slate-500">
            {issue.authorizationVerified?'XML autorizado deverá ser obtido exclusivamente por endpoint privado autenticado.':
              'XML e DANFE: indisponíveis sem autorização fiscal verificada.'}
          </div>
        </li>)}
      </ul>:<p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{loading?'Consultando documentos…':unavailable?'Consulta fiscal indisponível enquanto o backend está bloqueado.':'Nenhum documento deste perfil foi retornado.'}</p>}
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full border px-3 py-1">XML privado — integração pendente</span>
        <span className="rounded-full border px-3 py-1">DANFE privado — integração pendente</span>
        <span className="rounded-full border px-3 py-1">Cancelamento/CC-e — indisponíveis</span>
      </div>
    </section>
  </section>;
}
