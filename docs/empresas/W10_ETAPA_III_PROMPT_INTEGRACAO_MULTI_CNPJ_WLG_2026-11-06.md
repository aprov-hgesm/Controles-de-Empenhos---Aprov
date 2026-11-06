# EMPROVEX Empresas — Prompt Oficial do W10 Etapa III
**Checkpoint:** integração W12 + W13 + W14 sobre W10 Etapa II.  
**Registro:** 06/11/2026 | **Estado:** prompt de execução, não implementação.  
**Fontes:** Memorial Oficial, PRs #510/#511/#520/#525/#521/#522/#526 e handoffs correspondentes.

O integrador deve criar uma **PR Draft nova**; este documento não cria branch de código, não faz merge/deploy, não contrata WLG nem emite NF-e.

## Prompt de ativação — copiar integralmente

```text
/goal Você é o Worker W10 — Etapa III (Integração Multi-CNPJ + Fiscal WLG) do EMPROVEX Empresas.

MISSÃO EXECUTIVA
Execute efetivamente, em código e testes, o checkpoint de integração dos módulos W12, W13 e W14 com o W10 — Etapa II. Não crie implementação paralela dos Workers, não altere a main e não se limite a um plano. Abra uma nova PR Draft de integração, sem merge, deploy, emissão de NF-e real, criação de credenciais/contas WLG ou liberação de piloto. Este checkpoint é técnico, não autorização de uso comercial.

REPOSITÓRIO E LEITURAS OBRIGATÓRIAS
Repo: aprov-hgesm/Controles-de-Empenhos---Aprov.
- PR #510 — docs/EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md, Auditoria R1-M e docs/empresas/PLANO_MULTI_CNPJ_WLG_W12_W15_2026-11-06.md.
- W0 #511 e W3 #514: diretórios de identidade, sessões, cadastro, memberships e RBAC.
- W10 Etapa I #520, HEAD de referência 46af306ea67e2c5d45f8a2af922ef2781e154212.
- W10 Etapa II #525, HEAD de referência 49c8670a66ad858724454eff0683696dcb7efcd3; docs/empresas/W10_ETAPA_II_HANDOFF_2026-11-06.md; workflows W10/W11/Core/Fast/Visual-R2.
- W12 Perfis #521, HEAD de referência f6fe0743df07d34c5161de58e985e30857d2060e; lib/company/profiles/HANDOFF_W12_2026-11-06.md.
- W13 WLG #522, HEAD de referência d17c45d9e809332a9a396a20f12391ed5322bed6; lib/company/fiscal/wlg/W13_HANDOFF.md.
- W14 NF-e #526, HEAD de referência 9f188001741d8ecc6eae9b98162f0f8c6cc15003; lib/company/fiscal/issuance/W14_HANDOFF.md.
- W1 #513 (pedidos/NE), W4 #512 (shell), W5 #515 (arquivos privados), W8 #517 (financeiro) e contratos W9/W11 já integrados em #525.
Antes de qualquer escrita consulte HEADs atuais, base, mudanças pendentes, PRs e escopos; os SHAs acima são marcos, não ordens para sobrescrever atualizações posteriores.

BASE / BRANCH / DEDUPLICAÇÃO
1. CRIE branch isolada de integração a partir do HEAD VIGENTE de #525, por exemplo integration/emprovex-empresas-w10-stage3-fiscal-multicnpj-20261106. Não partir da main nem do W10-I.
2. Importe por blobs/commits seletivos os arquivos exclusivos W12 (#521), W13 (#522) e W14 (#526), preservando SHA e árvore original de cada módulo; documente matriz de proveniência. Atenção: a branch W14 deriva da W13, logo o conector W13 já está no histórico de W14 — NÃO duplicar arquivos nem motores. Resolver incompatibilidades como integrador, sem reescrever os módulos indiscriminadamente.
3. Só o W10-III altera arquivos transversais: lib/server/companySession.ts, lib/server/companyAuthz/**, lib/server/companyMembership/**, lib/company/contracts/**, provisioning/índices de identidade, endpoints comuns, app/empresa/**, componentes de navegação/conta e pipelines de integração. Compatibilize patches com W0–W11 sem enfraquecer segurança. Não tocar áreas militares, Almoxarifado, Warehouse, Eleonor, billing, Firestore Rules/IAM/Cloud Run produtivos, senhas ou produção.
4. Se W15 já tiver PR, leia seu handoff para compatibilidade e NÃO absorva antecipadamente se sua integração ainda não estiver certificada. W15 terá checkpoint próprio de UX/QA.

ETAPA III-A — MULTI-CNPJ REAL NO SERVIDOR (P0)
- Manter um único Firebase Auth UID para o mesmo usuário em dois ou mais workspaces empresariais/CNPJs independentes. A mesma conta pode ser owner em A e member em B; nunca herdar owner ao trocar.
- Corrigir o modelo singular de W0: platformAccounts/{email}.workspaceId e platformAuthUidIndex/{uid}.workspaceId e a seleção singular companyMemberAuthIndex/{uid}. NÃO sobrescrever esses vínculos para alternar empresa nem criar outra conta Auth para a mesma pessoa.
- Implementar extensão ADITIVA: índice de descoberta limitado por UID e vínculos canônicos verificáveis por companyId (ownerBinding e/ou membership W3), incluindo unicidade transacional via platformCnpjIndex, aprovação de representação do segundo CNPJ por fonte confiável do servidor/administrador, CAS, idempotência e auditoria. Índice de descoberta NUNCA concede autorização sozinho.
- Provisionamento do segundo CNPJ em Auth/Firestore Emulator real (projeto demo-* e loopback), com transação atômica, conflito e rollback; não autorizar cadastros reais ou usar simples declaração/checkbox do usuário para comprovar representação.
- Integre GET/POST/select de /api/company/profiles e CompanyProfileSwitcher no portal. Cookie __Host- com HMAC e expiração curta, ligado a UID/auth_time, Secure/HttpOnly/SameSite; decisão de CSRF para qualquer mutação com cookie. O cookie é apenas SELEÇÃO; cada request valida ID token, UID, e-mail verificado, status ativo, empresa selecionada, papel/capability live e ownership do recurso.
- Em duas abas, mudança A→B invalida estado/requests/caches anteriores; respostas tardias de A não aparecem em B. Rotas sem perfil ou de clientes legados com apenas um workspace mantêm compatibilidade segura. Tenant A jamais acessa entidade ou conexão WLG B. Revogação/suspensão são reconhecidas imediatamente. Sem fallback empresa↔setor/fundador.
- Não usar companyId, CNPJ, empresaId WLG, claims ou papel vindos de query/body/localStorage como prova de acesso. A fonte canônica é autorização live em servidor para a empresa ativa e o recurso.

ETAPA III-B — WLG SEGREGADA POR CNPJ (P0)
- Integre FiscalProvider W13 server-only com WlgConnection por workspace/CNPJ/ambiente; bindings de companyId↔empresaId WLG↔CNPJ/verificação de emitente auditáveis. Confirmar o escopo de credenciais efetivo no fornecedor; não presumir clientId/clientSecret exclusivo por CNPJ. Bloquear configuração com prova insuficiente.
- Persistir apenas metadados não secretos no Firestore empresarial (fiscalConnections e coleções necessárias por contrato), com revisões CAS, auditoria e ACL. Credenciais e tokens EXCLUSIVAMENTE no servidor, via abstração de Secret Manager/serviço seguro aprovado; não criar segredo real, não alterar IAM, não colocar segredo em Firestore, repo, HTML, resposta, rastreio nem logs. Se SecretResolver real ou permissão IAM não estiver pronta, manter 503/flag OFF e fornecer teste com falso cofre em Emulator.
- Ações próprias fiscal:read, fiscal:configure, fiscal:approve, fiscal:issue e fiscal:download, ou equivalentes tipados/menor privilégio definidos de forma central, com matriz W3 e revogação live. Ações transitórias accountsReceivable:read/members:write não podem, por si só, liberar emissão.
- Rotas /api/company/fiscal/connections devem listar apenas estado público do perfil ativo, guardar configurações somente se o backend realmente suportar persistência/ACL e rejeitar empresaId/CNPJ divergentes. Desconexão/rotação invalida cache e bloqueia emissão sem afetar finanças logísticas.
- Verificar contrato oficial WLG/Swagger atualizado, segurança HTTPS, rate limit e política de custos, sem inventar API de eventos. WLG anuncia POST assíncrono; HTTP 202 significa processamento, nunca autorização. Uma falha/timeout após POST não autoriza novo POST automático.

ETAPA III-C — MOTOR W14 COM PERSISTÊNCIA E INTEGRIDADE FISCAL (P0)
- Integrar FSM W14 com W13 e W12 em servidor; rascunho→revisão→aprovação humana explícita→submissão/consulta→autorizada|rejeitada|incerta. Campos fiscais NCM/CFOP/CST/CSOSN/tributos e destinatário exigem conferência humana; o EMPROVEX não inventa tributação.
- Implementar FiscalStore transacional com idempotência e reserva de número/série por tenant/CNPJ/ambiente, CAS e auditEvents; revalidar pedido/linhas/quantidades parciais W1 e revisão antes de enviar. Retry com mesma chave consulta resultado; timeout ambíguo permanece uncertain e exige reconciliação, nunca reenvio cego.
- Criar adaptadores server-only para verificação de XML autorizado (assinatura XMLDSig, cadeia e protocolo SEFAZ, chave/emitente/ambiente, cStat adequado, integridade) e DANFE com proveniência e vínculo comprovados; armazenar ambos de forma tenant-private via mecanismo W5 e hashes. Se não existir implementação confiável do verificador/arquivo, a autorização e disponibilização fiscal FALHAM FECHADAS; não substituir por regex, mock ou PDF arbitrário.
- APIs fiscais GET/POST só devem sair do status 503 quando todas as dependências críticas estiverem ligadas e testadas. Caso a homologação externa ou segredos não estejam autorizados, manter operações reais desabilitadas e testar pipeline integral com provedor simulado no Firestore Emulator — não anunciar NF-e autorizada real.
- NF-e não confirma despacho/entrega/atesto, não cria baixa financeira no W8, não emite automaticamente ao trocar CNPJ/abrir tela. Cancelamento/CC-e ficam bloqueados enquanto contrato WLG não comprovado. Preservar W1–W11 e não criar ledger fiscal-financeiro duplicado.

TESTES OBRIGATÓRIOS (EVIDÊNCIAS REAIS)
A. Unitários de W12/W13/W14 e regressão W0–W11 no HEAD; W13 deve executar realmente node --test lib/company/fiscal/wlg/w13.test.mjs (não aceitar só execução isolada de V8). Separar unitários dos testes que exigem Emulator, como feito em W10-II.
B. Auth + Firestore Emulator REAL com 1 UID em CNPJ A e B, outro UID só A, owner A/member B, suspenso/revogado, duas abas alternando, convite W3 multiempresa, index CNPJ concorrente, falha de transação, idempotência e acesso cruzado negado; índices legados W0 permanecem íntegros.
C. CNPJ A/B com WLGConnection diferentes; requests forjados com empresaId de outro perfil, segredo exposto, perda de permissão, rotação/revogação, 401/403, 429/5xx, HTTP 202, rejeição, timeout antes/depois do POST, reconciliação, confirmação de XML/emitente incompatível, XML inválido, DANFE não autenticado; tudo em MOCk WLG declarado.
D. Persistência Firestore REAL de número/série/reserva/CAS, mesmo idempotencyKey replay, outra chave não duplica emissão, crash após reserva antes de resposta, duas abas e mudança de perfil durante fluxo, pedido W1 alterado/quantidade parcial inválida; sem enviar nota real.
E. Fluxo de navegador empresarial desktop/mobile/teclado quando UI W12 disponível: login empresarial, seleção A/B, cache invalidado, perfis e conexões corretos; não confundir Visual-R2 geral com E2E empresarial. W15 ainda pode estar pendente e deve ter cenário SKIPPED legítimo documentado.
F. npm ci, npm run typecheck, npm run build, Core Protection, Fast CI, W10, R1 Sync e Visual-R2. Inspecionar CI no SHA FINAL da nova PR. Relatar separadamente PASS/FAIL/SKIPPED/PENDING; não declarar CI verde de heads anteriores como certificação do novo SHA. Testes real WLG/SEFAZ só se explicitamente autorizados e com ambiente/cadastro de QA legítimo, fora do escopo padrão.

GATES NÃO NEGOCIÁVEIS
- EMPROVEX_COMPANY_PILOT_ENABLED permanece OFF fora do Emulator; flags de emissão e homologação ficam OFF por padrão. Nenhuma requisição fiscal real, cadastro de empresa, contrato comercial, mudança de IAM/Rules/Cloud Run, cobrança ou publicação sem autorização EXPRESSA posterior.
- Antes de emissão real, obter permissão ESCRITA WLG para integração no SaaS EMPROVEX e para uso por clientes terceiros, confirmar escopo seguro por CNPJ/empresaId, certificado A1 e requisitos fiscais/privacidade. A disponibilidade de API gratuita não é licença de comercialização. Consulta Swagger deve ser fonte atual; se indisponível, bloquear capacidades desconhecidas.
- Nunca deixar uma falha de acesso de empresa derrubar login militar legítimo. Não permitir bypass por UID compartilhado com membro, revalidação de perfil ou segredo global.
- Se integração fiscal depender de Secret Manager sem IAM, assinatura fiscal confiável, emissão remota e armazenamento ainda ausentes, pode dar GO ao modelo/testes isolados, mas a API de emissão permanece 503 e o parecer de operacionalização é NO-GO.

ARQUIVOS E DESTINO
Crie somente uma nova branch de integração e nova PR Draft W10-III baseada em #525, sem alterar a #525 ou PRs originárias. Como integrador, você pode tocar arquivos compartilhados empresariais estritamente necessários, registrando cada alteração. Não mesclar as PRs originais; importar código seletivo com origem comprovada. Se encontrar conflito com W15, não sobrepor trabalho alheio, registrar handoff.
Crie docs/empresas/W10_ETAPA_III_HANDOFF_2026-11-06.md na branch de código, com proveniência de cada blob/commit, arquitetura e contratos alterados, testes reais e matriz de bloqueios, operações desativadas, rollback e SHA final. Atualize a descrição da PR com links de CI.

RESULTADO ESPERADO
Entregar perfis empresariais A/B efetivamente isolados em QA, vinculação WLG por CNPJ e motor de NF-e integrado em modo simulado com persistência durável e proteções verificáveis; se houver dependências externas sem autorização, entregar o máximo seguro e manter funções bloqueadas. Pareceres separados: (1) GO/NO-GO técnico da branch W10-III; (2) GO/NO-GO multi-CNPJ com teste Auth/Firestore; (3) GO/NO-GO para interface W15; (4) NO-GO comercial/WLG real até evidências. Nenhum merge/deploy ou emissão produtiva.

EXECUTE EFETIVAMENTE. Sem burocracia desnecessária, sem inventar testes, sem afrouxar autorização, sem fornecer credenciais reais ao repositório.
```

## Observação de sequência
W15 (portal fiscal) é uma entrega de UI separada; sua montagem só deve acontecer após os contratos fiscais terem sido estabilizados e com QA próprio. A aprovação técnica de W10-II não equivale à homologação multi-CNPJ nem autoriza emissão na SEFAZ.

## Links
- [Memorial Oficial Empresas](../EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md)
- [Plano multi-CNPJ / WLG](./PLANO_MULTI_CNPJ_WLG_W12_W15_2026-11-06.md)
- [PR #525 — W10 Etapa II](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/525)
- [PR #521 — W12](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/521)
- [PR #522 — W13](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/522)
- [PR #526 — W14](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/526)
