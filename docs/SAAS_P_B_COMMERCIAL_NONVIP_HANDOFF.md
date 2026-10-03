# PILOT-B — HANDOFF

Data: **2026-10-02**

## 1. Identificação

- Frente: **PILOT-B — Piloto Comercial Não-VIP da SAAS-P**
- Branch: `saas-p-b-commercial-nonvip`
- Branch coordenadora: `feat/saas-r1-commercializacao`
- Base congelada: `4d87370e5ee7f2697ab4901e0c045a9ab4910fe9`
- HEAD funcional: **a própria base congelada**; esta worker não alterou código funcional
- Estado: **PREPARAÇÃO CONCLUÍDA / EXECUÇÃO REAL BLOQUEADA POR PARTICIPANTE + JANELA PRODUTIVA AUTORIZADA**
- Participante P-03: **não selecionado**
- Pagamento real: **NÃO INICIADO**
- Escritas produtivas executadas por esta worker: **nenhuma**
- Merge/rebase de outras frentes: **nenhum**
- Deploy/Rules/suspensão/cobrança produtiva: **nenhum**

A missão desta worker foi levada até o limite seguro sem inventar participante, pagamento, inadimplência ou autorização.

## 2. Estado da preparação do P-03

O P-03 está tecnicamente roteirizado para ser um **workspace real novo, posterior ao corte de 2026-10-02 e não isento**.

Antes da execução real, devem existir simultaneamente:

1. participante real selecionado;
2. workspace/UG/e-mail reais aprovados;
3. confirmação de que o candidato SaaS R1 compatível de aplicação + Rules está publicado na janela controlada autorizada pelo Coordenador/usuário;
4. configuração pública de regularização conferida (Link HTTPS e/ou Pix + suporte);
5. autorização explícita para qualquer suspensão real;
6. pagamento externo real antes de qualquer confirmação administrativa como `paid`.

Não criar usuário/workspace fictício produtivo apenas para fechar gate.

## 3. Auditoria da implementação existente

### Provisionamento e onboarding

O fluxo server-side de provisionamento permanece assistido e protegido por locks/rollback. A criação do diretório materializa workspace, conta, índice de UG e billing de forma coordenada. O parâmetro `grantTrial` é explícito e deve ser **true** para o P-03.

O onboarding continua sem signup público, sem escolha livre de tenant e sem persistência de senha em Firestore.

### Billing e trial

Confirmado no código integrado:

- Plano Completo: **7000 centavos = R$ 70,00/mês**;
- trial padrão: **30 dias**;
- vencimento: **5º dia útil**;
- tolerância: **10 dias corridos**;
- `billingMode = observe`;
- `requirePayment = false`;
- `automaticSuspension = false`;
- novo não isento com trial recebe `status = trial`;
- VIP/fundador usam `exempt`; o P-03 não pode usar essa classificação;
- término do trial não apaga tenant/dados e não dispara suspensão sozinho.

### Pagamento e regularização

A cobrança permanece externa. `/regularizacao` e `/api/billing/regularization` expõem somente instruções públicas necessárias, filtram Link de Pagamento para HTTPS e não processam cartão/CVV/token.

A confirmação administrativa de competência:

- usa identidade determinística `workspaceId__AAAA-MM`;
- é auditada;
- permite referência/observação administrativa;
- é idempotente quando repetida sem mudança;
- ao confirmar `paid` ou `waived`, leva a conta comercial a `active`;
- não reprecifica competência histórica já materializada.

**Importante:** a confirmação administrativa só deve ocorrer depois de o pagamento externo real ter sido verificado.

### Legal

O pacote vigente é versionado. O `LegalAcceptanceGate` foi integrado depois de Auth + workspace + UG e antes das subscriptions operacionais.

Continuam públicas/fora do gate operacional:

- `/terms`;
- `/privacy`;
- recuperação de credencial;
- `/regularizacao`.

### Lifecycle, sessão e Central

Billing e autorização permanecem separados.

Suspensão real usa ação administrativa server-side founder-only e:

- materializa `disabled` na Central;
- altera workspace + platform account de forma coordenada;
- revoga/remove sessões conhecidas;
- registra auditoria;
- preserva billing, Auth e dados operacionais;
- usa compensação/fail-closed entre os dois bancos.

