# SAAS-PILOT-JOURNEY-01 — Jornada E2E pré-piloto do SaaS R1

Data da execução: **2026-10-05/06**
Branch: `saas-pilot-journey-01`
HEAD inicial obrigatório: `4cc5b3797747d4d49591f4a68196e723700daa74`
HEAD funcional testado: `75f302e4554336f3646b38e068c4530f6625c7d1`
PR: **#259 — DRAFT**, base `saas-final-audit-01`

## 1. Conclusão executiva

**PASS COM PENDÊNCIAS EXTERNAS**

Não foi identificado **SAAS JOURNEY BLOCKER** nem **WAREHOUSEACCESS BLOCKER**.

A jornada técnica não produtiva do SaaS R1 foi revalidada sobre a base final auditada usando as suites existentes e um harness temporário de CI. Foram executados novamente onboarding, Auth/UID/provider, Legal Gate, billing/trial, lifecycle, regularização contratual, sessões, isolamento multi-tenant, Core Protection, TypeScript, build e diff hygiene. Também foram executados oito cenários browser em Chromium contra Firebase Auth/Firestore Emulator.

As pendências restantes são externas ao código validado nesta frente e deliberadamente não foram fabricadas: validação em Preview/novo RC publicado, exercício humano da tela administrativa de regularização no deployment candidato e qualquer cobrança/suspensão real. O piloto real continua **não autorizado**.

Nenhum deploy Production foi realizado. Nenhuma cobrança real, suspensão de cliente real, publicação de Rules, migração de dados, alteração do Warehouse logístico ou alteração da MOBILE-K foi realizada.

## 2. Governança

A branch foi conferida antes das alterações:

- branch existente: `saas-pilot-journey-01`;
- base exigida: `4cc5b3797747d4d49591f4a68196e723700daa74`;
- comparação inicial: **0 commits à frente / 0 atrás**;
- nenhum rebase;
- nenhum merge;
- nenhum fast-forward para outra branch;
- PR aberto como DRAFT contra `saas-final-audit-01`;
- **NÃO MERGEAR**.

## 3. Contrato comercial preservado

A execução confirmou e não alterou:

- Plano Completo: **R$ 70/mês por workspace**;
- trial: **30 dias**;
- founder: `exempt`;
- VIP externo: `exempt`, R$ 0 e acesso completo;
- cobrança externa e confirmação administrativa;
- suspensão e reativação manuais;
- billing separado de autorização operacional;
- sem auto-suspensão;
- sem webhook;
- sem checkout;
- sem API de pagamento;
- sem signup público;
- sem tier adicional;
- histórico materializado sem reprecificação.

O guard Bloco 22 executou **6/6 testes PASS**.

## 4. Firestore Rules

Nenhuma Rule foi alterada.

Blobs confirmados na branch durante a execução:

- `firestore.rules`: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- `firestore.warehouse.rules`: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Contrato RULES-COMPAT-01 preservado.

## 5. Matriz da jornada

