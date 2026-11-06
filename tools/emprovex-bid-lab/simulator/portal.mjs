import {units} from '/engine.mjs';
const $ = id => document.getElementById(id);
const state = {portal:'local-simulator',companyId:'EMPRESA-DEMO',auctionId:'CERTAME-DEMO',itemId:'ITEM-1',direction:'reverse',precision:4,best:'10.0000',minStep:'0.1000',leaderIsSelf:false,phase:'open',connected:true,revision:1,observedAt:Date.now(),closesAt:Date.now()+600000};
const receipts = new Map();
let lastAcceptedAt = 0;
function publish(){if(state.connected)state.observedAt=Date.now();$('portal-state').textContent=JSON.stringify(state);$('best').textContent='R$ '+state.best;$('position').textContent=`${state.phase} • ${state.connected?'conectado':'desconectado'} • ${state.leaderIsSelf?'você lidera':'concorrente lidera'}`;}
function record(text){const li=document.createElement('li');li.textContent=text;$('history').prepend(li);}
$('bid-form').addEventListener('submit',e=>{e.preventDefault();let i;
  try {i=JSON.parse($('bid-intent').value);if(receipts.has(i.id)){$('receipt').textContent=JSON.stringify(receipts.get(i.id));return;}
    const amount=units(i.amount,4), best=units(state.best,4), step=units(state.minStep,4);
    const scope=['companyId','auctionId','itemId','portal','direction'].every(k=>i[k]===state[k]);
    const valid=scope && state.connected && state.phase==='open' && Date.now()<state.closesAt && i.revision===state.revision && Date.now()-lastAcceptedAt>=2000 && amount>0n && (state.direction==='reverse'?amount<=best-step:amount>=best+step);
    const receipt={id:i.id,status:valid?'accepted':'rejected',amount:i.amount};receipts.set(i.id,receipt);
    if(valid){state.best=i.amount;state.leaderIsSelf=true;state.revision++;lastAcceptedAt=Date.now();record('Robô: '+i.amount+' — aceito pelo simulador');}
    $('receipt').textContent=JSON.stringify(receipt);publish();
  }catch{$('receipt').textContent='{}';}
});
$('competitor').onclick=()=>{try{const v=$('rival').value,n=units(v,4),b=units(state.best,4),s=units(state.minStep,4);if(!state.connected||state.phase!=='open'||Date.now()>=state.closesAt||n<=0n||(state.direction==='reverse'?n>b-s:n<b+s))throw Error('Lance inválido para a fase ou intervalo.');state.best=v;state.leaderIsSelf=false;state.revision++;publish();record('Concorrente: '+v);$('feedback').textContent='Lance concorrente aceito.';}catch(e){$('feedback').textContent=e.message;}};
$('direction').onchange=()=>{state.direction=$('direction').value;state.revision++;publish();};
$('close').onclick=()=>{state.phase='closed';state.revision++;publish();};
$('disconnect').onclick=()=>{state.connected=false;publish();};
$('change').onclick=()=>{state.companyId='OUTRA-EMPRESA';state.revision++;publish();};
publish();setInterval(publish,500);
