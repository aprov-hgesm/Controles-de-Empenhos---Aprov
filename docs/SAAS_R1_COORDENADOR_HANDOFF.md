# EMPROVEX SaaS R1 — Handoff do Coordenador

Última atualização: **2026-10-02**
Integrador: `feat/saas-r1-commercializacao`
Baseline: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`


## 0. Ordem oficial vigente — 2026-10-02

A ordem da reta final foi reorganizada por decisão do fundador:

1. hardening técnico pré-piloto;
2. reconciliação SaaS↔Mobile;
3. recovery/restore + segurança/dependências + pacote health/Rules/release;
4. freeze do Release Candidate;
5. publicação controlada + smoke técnico;
6. **piloto real final**;
7. correções finais pós-piloto;
8. SAAS-J — certificação final;
9. lançamento completo mediante autorização explícita.

O piloto real **não está em execução neste momento**. T0 e toda a preparação anterior permanecem válidos.

Documento canônico: `docs/SAAS_R1_PRE_PILOTO_HARDENING.md`.

## 1. Missão do próximo Coordenador

Continuar o SaaS R1 sem reabrir a Performance R3 e sem transformar comercialização inicial em um projeto de infraestrutura ou fintech.

Ler, nesta ordem:
1. `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
2. `docs/SAAS_R1_PLANO_MESTRE.md`;
3. `docs/SAAS_R1_EXECUCAO_PARALELA.md`;
4. `docs/SAAS_R1_INTEGRATION_STATUS.md`;
5. este handoff;
6. `docs/TESTING_POLICY.md`;
7. `docs/DEVELOPMENT_CI_WORKFLOW.md`.

## 2. Estado confirmado

- R3 publicada em `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`.
- Vercel recebeu a release.
- Rules da Central foram publicadas.
- SaaS R1 possui branch integradora própria.
- SAAS-A foi concluída como freeze documental.
- Onda 1 foi **INICIADA em 2026-10-01 por autorização explícita do usuário**.
- **SAAS-B foi concluída, certificada e integrada** na branch coordenadora via PR #216 / squash `f91cda645...`.
- **SAAS-E foi concluída, certificada e integrada** via PR #215 / squash `82f2e643...`; PITR, delete protection e schedules diários já foram ativados nos dois bancos. Permanecem backup READY, restore real isolado e uptime/alertas.
- **SAAS-DL foi concluída, certificada e integrada semanticamente** em `733885c1...`; PR #214 foi fechado sem merge automático por conflito esperado com B/E já integradas.
- **SAAS-C foi concluída, certificada e integrada semanticamente** em `cf320ce3...`; PRs #213/#217 foram fechados sem merge automático.
- **A Onda 1 está concluída.**
- **SAAS-DS foi concluída, certificada e integrada** via PR #218 / squash `726436ac...`.
- **SAAS-I está INTEGRADA E APROVADA** para integração controlada da R1.

## 3. Decisão central

A R1 será **assistida e simples**.

Não construir:
- checkout;
- webhook;
- API Mercado Pago;
- auto-suspensão;
- signup público;
- multi-seat;
- helpdesk;
- migração de infraestrutura.

Reusar:
- billing OBSERVE;
- painel de assinaturas;
- provisionamento;
- Auth;
- workspace/UG;
- auditoria;
- Termos/Privacidade;
- backup;
- Monitoring.

## 4. Contrato comercial

- **R$ 70/mês — Plano Completo**.
- 30 dias de trial.
- 5º dia útil.
- 10 dias de tolerância.
- pagamento externo;
- confirmação manual;
- suspensão manual;
- reativação manual;
- sem exclusão de dados por falta de pagamento;
- founder exempt;
- VIP externo também usa `exempt`, sem cobrança e com acesso completo;

### Regra de produto

Existe **um único plano comercial** na R1: Plano Completo. Não criar tier de recursos, versão limitada ou módulo adicional pago.

A SAAS-B já migrou o baseline técnico de R$ 50 para R$ 70, implementou VIP/isento e preservou competências históricas. Esse contrato agora está integrado e deve ser tratado como dependência fixa pelas próximas frentes.

## 5. Estratégia de pagamento

R1:
- Link de Pagamento Mercado Pago e/ou Pix;
- EMPROVEX não processa pagamento;
- nenhuma credencial financeira no app;
- usuário é redirecionado ao provedor;
- fundador confirma no painel.

R1.1 potencial:
- Plano de Assinatura sem integração, se o piloto justificar redução de trabalho manual.

API/webhook: fora da R1.

## 6. Estratégia de enforcement

Não adicionar `get(billingAccounts)` a todas as Firestore Rules.

Depois de B+C:
- SAAS-DS cria ação administrativa founder-only;
- billing continua comercial;
- `workspace.status` + `platformAccount.status` continuam autorização;
- suspensão sincroniza para `disabled`;
- reativação sincroniza para `active`;
- leases são revogados;
- dados permanecem intactos.

Esse desenho reduz acoplamento e reaproveita o fail-closed existente.

## 6.1 Banco de dados

Não criar terceiro banco Firestore para o SaaS R1.

- billing/identidade/legal/lifecycle ficam no banco principal;
- Central permanece em `emprovex-warehouse`;
- cada banco mantém suas próprias Rules;
- novo banco só com nova decisão arquitetural baseada em necessidade real, nunca apenas para “organizar Rules”.