| ETAPA | AÇÃO | RESULTADO ESPERADO | RESULTADO OBSERVADO | AUTOMÁTICO/MANUAL | EVIDÊNCIA | PASS/FAIL/PENDENTE | RISCO |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Base/governança | Conferir branch contra HEAD congelado | 0 à frente / 0 atrás antes do trabalho | Branch idêntica a `4cc5b379...` | Automático | GitHub compare | **PASS** | nenhum |
| Provisionamento | Validar workspace + conta + UG index + billing + claims | 1 workspace ↔ 1 UG ↔ 1 conta primária | Guards de onboarding/integration e segurança verdes; transação administrativa de provisionamento coberta | Automático/emulator | `verify:saas-r1-onboarding`, Application CI | **PASS** | `warehouseAccess` não nasce obrigatoriamente no onboarding |
| Conta externa | Validar e-mail, UID, provider e e-mail verificado | password + identidade vinculada e fail-closed | provider incorreto/UID divergente negados; bootstrap e first login protegidos | Automático/emulator | Auth/UID/multi-tenant suites | **PASS** | nenhum |
| Primeiro login | Login externo em navegador | autenticar e entrar no shell/Legal Gate | Login real do fixture em Chromium passou | Browser/emulator | Browser E2E | **PASS** | não é Preview real |
| Legal Gate | Validar bundle/aceite e acesso | sem aceite → gate; aceite válido → acesso | Guard legal + Rules emulator verdes; browser usa fluxo de aceite quando exigido | Automático + browser/emulator | Legal suite + Browser E2E | **PASS** | revisão jurídica humana permanece separada |
| Acesso operacional | Abrir sistema e Central compartilhando identidade SaaS | usuário válido acessa superfície autorizada | usuário externo autenticado viu Central de Depósitos | Browser/emulator | Browser E2E | **PASS** | Warehouse logístico não foi testado |
| Isolamento | Entrar em segundo workspace | não enxergar dados do primeiro | cenário browser passou; Rules emulator também nega cross-workspace | Browser + emulator | Browser E2E + multi-tenant | **PASS** | nenhum |
| Trial | Validar contrato de 30 dias | conta normal usa trial 30 dias | guard billing confirma 30 dias | Automático | Bloco 22 | **PASS** | passagem temporal real não foi acelerada |
| Billing | Validar R$ 70/exempt/histórico | contrato comercial congelado | 6/6 testes billing; VIP/founder R$ 0; histórico não reprecificado | Automático | Bloco 22 | **PASS** | cobrança real proibida nesta frente |
| Regularização | Validar contrato/API de regularização | regularização acessível sem conceder bypass operacional | domínio/API/build e Rules/billing verdes | Automático | Application CI + build | **PASS** técnico | clique humano da tela em Preview/RC permanece pendente |
| Suspensão | Simular lifecycle `active → disabled` sem cliente real | workspace/conta fecham acesso e sessões são revogadas | lifecycle READY; setor suspenso recebe DENY; revogação coberta | Automático/emulator | lifecycle + multi-tenant | **PASS** | nenhuma suspensão real executada |
| Bloqueio operacional | Tentar operar em estado disabled | acesso falha fechado | DENY confirmado para setor suspenso | Emulator | multi-tenant security | **PASS** | nenhum |
| Reativação | Validar `disabled → active` e compensação | restaurar acesso sem recriar tenant/dados | lifecycle implementa reativação e rollback compensatório se Warehouse falhar | Automático/contrato | lifecycle/integration guards | **PASS** técnico | smoke humano no deployment candidato pendente |
| Recuperação de acesso | Validar reset/logout/relogin | nova autenticação restaura sessão legítima | reset guard verde; browser confirmou tombstone bloqueando sessão antiga e novo login criando nova identidade | Automático + browser | Application CI + Browser E2E | **PASS** | nenhum |
| Sessões legítimas | Validar múltiplas sessões sem teto fixo | leases dinâmicos coexistem | 4 sessões independentes + abas compartilhando sessão lógica passaram | Browser/emulator | Browser E2E | **PASS** | slots 1/2 seguem compatibilidade transitória |
| Lease | Validar 30 min / heartbeat 15 min / expiração | renovação eficiente e retomada após expiração | heartbeat e reaproveitamento de lease expirado passaram | Browser/emulator | Browser E2E | **PASS** | nenhum |
| Revogação | Revogar sessão lógica | todas as abas caem; tombstone impede retorno | ambos cenários browser passaram | Browser/emulator | Browser E2E | **PASS** | nenhum |
| `warehouseAccess` | Validar compatibilidade SaaS compartilhada | lifecycle sincroniza estado; fallback histórico não é removido | onboarding não materializa obrigatoriamente; lifecycle grava `warehouseAccess/{workspaceId}` em `disabled/active` e possui compensação | Automático/inspeção + guards | `sectorLifecycleAdmin.ts` + security/integration | **PASS** com risco residual | manter fallback até migração coordenada |
| Founder | Garantir que founder não vira operador genérico | founder preservado e sem bypass tenant | proteção do founder e admin sem bypass operacional confirmadas | Automático/emulator | lifecycle + multi-tenant | **PASS** | nenhum |
| Rules | Confirmar blobs sem edição | hashes congelados preservados | hashes idênticos | Automático | blob SHA GitHub | **PASS** | Rules continuam ownership externo desta frente |
| TypeScript | Executar validação final | 0 erros | SUCCESS | Automático | SAAS Pilot Journey + Application CI | **PASS** | nenhum |
| Build | Produzir build otimizado | compilação completa | Next.js compilou com sucesso | Automático | SAAS Pilot Journey + Application CI | **PASS** | nenhum |
| Diff hygiene | Verificar delta da branch | sem whitespace/diff inválido | SUCCESS | Automático | SAAS contract journey | **PASS** | nenhum |
| Preview/RC real | Repetir smoke no deployment candidato | login/Legal/Admin/regularização/logout/relogin no novo RC | não executado nesta frente; nenhum deployment foi criado/autorizado | Manual/externo | depende do novo RC | **PENDENTE** | gate externo antes do piloto |
| Pagamento real | Confirmar pagamento externo | processo administrativo real funciona | deliberadamente não executado | Manual/externo | proibido nesta frente | **PENDENTE** | só no piloto/autorização aplicável |