Reativação:

- retorna workspace/account/Central a `active`;
- preserva UID, e-mail, UG, tenant, billing e dados;
- não cria novo trial;
- não recria workspace;
- não ressuscita sessão já revogada.

### Segurança multi-tenant

Os contratos integrados continuam exigindo workspace/UG/autorização coerentes e preservam o isolamento cross-tenant. Billing não foi acoplado ao caminho crítico das Rules operacionais.

## 4. Roteiro operacional exato — P-03

| Etapa | Quem executa | Entrada / pré-condição | Resultado esperado | Evidência mínima | Reversibilidade / rollback | Risco / condição de parada |
| --- | --- | --- | --- | --- | --- | --- |
| P03-0 Preflight | Coordenador + fundador | participante real; janela publicada/autorizada; workspace/UG/e-mail aprovados | execução liberada | registro da autorização + commit/release alvo | não iniciar se incompatível | app/Rules parciais ou participante fictício |
| J01 Onboarding | Fundador/admin | workspace novo, UG, e-mail, credencial inicial, `grantTrial=true` | Auth + workspace + conta + billing coerentes | IDs reais + auditoria de provisionamento + billingAccount | usar rollback/recovery do provisionamento somente se falha parcial | `RECOVERY_REQUIRED`, conflito de UID/e-mail/UG |
| Primeiro acesso | Participante | credencial real entregue por canal seguro | login no tenant correto | login + workspace/UG apresentados | reset de senha se necessário | identidade divergente / acesso cross-tenant |
| Aceite | Participante | pacote legal vigente ainda não aceito | aceite da versão vigente e liberação do shell | documento determinístico de aceite + UI liberada | aceite histórico é imutável; não apagar | erro de Rules/gate |
| J10 Trial | Fundador/admin + verificação | billing criado com trial | `trial`, R$70, 30 dias | `status`, `trialStartedAt`, `trialEndsAt`, preço, ausência de isenção | extensão apenas administrativa/auditada, se realmente necessária | não alterar datas para acelerar piloto |
| J11 Estado do trial | Participante + Coordenador | trial válido; depois evolução natural do tempo | uso normal durante trial; simples vencimento não suspende automaticamente | UI/status comercial + acesso preservado conforme contrato | ação comercial separada | qualquer auto-suspensão ou perda de dados |
| Regularização pré-pagamento | Participante | página pública configurada | instruções Link/Pix/suporte acessíveis | captura/registro da página e configuração pública | config administrativa corrigível | segredo exposto ou link não HTTPS |
| J12 Pagamento externo | Participante real | cobrança devida/aceita | pagamento concluído fora do EMPROVEX | comprovante/referência externa real, mantido conforme política | tratar estorno externamente; não fabricar `paid` | pagamento não liquidado |
| J13 Confirmação administrativa | Fundador/admin | pagamento real verificado | competência `paid`, confirmação auditada | ciclo + `confirmedAt`/`confirmedBy` + auditoria + referência opcional | reabertura é ação administrativa explícita | nunca confirmar sem pagamento |
| J14 Regularização | Sistema + Coordenador | J12/J13 concluídos | billing `active`; operação permanece liberada | billingAccount + jornada operacional | reversível por ação comercial/lifecycle separada | billing não deve mutar autorização sozinho |
| J15 Suspensão manual | Fundador/admin | **autorização explícita específica** e cenário seguro | workspace/account/Central `disabled` | auditoria + estados + resultado da API | reativar explicitamente | `RECOVERY_REQUIRED` ou ausência de autorização |
| J16 Revogação de sessão | Sistema | sessão ativa antes de J15 | sessão antiga invalidada | tombstone/slots + logout/bloqueio observado | novo login somente após reativação | sessão antiga continuar válida |
| J17 Bloqueio operacional | Participante + Coordenador | workspace suspenso | EMPROVEX/Central protegidos sem vazamento | tentativa real controlada e DENY/UX humana | J19 | qualquer acesso operacional residual |
| J18 Páginas públicas | Participante/Coordenador | workspace suspenso | regularização, Termos e Privacidade continuam acessíveis | abertura sem shell operacional | N/A | página pública ficar presa no lifecycle |
| J19 Reativação | Fundador/admin | cenário J15 concluído | workspace/account/Central voltam a `active` | auditoria + estados + retorno da API | nova suspensão explícita se necessária | estado parcial entre bancos |
| J20 Retorno aos dados | Participante + Coordenador | J19 concluído | novo login/sessão; mesmo tenant e mesmos dados | workspace/UG/UID + amostra de dados previamente registrada | sem migração/recriação | tenant recriado, trial reiniciado ou perda de dados |