## 7. Onda 1 — INICIADA

Quatro workers independentes estão autorizados:

### B — INTEGRADA
Billing/regularização concluída em `7e288e79...` e integrada via PR #216 / `f91cda645...`.

### C — INTEGRADA
Onboarding/reset/troca de senha/checklist concluídos e integrados semanticamente em `cf320ce3...`. Browser E2E registrou 3/3 asserts PASS; o status cancelado foi teardown pós-teste e permanece documentado como tal.

### DL — INTEGRADA
Termos/Privacidade/aceite versionado integrados semanticamente em `733885c1...`. O `LegalAcceptanceGate` permanece isolado até a integração com SAAS-C/SAAS-I.

### E — INTEGRADA
Backup/recovery/health/runbook concluídos no repositório e integrados via PR #215 / `82f2e643...`. PITR, delete protection e backup diário já estão ativos nos dois bancos; backup READY, restore real e uptime/alerta reais continuam pendentes.

Eles devem trabalhar simultaneamente quando possível, sem editar domínio alheio. Cada worker encerra com handoff completo; o Coordenador valida e integra.

## 8. Depois da Onda 1

A Onda 1 foi concluída.

Sequência vigente:
1. executar SAAS-P sobre o candidato consolidado da integradora;
2. conectar o `LegalAcceptanceGate` ao shell sem bloquear superfícies públicas/recuperação;
3. validar a jornada combinada e a coordenação das Rules da Central;
4. executar piloto SAAS-P;
5. certificar SAAS-J, incluindo backup/restore/uptime reais;
6. somente então decidir publicação/abertura comercial.

## 9. Pontos que não podem ser perdidos

- Central está em banco Firestore próprio.
- Backup lógico atual não deve ser confundido com backup global.
- Usuário suspenso precisa acessar uma superfície pública de regularização.
- Aceite legal não é “consentimento LGPD” genérico.
- cancelado não significa deletado.
- billing não deve virar nova dependência cara das Rules.
- VIP não pode ter menos funcionalidades que cliente pagante.
- estado `exempt` é a semântica interna do VIP; não criar estado concorrente `vip`.
- não criar banco separado apenas para as Rules do SaaS.
- nenhum worker publica produção.
- Browser E2E é sob demanda.
- experiência do operador continua prioritária.

## 10. Evidências externas consideradas

Mercado Pago:
- mantém soluções de pagamento/planos por link sem integração;
- assinatura por API é uma camada separada e mais complexa.

Firestore:
- suporta backups agendados diários/semanais e restauração em novo banco.

Google Cloud Monitoring:
- suporta uptime público HTTPS, validação de resposta/SSL e alertas.

ANPD:
- possui guia e regime específico para agentes de pequeno porte, mas o enquadramento não deve ser presumido pelo software.

## 11. Critério de encerramento do Coordenador

O Coordenador só encerra o ciclo após:
- SAAS-J aprovada;
- estado de produção documentado;
- decisão explícita do usuário sobre abertura comercial.

Até lá, `main` e produção não são destino automático das workers.


## 12. Integração SAAS-B

A SAAS-B foi validada pelo Coordenador e integrada.

Evidências:
- worker HEAD `7e288e79e1514f91c9f0099392302ec7efd5cefe`;
- PR #216;
- squash `f91cda64582cc148bac340086be56163d366dd35`;
- Application CI #886, Core Protection #173 e Recovery #573: SUCCESS;
- billing tests 6/6;
- Firestore multi-tenant security: SUCCESS.

Contratos agora canônicos no código da integradora:
- preço 7000 centavos;
- Plano Completo único;
- VIP = `exempt`;
- founder = `exempt`;
- histórico financeiro não reprecificado;
- regularização externa por Link/Pix;
- `/regularizacao` pública;
- sem webhook/API;
- sem enforcement antes da SAAS-DS.

A falha do preview Vercel foi somente `build-rate-limit` e não representa falha da implementação.

Ajuste semântico do Coordenador: no cabeçalho, founder deve aparecer como `Fundador / Isento`; `VIP / Isento` fica reservado ao cliente externo isento.


## 13. Integração SAAS-E

A SAAS-E foi validada pelo Coordenador e integrada.

Evidências:
- worker funcional `e650191a52656347b45c2769f1d93be9d21b2eac`;
- handoff `d7eb0075f7db35e9e826bd7b2e8dc4a83d4ff897`;
- correção de trailing whitespace `8fb8e3ff3cd61bbc090a6a180528758930fdbd0f`;
- PR #215;
- squash `82f2e6432b979634cae8023a773e31efa8f0cd65`;
- Application CI #896, Core Protection #183 e Recovery #583: SUCCESS.

Contratos agora canônicos no repositório:
- `/api/health` público e sem leitura operacional;
- backup nativo planejado para os dois bancos congelados;
- retenção 14 semanas;
- PITR/delete protection no tooling;
- restore bloqueado para bancos de produção e direcionado a banco isolado;
- backup lógico preservado;
- nenhum terceiro banco;
- Cloud Monitoring como uptime oficial da R1.

Pendências externas não podem ser marcadas como concluídas sem evidência:
1. aplicar/verificar proteções e schedule nos dois bancos;
2. confirmar um backup READY por banco;
3. executar restore real em banco isolado;
4. publicar health em produção na release autorizada;
5. criar/testar uptime check, alerta e canal de notificação.

