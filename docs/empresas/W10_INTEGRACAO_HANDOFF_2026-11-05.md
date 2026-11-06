# EMPROVEX Empresas — W10 | Memorial de integração e handoff

Data-base: 05/11/2026. Etapa I da integração. Fonte: Memorial Oficial, Auditoria R1-M e PR #510. PR integradora: #520, Draft, branch integration/emprovex-empresas-w10-stage1-20261105. Base W0 #511 em 16b763e929342b6ea1f5858470cc670c9ea5a3f4.

**Parecer: NO-GO para merge/deploy/piloto.** A criação da PR não autoriza publicar. Etapa II depende de W9/W11 e QA ponta a ponta.

## Origens incorporadas sem merge das PRs originais

| Worker | PR | Head SHA congelado | Domínio |
|---|---|---|---|
| W1 | #513 | e27ef500f0bacf9b7e43ed21805be92f91e86d9f | clientes públicos, NEs, pedidos OM |
| W2 | #516 | 09dbc3f11feee9d7b0ce403a0ee68346624e2f99 | fornecedores, catálogo, conversões exatas |
| W3 | #514 | a6508281f7daa633891c4aa89cb0ad3a8278236a | convites, membros, papéis e revogação |
| W4 | #512 | 71f06a01446483c7539ef827da8979fbef9dd481 | portal, mobile, modo Essencial |
| W5 | #515 | 92f313233f1513a72107357d5e24695bc9b49f3e | documentos privados, revisão NE |
| W6 | #518 | 8cf5df8e775bdf4e067921b3b5b8d691d67cb4aa | compras e inbound |
| W7 | #519 | 2054b96b25670e1ea4a66f1c4c9d18f9b8e77784 | ledger, reservas e alocação N:M |
| W8 | #517 | 62db9f884057ffb8c33ae99414d9a21c72befc1c | financeiro manual |

Origem: 104 blobs Git reaproveitados dos 8 heads, sem caminhos conflitantes. Base W0 intacta como pai; mudanças transversais feitas pelo W10. Nenhuma branch de Worker foi mesclada nem a main alterada.

## Implementação concreta

1. Membership W3 integrado ao guard W0: aceite transacional do membro e índice de seleção companyMemberAuthIndex por UID, com CAS e auditoria atômica. Índice por si só jamais concede acesso. Firebase Auth tem UID/email verificado, usuário ativo e provider senha; workspace ativo e membership ativa com papel live verificados em cada request pelo servidor. Identidade setorial/fundador nunca vira membro por fallback. Revogação/troca de papel devem ser exercitadas no Emulator antes de GO.
2. Contratos W0 autorizados: coleções deliveryRoutes e vehicles apenas no espaço empresarial, ações específicas read/write para cada uma e matriz de papéis. Nenhuma rota herda permissão global company:write.
3. W4 portal: montagem de módulos W1–W8 com chamadas às APIs reais. Configuração da equipe e fluxo /empresa-convite com identidade própria, token e confirmação de email. W9 cronogramas/entregas e relatórios ainda não simulados como prontos.
4. W9/W11: contrato de handoff tipado em lib/company/integration/deliveryRoutingContract.ts com quantidade, destino, janelas, paradas propostas e não alocadas. Não infere coordenadas ou ETA. RouteProposal sempre exige aprovação; rota não confirma despacho, entrega, atesto ou pagamento.
5. Fluxo de dados: W1 NE distinta de pedido OM; W2 conversões racionais; W6 publica recebimento inbound sem dar baixa em estoque; somente W7 consome evento idempotente para saldo físico e reserva. W8 grava valores e pagamentos manuais em centavos, sem liquidação fictícia. Sem duplicar ledger militar nem alterar warehouse, billing, Rules/IAM, Cloud Run, Hosting ou usuários reais.

## Matriz R1-M §6 (20 cenários)

**Importante: cobertura de código NÃO equivale a teste aprovado.** PASS/FAIL só se aplicam depois de consultar execução real CI no SHA integrador.

