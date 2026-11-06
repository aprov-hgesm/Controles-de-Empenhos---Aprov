import {Runner} from './engine.mjs';
export function mount() {
  if (document.getElementById('emprovex-bot')) return;
  const host = document.createElement('aside'); host.id = 'emprovex-bot';
  const shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = `<style>:host{display:block;position:fixed;right:20px;bottom:20px;z-index:9999;width:330px;font:14px system-ui;color:#e9f2ff}section{background:#11263f;border:1px solid #5f90b7;border-radius:18px;padding:20px;box-shadow:0 10px 35px #0008}h2{margin:0 0 8px;font-size:20px}label{display:block;margin:12px 0}input{width:95%;padding:8px;background:#071828;color:white;border:1px solid #58728a;border-radius:6px}button{padding:10px;margin:5px 4px 5px 0;cursor:pointer;border:0;border-radius:6px}pre{white-space:pre-wrap;max-height:180px;overflow:auto;font-size:11px}small{color:#a8c6db}</style><section><h2>EMPROVEX Lances</h2><small>LABORATÓRIO • SEM VALOR REAL</small><p id="scope"></p><label>Limite aprovado (piso ou teto)<input id="limit" value="8.5000" inputmode="decimal"></label><label>Passo de lance<input id="step" value="0.1000" inputmode="decimal"></label><button id="arm">Ativar simulação</button><button id="stop">Parar</button><p id="status">Desarmado</p><pre id="log" aria-live="polite"></pre></section>`;
  document.body.append(host);
  const el = id => shadow.getElementById(id);
  const read = () => JSON.parse(document.getElementById('portal-state').textContent);
  const log = [];
  const runner = new Runner({kind:'simulator', observe:async () => read(), submit:async intent => {
    const input = document.getElementById('bid-intent'); input.value = JSON.stringify(intent);
    document.getElementById('bid-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    return JSON.parse(document.getElementById('receipt').textContent);
  }}, {onEvent:e => {log.unshift(JSON.stringify(e));el('log').textContent=log.slice(0,20).join('\n');el('status').textContent=runner.status;}});
  const scope = read(); el('scope').textContent = `${scope.companyId} · ${scope.auctionId} · ${scope.itemId}`;
  el('arm').onclick = () => {try {
    runner.arm({...read(),limit:el('limit').value,step:el('step').value,maxAgeMs:2500,minIntervalMs:2000,maxBids:20});
    el('limit').disabled = el('step').disabled = true;
  } catch(e) {el('status').textContent=e.message;}};
  el('stop').onclick = () => {runner.stop();el('limit').disabled=el('step').disabled=false;};
  const timer = setInterval(() => runner.tick(),500);
  addEventListener('pagehide',() => {clearInterval(timer);runner.stop();},{once:true});
}