Essas pendências não bloqueiam a integração do código da SAAS-E, mas bloqueiam a certificação operacional final e a abertura do SaaS.


## 14. Integração SAAS-DL

A SAAS-DL foi validada e integrada semanticamente pelo Coordenador.

Evidências:
- worker funcional `4806adfb35d4bad29f32695ae6a9de327fe1f40d`;
- HEAD final/handoff `b460d1a41ca63c9e14b0c7004bbedfe4954fb633`;
- PR #214 fechado sem merge automático;
- integração coordenadora `733885c1729d43623058b2dcfe4bea82f4eacabe`;
- Application CI #892, SAAS-DL Legal #8, Core Protection #179 e Recovery #579: SUCCESS.

Motivo da integração semântica:
- o PR foi criado da base comum anterior a B/E;
- `package.json` e `firestore.rules` já haviam avançado na integradora;
- o Coordenador preservou integralmente os contratos de billing/recovery e aplicou somente os deltas legais certificados.

Contratos agora canônicos:
- Termos e Privacidade SaaS R1 versionados;
- pacote `saas-r1-2026-10-01`;
- aceite em `workspaces/{workspaceId}/legalAcceptances/{uid}__{legalBundleVersion}`;
- create-only, sem update/delete/list pelo tenant;
- timestamp autoritativo por `request.time`;
- isolamento por workspace/UID/e-mail/UG;
- VIP não recebe exceção jurídica;
- nenhum terceiro banco.

Pendência deliberada:
- conectar `LegalAcceptanceGate` apenas após Auth/workspace/UG resolvidos;
- não bloquear `/terms`, `/privacy`, recuperação de credenciais ou superfície pública de regularização;
- publicar as Rules legais somente na release autorizada;
- manter revisão jurídica humana como gate de abertura comercial quando aplicável.


## 15. Integração SAAS-C

A SAAS-C foi validada e integrada semanticamente pelo Coordenador.

Evidências:
- worker funcional `524432969c0bc07acdbce9539830e703a8374226`;
- teardown E2E `8c7fc09912b7b01208fda9f5c0b3be848641e0c4`;
- handoff final `8bd5f38ce31073bd01b43e05fb46c103a9fe696d`;
- PR #213 original fechado sem merge;
- PR técnico #217 fechado sem merge;
- integração coordenadora `cf320ce33f8bb9e667cf0eb59fcf456214109ed3`;
- Application CI #894, Core Protection #181 e Recovery #581: SUCCESS.

Browser:
- os três cenários dirigidos passaram;
- Playwright: `3 passed (30.9s)`;
- o job foi cancelado somente no teardown por subprocessos remanescentes;
- o runner foi corrigido para sinalizar grupos de processos no Linux;
- não alegar um novo workflow verde pós-correção, pois o conector não disparou Actions para o commit técnico.

Contratos agora canônicos:
- onboarding assistido;
- reset self-service Firebase com resposta neutra;
- troca da própria senha com reautenticação;
- founder Google-only;
- externo password-only;
- mensagens humanas de autorização;
- Minha conta;
- checklist local e não bloqueante;
- Drive opcional;
- sem Rules/Indexes/env/banco novo.

Com B+C integradas, a SAAS-DS está liberada.

A SAAS-I deverá posteriormente compor `LegalAcceptanceGate` com o shell, sem bloquear reset de credenciais, Termos/Privacidade ou regularização pública.


## 16. Integração SAAS-DS

A SAAS-DS foi validada e integrada pelo Coordenador.

Evidências:
- branch `saas-r1-ds-security-enforcement`;
- base `73c22a441249cd87b6d6e1dfeb69bcb005d663e9`;
- HEAD funcional `476efffaf60e5276e6d68ac9c2a425848b9fff66`;
- HEAD final `073b96886d54b33e7e188265eb1e53672fbd9b1c`;
- PR #218 clean/ready for review;
- squash `726436ac9db13eb5e0195cc33ac432005f3f113a`;
- Application CI #901, Core Protection #188, Recovery #588 e SAAS-DL Legal #13: SUCCESS.

Contratos agora canônicos:
- billing continua separado da autorização;
- suspensão é ação administrativa explícita;
- endpoint founder-only;
- workspace/account mudam juntos no banco principal;
- sessões são revogadas e leases conhecidos removidos;
- Central respeita `warehouseAccess`;
- compensação entre bancos sinaliza `RECOVERY_REQUIRED` quando necessário;
- founder protegido;
- VIP/`exempt` não sofre suspensão automática;
- nenhuma deleção de dados;
- nenhum terceiro banco;
- nenhuma publicação de Rules nesta etapa.

SAAS-I deve agora:
1. integrar o `LegalAcceptanceGate` ao shell;
2. validar B+C+DL+E+DS como um único produto;
3. preparar a sequência coordenada app + Rules da Central;
4. validar UX de suspensão/reativação e regularização;
5. manter as pendências externas de backup/restore/uptime para certificação operacional.

## 17. SAAS-I — integração controlada

Em 2026-10-02 foi aberta a branch técnica `saas-r1-i-integration` a partir exata da integradora `71ed87932f17b8acd9fab9c30006970b59079c42`.

PR técnico: **#219**, apontando para `feat/saas-r1-commercializacao`, sem destino em `main`.