## 5. Jornadas Jxx — estado desta worker

| Jornada | Estado | Evidência nesta worker | O que falta |
| --- | --- | --- | --- |
| J01 | **PREPARADO** | provisionamento/rollback auditados | participante real + execução autorizada |
| J10 | **PREPARADO** | R$70 / 30 dias confirmados em domínio e guards | billing real do P-03 |
| J11 | **PREPARADO** | sem auto-suspensão confirmado estruturalmente | observação real do participante |
| J12 | **BLOQUEADO** | fluxo externo definido | pagamento real |
| J13 | **BLOQUEADO por J12** | confirmação idempotente auditada no domínio | confirmação após pagamento real |
| J14 | **BLOQUEADO por J12/J13** | transição comercial preparada | evidência real de regularização |
| J15 | **BLOQUEADO** | lifecycle estruturalmente pronto | autorização explícita de suspensão real |
| J16 | **BLOQUEADO por J15** | revogação estruturalmente pronta | sessão real a revogar |
| J17 | **BLOQUEADO por J15** | Rules/lifecycle certificados | teste real controlado |
| J18 | **PREPARADO estruturalmente** | páginas públicas fora do gate/lifecycle | evidência live durante J15 |
| J19 | **BLOQUEADO por J15** | reativação estruturalmente pronta | execução real autorizada |
| J20 | **BLOQUEADO por J19** | preservação de tenant/dados é contrato implementado | comparação real antes/depois |

Nenhuma jornada acima foi marcada PASS sem participante real.

## 6. Evidências técnicas auditadas

### SAAS-B — billing

PR #216 / worker `7e288e79...` / squash `f91cda645...`:

- Application CI #886: SUCCESS;
- Core Protection #173: SUCCESS;
- Recovery #573: SUCCESS;
- billing tests: SUCCESS;
- multi-tenant Firestore security: SUCCESS;
- build, TypeScript e diff hygiene: SUCCESS.

Os testes de billing cobrem preço/trial, migração idempotente, VIP, preservação de histórico e confirmação repetida idempotente.

### SAAS-C — onboarding

- Application CI #894: SUCCESS;
- Core #181: SUCCESS;
- Recovery #581: SUCCESS;
- build/TypeScript/diff/multi-tenant: PASS;
- Browser dirigido registrou **3/3 asserts PASS**; o cancelamento histórico ocorreu no teardown após as asserções.

### SAAS-DL / SAAS-DS / SAAS-I

- DL: aceite versionado e Rules específicas previamente certificados;
- DS: Application CI #901, Core #188, Recovery #588 e Legal #13: SUCCESS;
- SAAS-I final: Application CI #908, Core #195, Recovery #595 e Legal #20: SUCCESS;
- SAAS-I também certificou build, TypeScript, diff hygiene, isolamento multi-tenant e segurança externa da Central.

### Execução nova desta worker

A branch começou idêntica à base congelada e esta entrega altera **somente documentação**. Pelo fluxo oficial, diff exclusivamente `docs/**` não dispara Application CI automático. Não houve reconstrução artificial de código apenas para gerar um novo run redundante.

A auditoria desta worker releu diretamente os guards e implementações de billing, onboarding, legal, lifecycle e segurança existentes no HEAD congelado e confrontou-os com as execuções certificadoras acima.

## 7. Evidências que exigem ação real

Ainda exigem ação humana/produtiva real:

- seleção do P-03;
- criação real do workspace posterior ao corte;
- primeiro login do participante;
- aceite real;
- trial materializado no workspace real;
- pagamento externo real;
- confirmação administrativa somente após liquidação;
- eventual suspensão controlada com autorização específica;
- revogação/bloqueio observado em sessão real;
- reativação;
- comprovação de retorno aos mesmos dados.

## 8. Billing/trial confirmado