## 6. Browser E2E observado

Ambiente: **Chromium + Firebase Auth/Firestore Emulator**, sem Production.

### Jornada externa / isolamento — 4/4 PASS

1. `login -> relatório -> NS automática por UG -> persistência após reload`;
2. usuário externo autenticado vê a Central de Depósitos;
3. segundo workspace não enxerga NS nem fornecedor do primeiro;
4. quatro sessões independentes coexistem e múltiplas abas compartilham a mesma sessão lógica.

Resultado: **4 passed**.

### Sessões / revogação — 4/4 PASS

1. heartbeat renova lease de 30 minutos sem redescobrir capacidade;
2. lease dinâmico expirado é reaproveitado pelo mesmo navegador;
3. revogação administrativa derruba todas as abas da mesma sessão lógica;
4. tombstone bloqueia retorno e novo login cria nova identidade.

Resultado: **4 passed**.

Total dirigido nesta frente: **8/8 browser PASS**.

## 7. CI e gates no HEAD funcional testado

HEAD: `75f302e4554336f3646b38e068c4530f6625c7d1`

- Application CI — run **37395922059** — **SUCCESS**;
- SAAS Pilot Journey 01 — run **37395922126** — **SUCCESS**;
  - SaaS contract journey — **SUCCESS**;
  - Browser E2E SaaS journey — **SUCCESS**;
- EMPROVEX Core Protection — run **37395922283** — **SUCCESS**.

O Application CI concluiu também os gates finais dos Blocos 16, 17, 18, 19, 20 e 21 em SUCCESS.

## 8. `warehouseAccess` — risco residual

O risco conhecido foi revalidado e **não virou blocker**:

- o provisionamento inicial cria identidade SaaS, billing, índice de UG e claims Warehouse;
- não há materialização obrigatória de `warehouseAccess` no onboarding;
- a ação de lifecycle grava `warehouseAccess/{workspaceId}` no banco Warehouse com `workspaceId`, UG e status;
- suspensão sincroniza `disabled`;
- reativação sincroniza `active`;
- existem caminhos compensatórios para evitar estado silenciosamente divergente;
- o fallback histórico das Rules foi preservado;
- nenhuma Rule foi alterada.

Classificação: **RISCO RESIDUAL DE COMPATIBILIDADE ACEITO NESTA JORNADA**.

## 9. Warehouse e MOBILE-K

Fora de escopo e intocados:

- estoque;
- lotes;
- localização física;
- transferências;
- saídas;
- ledger;
- reconciliação Warehouse;
- motor MOBILE-K.

Somente contratos compartilhados SaaS foram exercitados: Auth, workspace, UG, Legal, lifecycle, sessões e `warehouseAccess`.

## 10. Pendências externas antes do piloto real

1. compor/re-freeze o novo RC por SHA único;
2. obter deployment Preview/RC autorizado;
3. repetir smoke humano no deployment candidato, com foco em Login → Legal → Home → Admin → regularização → logout/relogin;
4. fechar os gates externos de publicação/uptime na frente própria;
5. somente depois, com autorização explícita, iniciar o piloto real e colher evidência de pagamento/suspensão administrativa real.

Essas pendências não representam defeito funcional encontrado nesta execução.

## 11. Blockers

- **SAAS JOURNEY BLOCKER — COORDENADOR REVIEW: NENHUM**.
- **WAREHOUSEACCESS BLOCKER — COORDENADOR REVIEW: NENHUM**.

## 12. Classificação final

**PASS COM PENDÊNCIAS EXTERNAS**

A jornada SaaS R1 está tecnicamente apta para seguir à composição do novo RC. O resultado **não** autoriza Production, publicação de Rules, piloto real, cobrança real ou suspensão de cliente real.