A SAAS-I:
- conectou o aceite legal no ponto posterior à resolução Auth/workspace/UG;
- impediu subscriptions operacionais antes do aceite;
- cobriu acesso direto à Central;
- preservou reset de senha e rotas públicas;
- manteve billing fora do enforcement;
- implementou contrato técnico da coorte VIP legado com isenção permanente;
- criou migração dry-run/apply/verify com allowlist explícita, corte 2026-10-02, auditoria determinística e idempotência;
- criou guard combinado no Application CI;
- mediu Rules em ~92,11 KiB (principal) e ~152,38 KiB (Central);
- preparou ordem de release Rules → migração VIP → aplicação, baseada nas dependências reais do gate legal e no fallback de `warehouseAccess`.

Nada foi publicado.

Próximo passo do Coordenador após CI:
1. integrar PR #219 somente na integradora se os gates estiverem verdes;
2. executar SAAS-P;
3. concluir backup READY/restore como hardening antes do piloto e fechar health/uptime na publicação controlada do RC;
4. não promover `main` sem autorização explícita.

Handoff integral: `docs/SAAS_R1_I_INTEGRATION_HANDOFF.md`.


## 17. Fechamento SAAS-I

A SAAS-I foi integrada via PR #219.

- HEAD worker final: `78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`;
- squash na integradora: `25dda4876fedabb498ad30139262b11943412273`;
- Application CI #908: SUCCESS;
- Core #195: SUCCESS;
- Recovery #595: SUCCESS;
- Legal #20: SUCCESS;
- Browser SAAS-C: skipped por escopo;
- main/produção/Rules/migração VIP: não executados.

A próxima etapa é SAAS-P, que deve provar o produto em piloto controlado e registrar evidência real de onboarding, trial, pagamento de workspace não legado, suspensão/reativação, UX do aceite e custos. VIP legado pode participar do piloto funcional, mas não comprova cobrança.

As ações externas da SAAS-E permanecem pendentes para SAAS-J.


## 18. Coordenação obrigatória com a Central Móvel R1

A Central Móvel R1 está em desenvolvimento paralelo na branch `feat/central-mobile-r1`.

O Coordenador SaaS deve considerar esse programa um **upstream/downstream paralelo relevante** sempre que trabalhar em:
- Auth e identidade;
- workspace/UG;
- sessão/lease;
- legal gate;
- lifecycle/status;
- `warehouseAccess`;
- Rules compartilhadas;
- shell/roteamento;
- contratos comuns da Central.

Antes de SAAS-P gerar correção técnica transversal, antes de integrar qualquer correção desse tipo e antes de iniciar SAAS-J:
1. ler o Integration Status e o Handoff da MOBILE-R1;
2. comparar os arquivos compartilhados entre as duas integradoras;
3. registrar **Impacto MOBILE-R1** no handoff da correção;
4. reconciliar semanticamente o delta necessário;
5. não fazer merge/rebase bruto entre as integradoras;
6. garantir que o ajuste não faça desktop e mobile obedecerem contratos diferentes.

A Central Móvel foi fundada sobre a SAAS-I certificada `78d3e9afe...`; a SAAS-I entrou na integradora SaaS por squash `25dda487...`. Portanto, divergência de ancestralidade Git é esperada e não deve ser tratada automaticamente como divergência funcional.

O desenvolvimento paralelo não bloqueia SAAS-P por padrão. Só criar bloqueio quando houver conflito concreto de segurança, autorização, fonte de verdade, schema/Rules ou comportamento compartilhado.

Todo novo prompt emitido pelo Coordenador SaaS para uma frente transversal deve conter a orientação de consultar e preservar a MOBILE-R1.

## 19. SAAS-P — handoff de abertura

Naquele checkpoint a SAAS-P estava em execução de preparação. **Estado corrente:** HARDENING PRÉ-PILOTO ativo; piloto real adiado até Release Candidate congelado.

Documento operacional:
- `docs/SAAS_R1_P_PILOTO_CONTROLADO.md`.

P0 confirmou:
- integradora SaaS e `main`;
- PR #219 mergeado;
- gates finais SAAS-I verdes conforme política;
- pendências externas SAAS-E continuam reais;
- Mobile A/B já estão em execução por PRs #221/#220, mas ainda não foram integradas na integradora Mobile;
- a integradora Mobile não contém delta funcional pós-SAAS-I no snapshot.

Próximas ações coordenadas, sem produção:
1. P2 — `status`/inventário VIP legado;
2. P3 — auditoria externa de recovery/backup/uptime;
3. selecionar participantes;
4. registrar baseline de custos;
5. preparar janela controlada do piloto.

Ações bloqueadas por autorização humana:
- `apply` VIP legado;
- publicação de Rules;
- deploy/promoção em produção;
- mudanças externas de backup/PITR/delete protection;
- restore real;
- suspensão/billing de cliente real.

Qualquer correção transversal da SAAS-P deve conter **Impacto MOBILE-R1** e ser comparada com o estado vivo da integradora Mobile.

## 20. SAAS-P — estado após inventário VIP e auditoria recovery

Em 2026-10-02, P2/P3 produziram evidência real.

### VIP legado

Allowlist aprovada:

- `aprovisionamento-2-b-fv`;
- `aprovisionamento-3-gac-ap`;
- `aprovisionamento-teste`.

