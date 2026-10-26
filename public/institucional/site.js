
(()=>{
 const tabs=[...document.querySelectorAll('[role="tab"]')], panels=[...document.querySelectorAll('[role="tabpanel"]')];
 function activate(t){tabs.forEach(x=>{const on=x===t;x.setAttribute('aria-selected',String(on));x.tabIndex=on?0:-1});panels.forEach(p=>{const on=p.id==='panel-'+t.dataset.tab;p.hidden=!on;p.classList.toggle('active',on)})}
 tabs.forEach((t,i)=>{t.addEventListener('click',()=>activate(t));t.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowLeft')next=(i-1+tabs.length)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();activate(tabs[next]);tabs[next].focus()})});
 const menu=document.getElementById('menu-toggle'),nav=document.getElementById('site-nav');menu.addEventListener('click',()=>{const next=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(next));menu.setAttribute('aria-label',next?'Fechar menu':'Abrir menu');nav.classList.toggle('open',next)});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Abrir menu')}));
 const contactForm=document.getElementById('contact-form');
 const whatsappInput=document.getElementById('whatsapp');
 const submitButton=contactForm.querySelector('button[type="submit"]');
 const formStatus=document.getElementById('form-status');
 const buttonOriginal=submitButton.innerHTML;
 whatsappInput.addEventListener('input',()=>whatsappInput.setCustomValidity(''));
 contactForm.addEventListener('submit',async(e)=>{
  e.preventDefault();
  if(submitButton.disabled)return;
  formStatus.textContent='';formStatus.dataset.state='';formStatus.classList.remove('visible');
  for(const input of contactForm.querySelectorAll('input:not([type="hidden"])'))input.value=input.value.trim();
  const digits=whatsappInput.value.replace(/\D/g,'');
  const national=(digits.length===12||digits.length===13)&&digits.startsWith('55')?digits.slice(2):digits;
  if(!/^[1-9][0-9]{9,10}$/.test(national)){
   whatsappInput.setCustomValidity('Informe um número válido com DDD (10 ou 11 dígitos).');
   whatsappInput.reportValidity();return;
  }
  if(!contactForm.reportValidity())return;
  const request={
   nomeCompleto:contactForm.elements.namedItem('nomeCompleto').value,
   patente:contactForm.elements.namedItem('patente').value,
   organizacaoMilitar:contactForm.elements.namedItem('organizacaoMilitar').value,
   email:contactForm.elements.namedItem('email').value,
   whatsapp:'+55'+national,
   website:contactForm.elements.namedItem('website').value,
   source:'emprovex-institucional',
  };
  submitButton.disabled=true;submitButton.textContent='Enviando solicitação…';
  contactForm.setAttribute('aria-busy','true');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch(contactForm.action,{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    cache:'no-store',body:JSON.stringify(request),signal:controller.signal
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok||result.ok!==true)throw new Error(response.status===429?'Muitas solicitações em sequência. Aguarde um pouco e tente novamente.':(typeof result.error==='string'&&response.status<500?result.error:'Não foi possível concluir o envio neste momento. Tente novamente.'));
   formStatus.textContent='Solicitação recebida! Nossa equipe entrará em contato pelos dados informados.';
   formStatus.dataset.state='success';contactForm.reset();
  }catch(error){
   formStatus.dataset.state='error';
   formStatus.textContent=error?.name==='AbortError'?'A conexão demorou a responder. Verifique sua internet e tente novamente.':(error?.message||'Não foi possível enviar sua solicitação. Tente novamente.');
  }finally{
   clearTimeout(timeout);submitButton.disabled=false;submitButton.innerHTML=buttonOriginal;
   contactForm.removeAttribute('aria-busy');formStatus.classList.add('visible');
  }
 });

 // VIDEOTECA R11: nenhum player é carregado até o clique do visitante.
 // Metadados da curadoria são fixos e as URLs reais foram fornecidas pelo proprietário.
 const videoDialog=document.getElementById('video-dialog');
 const videoFrame=document.getElementById('video-frame');
 const videoTitle=document.getElementById('video-dialog-title');
 const videoOriginal=document.getElementById('video-original-link');
 const allowedVideos=new Set(['SCnT_-bBb8I','Fuo0-XADCRw','Hmt9__qnqJ0','CPJeUKmvrIo','38UXm8hfrA0','d6AX6aBIPbE','LxOMxEwudH8','tx5EmAW2XfQ','VGSjPgYeoJk','rPlKeOHgmpA','JU8ed1vhP9Y','UIMqKvoMeYI','tqUAd9L1lfg','qgv2ZbavrKk']);
 let lastVideoTrigger=null;
 function closeVideo(){if(videoDialog.open)videoDialog.close();videoFrame.replaceChildren()}
 document.getElementById('video-dialog-close').addEventListener('click',closeVideo);
 videoDialog.addEventListener('close',()=>{if(!videoDialog.open){videoFrame.replaceChildren();lastVideoTrigger?.focus()}});
 videoDialog.addEventListener('click',e=>{if(e.target===videoDialog)closeVideo()});
 document.querySelectorAll('[data-video-id]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.videoId;if(!allowedVideos.has(id))return;
  lastVideoTrigger=button;videoTitle.textContent=button.dataset.videoTitle;
  videoOriginal.href='https://www.youtube.com/watch?v='+encodeURIComponent(id);
  const iframe=document.createElement('iframe');iframe.title=button.dataset.videoTitle+' — YouTube';
  iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';
  iframe.setAttribute('allow','accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
  iframe.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0&playsinline=1';
  videoFrame.replaceChildren(iframe);videoDialog.showModal();
 }));
 document.querySelectorAll('.screening-episodes').forEach(group=>{
  const track=group.querySelector('.screening-track');
  const arrows=[...group.querySelectorAll('.screening-arrow')];
  function update(){arrows[0].disabled=track.scrollLeft<=3;arrows[1].disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-3}
  arrows.forEach(a=>a.addEventListener('click',()=>{
   const card=track.querySelector('.episode');const stride=card?card.getBoundingClientRect().width+16:270;
   track.scrollBy({left:Number(a.dataset.direction)*stride,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  }));
  track.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',update,{passive:true});update();
 });
 // Prévia interativa dos fluxos móveis; operações reais exigem sessão autenticada.
 let step=0;let scanType='local';
 const scenes=[
  {title:'Identifique o local ou material.',text:'Leia o código de barras da etiqueta de um local ou de um material para iniciar a saída.'},
  {title:'Escolha o registro correspondente.',text:'Pelo código do local, selecione o material armazenado. Pelo código do material, selecione o local quando houver mais de uma opção.'},
  {title:'Informe a quantidade.',text:'Informe a quantidade que será retirada do local selecionado.'},
  {title:'Indique o destino.',text:'Selecione o destino da saída. O usuário responsável já é identificado pela sessão.'},
  {title:'Revise antes de confirmar.',text:'Confira código, material, local, quantidade e destino. A confirmação real só acontece dentro da plataforma autenticada.'}
 ];
 const nextStep=document.getElementById('next-mobile-step'),workspace=document.getElementById('phone-workspace');
 function renderMobile(){
  const scene=scenes[step];
  document.getElementById('stage-label').textContent='ETAPA '+String(step+1).padStart(2,'0')+' / 05';
  document.getElementById('stage-title').textContent=scene.title;
  document.getElementById('stage-copy').textContent=scene.text;
  document.getElementById('phone-description').textContent='Etapa '+(step+1)+' de 5 — Fluxo de saída';
  const scanIsLocal=scanType==='local';
  const views=[
    `<span class="phone-hint">Ler etiqueta de</span><div class="scan-type"><button type="button" class="scan-option ${scanIsLocal?'selected':''}" aria-pressed="${scanIsLocal}" data-scan="local">Local</button><button type="button" class="scan-option ${!scanIsLocal?'selected':''}" aria-pressed="${!scanIsLocal}" data-scan="material">Material</button></div><div class="phone-result"><span>Código identificado</span><strong>${scanIsLocal?'Local A-01-02':'Material 7890000000000'}</strong></div>`,
    scanIsLocal?`<span class="phone-hint">Itens encontrados no local</span><div class="phone-result"><strong>Arroz branco 5 kg</strong><em>Selecionado · Local A-01-02</em></div><div class="phone-result"><strong>Óleo vegetal 900 ml</strong><em>Outra opção disponível</em></div>`:`<span class="phone-hint">Locais que possuem o material</span><div class="phone-result"><strong>Local A-01-02</strong><em>Selecionado</em></div><div class="phone-result"><strong>Local B-02-01</strong><em>Outra opção disponível</em></div>`,
    `<span class="phone-hint">Quantidade a retirar</span><div class="phone-result"><strong>2 unidades</strong><em>Material: Arroz branco 5 kg</em></div><div class="phone-result"><span>Saldo disponível</span><strong>24 unidades</strong></div>`,
    `<span class="phone-hint">Selecione o destino</span><div class="phone-result"><strong>Cozinha</strong><em>Destino selecionado</em></div><div class="phone-result"><span>Operador</span><strong>Usuário autenticado</strong></div>`,
    `<span class="phone-hint">Resumo da saída</span><div class="phone-result"><strong>Arroz branco 5 kg</strong><em>Local A-01-02 · 2 unidades<br>Destino: Cozinha<br>Usuário autenticado</em></div>`
  ];
  workspace.innerHTML=views[step];
  document.getElementById('phone-action').textContent=['Ler código','Selecionar','Continuar','Revisar saída','Concluir percurso'][step];
  nextStep.textContent=step===4?'Recomeçar percurso ↺':'Avançar etapa →';
 }
 workspace.addEventListener('click',e=>{const btn=e.target.closest('[data-scan]');if(!btn)return;scanType=btn.dataset.scan;renderMobile()});
 nextStep.addEventListener('click',()=>{step=(step+1)%5;renderMobile()});
 renderMobile();

})();
