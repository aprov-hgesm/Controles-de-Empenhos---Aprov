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
- SAAS-C continua em execução na branch exclusiva.
- SAAS-DS continua bloqueada até integração semântica de B+C.

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

### C
Onboarding/reset de senha.

### DL — INTEGRADA
Termos/Privacidade/aceite versionado integrados semanticamente em `733885c1...`. O `LegalAcceptanceGate` permanece isolado até a integração com SAAS-C/SAAS-I.

### E — INTEGRADA
Backup/recovery/health/runbook concluídos no repositório e integrados via PR #215 / `82f2e643...`. Backup READY, restore real e uptime/alerta reais continuam pendentes de configuração externa.

Eles devem trabalhar simultaneamente quando possível, sem editar domínio alheio. Cada worker encerra com handoff completo; o Coordenador valida e integra.

## 8. Depois da Onda 1

1. receber o handoff restante de C;
2. integrar C após revisão semântica sobre a coordenadora que já contém B/DL/E;
3. depois de B+C integradas, liberar SAAS-DS;
4. atualizar Integration Status;
5. abrir SAAS-DS;
6. executar segurança/enforcement;
7. executar SAAS-I;
8. pilotar;
9. certificar SAAS-J.

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