| Nº | Cenário | Cobertura | Status pré-gate |
|---|---|---|---|
| 01 | Fundador Google/senha e setor preservado | W0/Core | QA browser pendente |
| 02 | Empresa válida/disabled e provider errado | W0 E2E | CI pendente |
| 03 | A/B sem acesso cruzado a pedidos/docs/margem | W0/W1/W2/W5/W8 | E2E transversal pendente |
| 04 | UID, e-mail, workspace, token, membership revogado | W0/W3/W10 E2E | CI pendente |
| 05 | Falhas empresariais 5xx/timeout sem afetar setor | W0 | CI/browser pendente |
| 06 | Provisionamento concorrente e rollback | W0 Emulator | CI pendente |
| 07 | Piloto OFF, zero gravações produtivas | W0 flag/guard | Teste de regressão pendente |
| 08 | NE e pedidos OM separados | W1/W5 | Jornada pendente |
| 09 | 500=100 estoque + 300/100 compras | W7 Emulator | CI pendente |
| 10 | Compra 500 alocada a 200/300 | W7 Emulator | CI pendente |
| 11 | Caixa/fardo/quilo, conversão exata | W2/W7 | CI pendente |
| 12 | Fornecedor confirma 250/400, promessa distinta | W6; W9 futuro | Parcial |
| 13 | Recebimento/retorno/cancelamento/replay | W6/W7; W9 futuro | Parcial |
| 14 | Entrega parcial sem atesto implícito | W9 futuro | SKIPPED |
| 15 | NF entrada/pagar e NF saída/receber | W8 | CI pendente |
| 16 | Entrega direta origem→OM sem estoque fictício | W9 futuro | SKIPPED |
| 17 | PDF, WhatsApp/email apenas rascunho | W5 | CI pendente |
| 18 | Dupla reserva concorrente impedida | W7 Emulator | CI pendente |
| 19 | Papel restrito, revogação live | W3/W10 E2E | CI pendente |
| 20 | Mobile/Essencial/teclado sem 3D setorial | W4 | Playwright pendente |

W11: 5 OMs/2 veículos, janelas, impossibilidade de parada, roteirização manual, MapLibre/OSRM/VROOM indisponíveis, links externos sem mudança de entrega e privacidade estão **SKIPPED** enquanto W11/W9 não integrados. Roteirização não habilitada. Sem GPS contínuo, sem enviar NF, NE, contato privado, token ou IDs internos ao provedor.

## QA e integração

Workflow exclusivo .github/workflows/emprovex-empresas-w10.yml: Node 24.22.1, npm ci, testes reais unitários de W1–W8, testes W10, TypeScript, Core Protection, build e Firebase Auth + Firestore Emulator demo em loopback com convite, aceite, A/B, troca de papel e revogação. Workflows separados W1/W6/W7/W8 executam seus domínios e Emulator. Sem simulador que declare resultados fictícios.

Gates não resolvidos pela Etapa I: Playwright empresarial desktop/mobile, acessibilidade completa, teste de fluxo de ponta a ponta pedido OM→compra→recebimento→reserva→entrega→documento→financeiro, sincronização com main recente, gate W11, custo/licenças de tiles e provedores, roteiro manual e revisão final de privacidade. Registro de CI deve discriminar success, failure, skipped e pending.

## Handoff e reversão

W9 deve usar apenas domínios schedule/delivery, ler W1/W6/W7 sem criar ledger novo, respeitar contrato de rota e habilitar manual sem mapa. W11 fica em geo/routing isolado, não movimenta estoque nem emite romaneio, não usa API paga por padrão. W10 Etapa II integra heads novos somente após handoff real, confronta main e executa os 20+ testes e Visual-R2/CI.

Rollback: NÃO mesclar #520; manter EMPROVEX_COMPANY_PILOT_ENABLED=0/ausente, obedecer kill switches já existentes; descartar apenas branch integradora se necessário. Sem alteração em deploy, tráfego, billing, IAM ou Firestore Rules.

GO exclusivamente para revisão técnica após os gates verdes; NO-GO para piloto e publicação até aprovação posterior explícita.