**SIM — estruturalmente confirmado.**

Contrato observado no código/guards:

- R$ 70,00;
- 30 dias;
- 5º dia útil;
- 10 dias;
- cobrança externa;
- confirmação administrativa;
- sem suspensão automática.

## 9. Pagamento real

**NÃO INICIADO.**

Não existe participante P-03 selecionado e nenhum pagamento foi inventado ou marcado como pago.

## 10. Regularização

**PREPARADA estruturalmente / NÃO EXECUTADA com cliente real.**

A página pública e a API segura de configuração estão prontas. Antes do piloto, confirmar que Link/Pix/suporte reais estão configurados no ambiente publicado.

## 11. Suspensão / reativação

**PREPARADAS estruturalmente / NÃO EXECUTADAS nesta worker.**

Qualquer J15 em participante real exige autorização explícita. Em caso de `RECOVERY_REQUIRED`, interromper a jornada e acionar o runbook; não tentar mascarar estado parcial.

## 12. Problemas PILOT-*

**Nenhum defeito funcional confirmado nesta auditoria.**

Não foi aberta correção. Caso a execução real do P-03 revele divergência, classificar antes de editar e devolver ao Coordenador para branch curta dedicada.

## 13. Impacto MOBILE-R1

Estado vivo consultado em 2026-10-02:

- MOBILE-A: integrada pelo PR #221 / squash `19fc6be4...`, com pendências físicas de runtime;
- MOBILE-B: integrada pelo PR #220 / squash `5edb19812...`;
- Integração 1: certificada pelo PR #224 / squash `7c987676...`;
- Onda 2: MOBILE-C/D/E liberadas na base `13ca1a50826bdb34b8f63effb0743ac43ecdcddd`.

**Impacto desta worker: SEM IMPACTO FUNCIONAL DIRETO**, pois nenhum arquivo de Auth, workspace/UG, lifecycle, Rules, sessão, shell, Central ou schema foi alterado.

Se o P-03 revelar defeito transversal futuro:

1. parar esta worker;
2. devolver classificação `PILOT-*` ao Coordenador;
3. criar branch curta separada;
4. reconsultar o estado vivo MOBILE-R1;
5. reconciliar semanticamente;
6. nunca fazer merge/rebase bruto entre os programas.

## 14. Arquivos alterados

- `docs/SAAS_P_B_COMMERCIAL_NONVIP_HANDOFF.md`

Nenhum arquivo funcional alterado.

## 15. Gates

- branch/base: **PASS** — branch encontrada idêntica a `4d87370...` na ativação;
- auditoria de billing: **PASS estrutural**;
- auditoria de onboarding: **PASS estrutural**;
- auditoria legal: **PASS estrutural**;
- auditoria lifecycle/sessão: **PASS estrutural**;
- auditoria multi-tenant/Central: **PASS estrutural**;
- evidências CI integradas: **verdes conforme registros acima**;
- Application CI novo desta worker: **N/A por diff documental-only**, conforme política oficial;
- TypeScript/build novo: **N/A — nenhum código alterado**;
- Preview Vercel: não é gate desta frente; `build-rate-limit` isolado não reprova PILOT-B.

## 16. PR

PR draft contra `feat/saas-r1-commercializacao`: **será aberto nesta entrega e registrado no retorno final ao Coordenador**.

Não autoriza merge.

## 17. Bloqueios

Bloqueios reais, não defeitos:

1. P-03 real ainda não selecionado;
2. SaaS R1 ainda precisa de janela de publicação compatível/autorizada antes do piloto real;
3. J12 depende de pagamento externo real;
4. J15–J20 dependem de cenário de suspensão explicitamente autorizado;
5. não se pode acelerar trial alterando datas produtivas.

## 18. Próximo passo

O Coordenador deve usar este roteiro quando houver participante P-03 real e ambiente publicado compatível.

Primeira ação humana mínima:

> selecionar o participante real não isento e aprovar os dados do workspace/UG/e-mail; depois autorizar a janela produtiva necessária ao piloto.

Só então executar J01 → J10/J11 → J12 → J13/J14 e, se autorizado, J15–J20.

# PILOT-B — PREPARAÇÃO CONCLUÍDA / EVIDÊNCIA REAL PENDENTE