`aprovisionamento-teste` permanece VIP legado e será usado como perfil funcional externo real. Um perfil de teste não-VIP para trial/cobrança será criado somente depois, quando necessário ao piloto comercial.

Nenhum `apply` foi executado. Próxima operação permitida sem autorização produtiva: `dry-run` da allowlist congelada.

### Recovery

Estado observado:

- principal: PITR OFF, delete protection OFF, daily backup ausente, 0 backup READY;
- warehouse: PITR OFF, delete protection ON, daily backup ausente, 0 backup READY.

A plataforma continua tecnicamente preparada no repositório, mas a infraestrutura externa segue **PENDING** para certificação.

### PILOT-OPS Windows

PR #222 foi certificado e integrado por squash em `ea2d389f726ae989ae88f7fc7359c690b23dfb13`.

A correção apenas torna a invocação do Google Cloud CLI compatível com Windows/PowerShell. Não há impacto funcional MOBILE-R1.

### Dry-run VIP legado

Dry-run da allowlist congelada executado e aprovado em 2026-10-02:

- 3/3 workspaces selecionados;
- 0 não resolvidos;
- founder excluído;
- nenhuma escrita executada.

A próxima ação de P2 é produtiva (`apply`) e permanece bloqueada até autorização explícita.

### P2 finalizada — VIP legado aplicado

Em 2026-10-02, após autorização explícita, a migração VIP legado foi aplicada nos 3 workspaces congelados e verificada imediatamente.

Resultado:

- `aprovisionamento-2-b-fv`: READY;
- `aprovisionamento-3-gac-ap`: READY;
- `aprovisionamento-teste`: READY.

P2 está **CONCLUÍDA**. Não há pendência adicional de materialização da coorte VIP legado.

### P3 — proteção e backup diário aplicados

Os dois bancos agora possuem PITR, delete protection e agenda diária de backup com retenção de 14 semanas.

Ainda pendente:
1. primeiro backup READY no banco principal;
2. primeiro backup READY no `emprovex-warehouse`;
3. `recovery:verify` verde;
4. restore real em banco isolado;
5. health/uptime/alertas externos.

Não repetir `apply` enquanto os controles permanecerem ativos.

## 22. Estado corrente reconciliado — 2026-10-02

- P2 VIP legado: concluída e verificada.
- P3: controles nativos aplicados nos dois bancos; não repetir `apply`; aguardar backup READY e depois restore isolado.
- Health: PR #223 preparado sobre `main`, draft/mergeable, gates técnicos verdes, sem merge/deploy.
- Produção: `main` continua na Performance R3; nenhuma publicação SaaS R1 ocorreu.
- Vercel: `build-rate-limit` de preview é não bloqueante durante desenvolvimento.
- Mobile: MOBILE-B integrada pelo PR #220; MOBILE-A segue no PR #221, draft/mergeable, gates principais verdes e aguardando fechamento coordenado.
- Antes de qualquer SAAS-J: reconsultar o estado vivo da Mobile e reconciliar deltas compartilhados.

## 23. Próxima topologia paralela planejada — SAAS-P
A próxima fase pode operar com **1 Coordenador + até 4 workers simultâneos**:

- PILOT-A — Participantes/Jornadas VIP;
- PILOT-B — Piloto comercial não-VIP;
- PILOT-C — Recovery/Health/Uptime;
- PILOT-D — Custos/Observabilidade/Evidências.

Os workers ainda não estão ativados neste checkpoint.

Regras para ativação:
1. branch exclusiva por worker;
2. escopo sem sobreposição;
3. nenhum merge/deploy/Rules produtivos pelo worker;
4. handoff obrigatório;
5. conflito transversal volta ao Coordenador;
6. qualquer alteração em domínio compartilhado exige **Impacto MOBILE-R1**;
7. o Coordenador mantém J01–J24 e decide gates de SAAS-J.

## 24. Workers SAAS-P ativáveis

Freeze da onda:

`4d87370e5ee7f2697ab4901e0c045a9ab4910fe9`

Branches já criadas:

- `saas-p-a-vip-journeys`;
- `saas-p-b-commercial-nonvip`;
- `saas-p-c-recovery-uptime`;
- `saas-p-d-evidence-observability`.

Próximo passo do Coordenador: emitir os quatro prompts independentes. Workers não fazem integração cruzada. Qualquer necessidade de alteração transversal retorna ao Coordenador.

### Ativação efetiva da onda PILOT-A/B/C/D

Os quatro workers SAAS-P foram ativados e estão trabalhando em paralelo nas branches congeladas.

Não alterar a base dos workers durante esta onda. O Coordenador deve aguardar/receber os handoffs independentes e não competir implementando o mesmo escopo.

### PILOT-A — recebida / PARCIAL

Worker: `saas-p-a-vip-journeys`
HEAD final: `ae4b676013b03e7ccf7f0e14a014edde86803d6e`
PR: #226
Integração do handoff: `8459a59aefc0f846d9c7e2f5ee78888c4fa2abd5`

Aceito:
- J08 PASS;
- J21 PASS;
- roteiro humano completo para J02–J07/J16;
- nenhum defeito novo;
- nenhum impacto MOBILE-R1.

A frente não está concluída: P-01/P-02 já foram posteriormente confirmados e protegidos; permanecem pendentes as jornadas humanas reais aplicáveis e as evidências não disruptivas.

