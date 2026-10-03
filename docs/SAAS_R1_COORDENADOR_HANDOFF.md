# EMPROVEX SaaS R1 — Handoff do Coordenador

Última atualização: **2026-10-01**
Integrador: `feat/saas-r1-commercializacao`
Baseline: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

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
- **SAAS-E foi concluída, certificada e integrada** via PR #215 / squash `82f2e643...`; configuração externa de backup/restore/uptime continua pendente.
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
Backup/recovery/health/runbook concluídos no repositório e integrados via PR #215 / `82f2e643...`. Backup READY, restore real e uptime/alerta reais continuam pendentes de configuração externa.

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
3. manter backup/restore/uptime reais como bloqueios de SAAS-J;
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

A SAAS-P está **EM EXECUÇÃO**.

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

