# EMPROVEX Empresas — W10 Etapa II | Integração, QA e handoff
Data: 06/11/2026. **Draft sem merge/deploy. Piloto OFF por padrão.**

## Origem imutável e mudanças
- Fundação e integração Etapa I: PR #520, SHA `46af306ea67e2c5d45f8a2af922ef2781e154212`.
- W9: PR #523, SHA `1d619721e4a95e644a5ae8333e3fe8888931d9d9`. 12 arquivos originais importados por SHA de blob, sem sobrescrever seu branch.
- W11: PR #524, SHA `c5dd2e821bdf1bddcbe9202bcc62d17fec8f6ee7`. 16 arquivos originais importados por SHA de blob, sem sobrescrever seu branch.
- Branch W10-II: `integration/emprovex-empresas-w10-stage2-20261106`, base #520.
- Main no momento da consulta: `80a2f3a3e30cfc31521be6ce05324da3cc952477`, ancestral do SHA W10-I (28 commits atrás). **Nenhuma rebase/merge sobre main foi feita**.

## Integração implementada
1. `/empresa/cronogramas` e `/empresa/entregas` agora montam W9; a área de entregas também monta W11 com token da sessão Firebase empresarial existente, sem importar área militar. Navegação W4 passa a mostrar os dois módulos como ativos somente na branch.
2. `/api/company/routing/candidates` faz **duas autorizações live** (deliveryRoutes e deliveries) e projeta apenas entregas W9 persistidas, de empresa corrente, com destino confirmado. Paginação de até 50 e aviso de cobertura parcial. Coordenadas, carga e ETA nunca inferidas.
3. W9 só associa rota quando W11 registra `status=approved`, `approvedByHuman=true`, aprovador, parada válida, candidato W9 correspondente e motorista do veículo igual ao atribuído à entrega. Plano e sugestão nunca fazem expedição, atesto, pagamento ou alteração da promessa.
4. Exportador genérico W5 de romaneio foi harmonizado com `getDelivery` W9 para aplicar a regra de leitura do motorista designado; não basta `deliveries:read`.
5. Regressão do pipeline W10 ampliada para W9, W11, testes de contrato W9↔W11, Firestore Emulator W0/W10 e W11, TypeScript e build. W11 continua com seu próprio workflow.

## Evidências: não extrapolar
- Suítes de contrato: `lib/company/delivery/domain.test.mjs`, `lib/company/routing/routing.test.mjs`, `lib/company/integration/approvedRoute.test.mjs`, `deliveryCandidates.test.mjs`.
- Suites existentes W1–W8, W10 e W0/Auth também foram incluídas na configuração do CI. **Presença no workflow não significa PASS**.
- Teste de Firestore Emulator W11 (tenant A/B, CAS, replay) incluído no job do W10 além do W0 (sessão/UID, convite, revogação).
- Registre SHA e URLs dos GitHub Actions na PR. Caso o job não termine, resultado **PENDING**, nunca PASS.
- Browser desktop/mobile com autenticação real, teclado/reduced-motion e Visual-R2: **PENDING** (histórico Visual-R2 com npm E404 em Playwright). Nenhuma captura foi fabricada.
- E2E integral W1→W6→W7→W9→W11→W5→W8 com duas empresas, duas fontes e cinco OMs: **PENDING**, sem dados produtivos.

## Casos de aceite por domínio
| Matriz R1-M | Cobertura na branch | Evidência exigida |
|---|---|---|
| 1–5: W0/Auth, titular, setor legado, companhia A/B, provisionamento | testes W0 existentes | Auth/Firestore Emulator e CI |
| 6–8: W1 clientes, NE, vários pedidos, alteração auditável | suíte W1 | Node + E2E integrado |
| 9–11: W2 fornecedores/unidades, W7 alocação N:M e saldo | suites W2/W7 | Node + E2E transacional |
| 12–13: W6 confirmação parcial e reversões | suíte W6 | Node + integração |
| 14: W9 entrega parcial sem atesto | W9 domínio | Node + E2E faltante |
| 15: W8 pagar/receber sem baixa implícita | suíte W8 | Node + E2E faltante |
| 16: direto fornecedor→OM sem estoque fictício | W7/W9 domínio | E2E faltante |
| 17: W5 PDF/compartilhamento rascunho, regra motorista | W5 + guard W9 | E2E browser faltante |
| 18: reserva/expedição concorrente | W7 + W9 quotas | E2E de disputa faltante |
| 19: papel W3, revogação/UID live | W0/W10 Emulator | confirmar no HEAD |
| 20: mobile/Essencial/teclado | W4 + W11 lista/fallback | Playwright faltante |
| W11: 5 OMs/2 veículos, janelas, inviáveis, rota manual, links | W11 testes puros + Firestore | confirmar no HEAD; UI E2E faltante |

## Limites, privacidade, custo e rollback
- MapLibre na branch: interface lazy com fallback em lista; **bundle CSS e tile provider comercial/licenciado ainda não configurados**. Não anunciar mapa cartográfico operacional. Nenhum serviço de tiles OSM público usado por padrão.
- OSRM/VROOM: somente HTTPS por configuração de servidor, OFF por padrão; quotas/circuit breaker são locais ao processo, exigem revisão distribuída antes de alto volume. Waze/Google Maps só URLs, sem alterar estado. Sem localização contínua.
- Evidências W9 e W11 em seus handoffs próprios, sem prometer uso comercial de APIs gratuitas ilimitadas.
- Pendência transversal: projeção entregue W9 → fulfillment de W1 não está sincronizada em commit; evitar dupla verdade e definir estratégia transacional antes do piloto. O plano aprovado não autoriza despacho e a lista de candidatos é paginada.
- Rollback: manter `EMPROVEX_COMPANY_PILOT_ENABLED` ausente/0, respeitar kill switches, descartar PR/branch; nada em main, Cloud Run, Hosting, cobrança, IAM, Firestore Rules, dados reais ou núcleo militar.

**Parecer inicial:** GO apenas para QA técnico isolado; **NO-GO para merge, piloto, produção e dados reais** até CI no HEAD, E2E integral, browser/A11Y e decisão expressa do proprietário.