### PILOT-B — recebida / PREPARAÇÃO CONCLUÍDA

Worker HEAD: `d9ebea5a63aaf5b9571ee9d6a68c10c9d8ca3a28`
PR #227: fechado sem merge por divergência documental da base.
Integração semântica do handoff: `ecc74f14968ca1d45f8b17eb292b68cc057171e9`.

Estado:
- P-03 real ainda não selecionado;
- pagamento real não iniciado;
- roteiro comercial completo preparado;
- nenhum defeito funcional novo;
- nenhum impacto MOBILE-R1.

Antes de executar J01, o Coordenador precisa confirmar participante P-03 real e janela produtiva compatível/autorizada.

### PILOT-D — recebida / matriz integrada semanticamente

Worker HEAD: `ae8ae4a810da24a273e0231ba5f31c915720d504`
PR #228: fechado sem merge por conflito documental com a integradora já avançada.

Integrações:
- matriz: `7d7e697828ad4bd541344512c9d96acf7bb8158d`;
- handoff: `4a746a6997a1484901813775f929a3c24105b404`.

A matriz foi validada com **24 jornadas únicas, J01–J24**.

Fotografia corrente:
- 2 PASS;
- 13 PREPARADO;
- 7 BLOQUEADO;
- 1 EM EXECUÇÃO;
- 1 N/A;
- 0 FAIL.

A diferença em relação ao fechamento original da D decorre apenas do recebimento posterior da PILOT-B e da evidência J16 já aceita da PILOT-A. Nenhum PASS novo foi criado por inferência.

SAAS-J continua bloqueada por evidência real incompleta.

### PILOT-C — recebida / PARCIAL EXTERNO

Worker HEAD: `5e1a1541630e9b7b8d1ff4bb33dc3a5c2dd48322`
PR #225: fechado sem merge após divergência da integradora.

Integração semântica:
- handoff: `227a27ac5a9e626db73d61b67ec6829d708c61c7`;
- matriz J23/J24: `5163520aecc50a21d67c4e374ded6cd55069ba03`.

Estado:
- J23 PREPARADO / depende de publicação health + Monitoring;
- J24 EM EXECUÇÃO / depende de backup READY + restore isolado;
- nenhum apply repetido;
- nenhum restore;
- nenhum deploy;
- nenhum impacto MOBILE-R1.

### Fechamento da onda paralela SAAS-P

PILOT-A: recebida / PARCIAL.
PILOT-B: preparação concluída / evidência real pendente.
PILOT-C: PARCIAL / bloqueado externamente.
PILOT-D: matriz/método de evidência aceitos.

A onda de workers está encerrada no escopo de desenvolvimento/documentação. As próximas pendências são majoritariamente humanas, comerciais e operacionais reais.

### Participante P-01 confirmado

P-01 = `aprovisionamento-3-gac-ap`.

Trata-se de usuário externo real, ativo e necessário às operações do setor. Portanto:

- preservar acesso contínuo;
- não usar para J15–J20;
- não revogar sessão;
- não forçar reset/troca de senha;
- não recriar aceite;
- não manipular billing/status/permissões para gerar evidência;
- validar apenas fluxos não disruptivos e uso normal.

Cenários de risco devem ser executados em `aprovisionamento-teste`, P-03 ou outro ambiente controlado.

### Participante P-02 confirmado e política de testes disruptivos

P-02 = `aprovisionamento-2-b-fv`.

É usuário externo real e está iniciando uso operacional. Deve receber a mesma proteção de disponibilidade de P-01.

Participantes protegidos:
- P-01 = `aprovisionamento-3-gac-ap`;
- P-02 = `aprovisionamento-2-b-fv`.

Não usar nenhum dos dois para J15–J20, revogação de sessão, bloqueio ou reset forçado.

Workspace oficial preferencial para testes disruptivos:
- `aprovisionamento-teste`.

Qualquer cenário com risco deve ser deslocado para esse workspace ou P-03 controlado, nunca para P-01/P-02.

### Execução real SAAS-P — pacote preparado

Documentos operacionais:
- `docs/SAAS_P_EXECUCAO_REAL_PILOTO.md`;
- `docs/SAAS_P_REGISTRO_EXECUCAO.md`.

Próxima execução coordenada:
1. criar/usar worktree separado `emprovex-saas-pilot` para não interferir no Mobile;
2. capturar T0;
3. observar P-01/P-02 sem interrupção;
4. usar `aprovisionamento-teste` para J15–J20 somente com autorização específica;
5. selecionar P-03 real;
6. fechar recovery quando houver backup READY;
7. incluir health/uptime na futura janela controlada de publicação;
8. coletar T1/T2;
9. reconciliar Mobile e só então avaliar SAAS-J.

Não usar P-01/P-02 para testes disruptivos.

### Estratégia temporária — `aprovisionamento-teste`

P-01/P-02 podem permanecer sem observação humana até os operadores estarem disponíveis.

Enquanto isso:
- executar validação funcional/controlada no `aprovisionamento-teste`;
- usar o mesmo workspace para J15–J20;
- não interpretar isso como substituição de evidência humana P-01/P-02;
- não usar esse workspace para comprovar P-03/trial/pagamento.

### Nova topologia coordenada — hardening pré-piloto

Até 4 workers em paralelo:
- HARDEN-A — segurança/dependências/CI;
- HARDEN-B — recovery/backup/restore;
- HARDEN-C — health/Rules/release/rollback;
- HARDEN-D — SaaS↔Mobile/evidências.

O Coordenador:
- congela a base de cada worker;
- revisa handoffs;
- integra semanticamente;
- atualiza Memorial/Status/Handoff;
- não libera o piloto enquanto qualquer gate pré-piloto material estiver aberto;
- depois do piloto coordena somente correções finais antes da SAAS-J.

P-01/P-02 permanecem protegidos. `aprovisionamento-teste` será usado no piloto final para cenários disruptivos, não agora como certificação do código pré-SaaS em produção.

### Preparação final da onda HARDEN

Antes de ativar chats, congelar uma única base para:

- HARDEN-A / `saas-harden-a-security-dependencies`;
- HARDEN-B / `saas-harden-b-recovery-restore`;
- HARDEN-C / `saas-harden-c-release-health-rules`;
- HARDEN-D / `saas-harden-d-mobile-reconciliation`.

O escopo detalhado, ownership e critérios de PASS/PARCIAL/BLOQUEADO estão normatizados no Memorial Oficial e em `docs/SAAS_R1_HARDENING_EXECUCAO_PARALELA.md`.

Não ativar nenhum worker em base diferente. Não permitir que worker crie a própria branch a partir de uma integradora mais recente.

### Freeze operacional da onda HARDEN

Base única das quatro workers:
`f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`

Branches já existentes:
- `saas-harden-a-security-dependencies`;
- `saas-harden-b-recovery-restore`;
- `saas-harden-c-release-health-rules`;
- `saas-harden-d-mobile-reconciliation`.

Não recriar, não rebasear e não atualizar com a integradora.

Antes de editar, cada worker deve confirmar `git rev-parse HEAD` = `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`.

Os chats ainda não foram ativados neste checkpoint.

### Program Control — ativação HARDEN-D autorizada

A barreira Mobile foi atingida e aceita.

Alvo Mobile:
`7b745fa0b7979e643b83b7de94dd96a0290930ab`

Alvo SaaS vivo para contexto:
`4848643be85b30532f7f093c4ddb0e729facfad3`

Worker:
`saas-harden-d-mobile-reconciliation`

Base congelada:
`f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`

Obrigatório no handoff:
- HEAD;
- PR draft;
- matriz de contratos;
- classificação do delta `Permissions-Policy`;
- conflitos;
- riscos;
- Impacto MOBILE-R1;
- recomendação ao Coordenador Geral.

MOBILE-F/G/H permanecem bloqueadas até essa devolutiva.

## HARDEN-D — FECHAMENTO PELO COORDENADOR SAAS

A reconciliação SaaS ↔ MOBILE-C/D/E foi aceita como **PASS TÉCNICO**.

Referências:
- worker HEAD: `fb7b5006d13cd09b247d6c5d0cd39d6a0b950f02`;
- PR: `#236`;
- evidência integrada semanticamente em: `22459625475cb155596e507663874de9896d001d`;
- alvo Mobile: `7b745fa0b7979e643b83b7de94dd96a0290930ab`.

Não há conflito funcional material aberto no escopo reconciliado.

Pendência obrigatória:
**CT-01 — Permissions-Policy do futuro RC**

Contrato:
`camera=(self), microphone=(), geolocation=()`

Owner:
**Integração SaaS / composição do RC**.

HARDEN-A/B/C permanecem separadas e ainda não são consideradas executadas por este fechamento.

Nenhuma ação produtiva foi autorizada.

## HARDEN-B — PARCIAL / AGUARDANDO BACKUP READY

A HARDEN-B foi auditada pelo Coordenador SaaS e aceita como **PARCIAL — dependência temporal legítima**.

Referências:
- branch: `saas-harden-b-recovery-restore`;
- HEAD: `910cca1ea9f14e4ef080ee649624042f63206d51`;
- PR: `#237` OPEN / DRAFT / MERGEABLE;
- base: `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`.

Proteções dos dois Firestore:
- PITR: PASS;
- delete protection: PASS;
- schedule diário: PASS;
- retenção 14 semanas: PASS;
- backup READY: PENDENTE;
- restore real: PENDENTE.

Não repetir `recovery:apply`, não recriar schedules e não criar polling contínuo.

Retomar a worker quando houver backup READY. O restore real continua dependendo de autorização explícita do fundador.

Impacto MOBILE-R1: **SEM DELTA**.

## HARDEN-C — FECHAMENTO PELO COORDENADOR SAAS

A HARDEN-C foi auditada e aceita como **PASS TÉCNICO**.

Referências:
- worker HEAD: `0b2e801a6460c60ecc79885d03e8ce8ffb778369`;
- PR: `#238`;
- evidência integrada semanticamente em: `e0e4e13a73aad18850a3bf5b70b64ebf22a3d11b`.

Confirmado:
- health já estava materializado semanticamente antes da base congelada;
- não deve haver merge cego do PR #223;
- Rules candidata principal e warehouse reconciliadas sem conflito SaaS↔Mobile;
- Release Manifest, rollout, rollback, smoke, env/config e monitoramento preparados;
- CT-01 registrada e ainda não aplicada.

Pendências externas/RC:
- HARDEN-A;
- HARDEN-B;
- aplicação CT-01 no HEAD composto;
- gates finais;
- publicação controlada somente após GO.

Nenhuma ação produtiva foi autorizada.

## HARDEN-A — PARCIAL / CORREÇÕES SEGURAS INTEGRADAS

A HARDEN-A foi auditada pelo Coordenador SaaS e aceita como **PARCIAL TECNICAMENTE SAUDÁVEL**.

Referências:
- worker HEAD: `00d6386d212d6c139eec243d00b61c11a13017b8`;
- PR: `#240`;
- base: `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`.

Resultado:
- audit: 22 → 14;
- lockfile compatível integrado semanticamente;
- zero major upgrades;
- zero `--force`;
- gates verdes;
- nenhuma regressão detectada.

Integração:
- lockfile: `040ec20c66a7d9c8e77070d12dd455fe43aef5d7`;
- documento: `66dc540b7d50a451e96cd16558a9219743543cd7`.

PASS continua bloqueado por:
- jsPDF CRITICAL direto/runtime;
- decisão coordenada Firebase/gRPC.

Próximo movimento recomendado:
abrir correções curtas e controladas, separadas da worker congelada original, e repetir regressão específica + audit/gates.

Impacto MOBILE-R1: **DELTA COMPATÍVEL**.

## HARDEN-A1 — ATIVAÇÃO AUTORIZADA PELO PROGRAM CONTROL

Frente:
**Correção Controlada jsPDF + Regressão de PDFs**

Branch:
`saas-harden-a-jspdf-security`

Base:
`9a294bc543ec7150b9144ed96e767a161864d72f`

Alvos:
- `jspdf@4.2.1`;
- `jspdf-autotable@5.0.8`.

Escopo:
- upgrade conjunto jsPDF/AutoTable;
- compatibilidade do `lib/pdfToolkit.ts`;
- regressão de Cronogramas;
- Relatórios;
- documentos da Central de Depósitos;
- etiquetas;
- folhas de alocação;
- documentos de saída;
- audit pós-correção;
- gates completos afetados.

Firebase/Firestore/gRPC:
**fora de escopo e bloqueado até encerramento da A1**.

Ao concluir, entregar HEAD/PR, diff, audit antes/depois, matriz de PDFs, regressões, impacto Mobile e recomendação.

## HARDEN-A1 — SECURITY PASS / VISUAL PENDENTE

A HARDEN-A1 foi auditada tecnicamente e permanece **PARCIAL** apenas por validação visual/manual pendente.

Referências:
- branch: `saas-harden-a-jspdf-security`;
- HEAD: `5ae4984bb9580faf5197737eeeeb0d5cf5aae838`;
- PR: `#244`;
- base: `9a294bc543ec7150b9144ed96e767a161864d72f`.

Confirmado:
- jsPDF 4.2.1;
- AutoTable 5.0.8;
- CRITICAL eliminado;
- regressão técnica PDF 7/7 PASS;
- lazy loading preservado;
- gates principais verdes;
- preview automático READY;
- produção não alterada.

Próximo gate:
validação manual dos 5 fluxos PDF representativos.

HARDEN-A2 permanece bloqueada até:
1. validação visual sem regressão;
2. aceite do Coordenador SaaS;
3. integração semântica da A1.

## HARDEN-A1 — FECHAMENTO

Status: **PASS TÉCNICO / ENCERRADA**

O bloqueador CRITICAL de jsPDF foi removido e a regressão técnica dos PDFs foi aprovada.

A validação visual fina foi reclassificada como **backlog pós-lançamento não bloqueante**. Ela não impede RC, piloto ou lançamento, salvo surgimento posterior de defeito funcional relevante.

A1 foi integrada semanticamente à integradora SaaS sem merge da branch congelada.

Com isso, a condição de bloqueio da HARDEN-A2 foi satisfeita.

**HARDEN-A2 — Firebase/Firestore/gRPC: ELEGÍVEL PARA LIBERAÇÃO/ATIVAÇÃO PELO COORDENADOR SAAS.**

## HARDEN-A2 — ATIVAÇÃO

Status: **ATIVA / EM EXECUÇÃO**

- branch: `saas-harden-a2-firebase-firestore-grpc`;
- base congelada: `f308ff601fe923467b8ccc1489be91b318bc3e8c`;
- criação confirmada sem delta inicial;
- sem rebase/merge da integradora durante a execução;
- começar por auditoria de dependências e alcançabilidade antes de qualquer upgrade;
- produção, Rules, restore, migração, piloto e freeze RC não autorizados por esta frente.

## HARDEN-A2 — FECHAMENTO FORMAL

Status: **PASS — RISCO RESIDUAL ACEITO TECNICAMENTE**

A auditoria concluiu que a cadeia transitiva `firebase -> @firebase/firestore -> @grpc/grpc-js` permanece instalada, porém os vetores conhecidos avaliados exigem primitivas de servidor gRPC que não são usadas pelo EMPROVEX.

Nenhuma dependência, runtime, Auth, Firestore client, Rules, Central, Mobile ou bundle foi alterado.

Impacto Mobile: **SEM DELTA**.

Artefato integrado:
`docs/SAAS_R1_HARDEN_A2_FIREBASE_FIRESTORE_GRPC.md`

A2 encerrada. Não abrir nova wave funcional/dependências. Próximo objetivo do programa: concluir o hardening remanescente e preparar composição do **RC ÚNICO SAAS R1 + MOBILE R1**.
