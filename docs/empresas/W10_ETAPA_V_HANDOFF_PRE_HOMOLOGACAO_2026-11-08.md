# EMPROVEX Empresas — W10 Etapa V | Handoff de estabilização pré-homologação

**Data:** 08/11/2026 · **Execução:** branch isolada `integration/emprovex-empresas-w10-stage5-hardening-prehomol-20261108` · **Base imutável:** PR #530, `f84db403a295a4d590dfd246fcc8ba52d06f2c61`.

## Escopo e achados classificados
| ID | Classe / constatação | Implementação / resultado |
| --- | --- | --- |
| P0-01 | B — sem cookie, `verifySelectedCompanySession` retornava `base.workspaceId` apesar de haver perfis A/B | Sem cookie em multiempresa, 403 `PROFILE_SELECTION_REQUIRED`; UI deve solicitar seleção ativa, endpoint de listagem é somente leitura com autorização live. Conta legada de apenas um workspace preservada. |
| P1-02 | B — listener de foco desmontava todo o portal | AbortController, sequência por requisição, overlay de revalidação; formulários mantidos apenas quando UID e workspace persistem; mudança ou revogação desmonta e invalida cache React. |
| P1-03 | B — W9 armazena `deliveredQuantity` por entrega, W1 mantém seu `fulfillmentState` próprio | Projeção **física W9** adicionada à quota existente, com incremento atômico no evento, CAS e replay idempotente; cronograma distingue expedido W7, entregue fisicamente W9 e atendido W1. Linha legada sem campo exibe **desconhecido**, nunca zero enganoso. Sem alterar `fulfilledQuantity` W1 nem atesto sem fato independente. Teste real no Firestore Emulator A/B, prova documental e replay. |
| P1-04 | B — fluxo de exibição fiscal removia letras do CNPJ | Identidade exibe alfanuméricos sem perda; WLG não é considerado compatível: emissão bloqueada e aviso. CNPJ alfanumérico permanece no núcleo de perfis. |
| P1-05 | B — `reserve` aceitava string de chave apenas por prefixo; UI admitia série 0 | Reserva agora confere chave canônica imutável; série >=1; POST NFe/SEFAZ continua 503; intenção fiscal local não se apresenta como nota salva/autorizada. |
| P1-06 | B — seletor global era apenas desktop e o W15 duplicava ID | Seletor único em cabeçalho mobile/desktop; identidade fiscal só leitura; seleção posterior ao cookie autorizado. |
| P2-07 | B — valor `essential` não chegava ao RoutingWorkspace; style URL remoto livre | Contexto de modo Essencial, mapa opcional desligado; bundles e style relativo no mesmo domínio. |
| P2-08 | D — mensagens técnicas/UX de emissão | Copy do portal ajustada, sem termos W10/W14/W15 ou promessa de nota enviada. Refino geral tablet/desktop sem captura real ainda. |
| P2-09 | C — datas, valores e concorrência W8/W11 | Não houve certificação de defeito geral nesta rodada; não reescritos domínios sem reprodução. |

## Segurança e invariantes preservados
- Não tocar áreas militares, Warehouse, Almoxarifado, Eleonor, IAM, Cloud Run, Firebase Hosting, Firestore Rules ou produção.
- `EMPROVEX_COMPANY_PILOT_ENABLED` permanece **OFF por padrão** e as rotas fiscais em 503; não houve WLG/SEFAZ real, token fiscal ou documento produtivo.
- A seleção multi-CNPJ não é grant: UID live, Auth, membership e CNPJ continuam validados no servidor.
- Não se introduziu segundo ledger logístico, atesto ou baixa financeira automática.

## Certificação
- Baseline #530 (SHA acima) confirmado: W10/W14/W15/Fast/Core/R1/W4/Visual-R2 `SUCCESS`; Application CI e Domain CI R2 `SKIPPED`.
- Nova suíte W10-V: `scripts/empresas-w10-stage5-hardening.test.mjs` (assinatura HMAC, expiração 600s, fallback, reservas, alpha CNPJ, fluxo e mapas), adicionada ao workflow W10.
- Store fiscal Emulator A/B/CAS: `lib/company/fiscal/issuance/store-emulator.test.mjs` reforçado com chave forjada, série inválida.
- W1/W9: `lib/company/delivery/physicalProjection.mjs`, `service.ts`, `domain.test.mjs`, `features/company/schedule/CompanyScheduleWorkspace.tsx` e `lib/company/integration/w10-stage2-emulator.test.mjs` com projeção física diferenciada de atesto, quotas CAS, replay e prova em Firestore Emulator real A/B. Legado sem projeção anterior permanece `null` até conciliação controlada.
- **Resultado deste HEAD:** consultar checks da nova PR; não afirmar PASS antes da conclusão e inspecionar jobs deste commit. A execução real do Auth/Firestore Emulator no CI é distinta dos testes com doubles locais.
- **Playwright autenticado desktop/mobile/tablet e screenshots reais:** PENDING (nenhum screenshot inventado). Testes manuais de duas abas, cookie expirado, requisições concorrentes e contraste devem ser homologados com navegador real.
- **Outros gaps:** migração/reconciliação de quotas W9 históricas não executada nem mascarada; `fulfilledQuantity` W1 continua independente de prova logística e requer contrato de atesto; fluxo W14 completo versus formulário simplificado W15 continua sem emissão; contratos WLG/SEFAZ não validados. Build R1 mostrou falha intermitente do loader externo `next/font`, separada de TypeScript.

## Matriz de entrega e decisão
| Gate | Estado inicial |
| --- | --- |
| Código isolado + regressões Node | PENDING — verificar CI do HEAD |
| Emulator Auth+Firestore | PENDING — verificar CI do HEAD |
| TypeScript, build, Core, Fast, R1 | PENDING — verificar CI do HEAD |
| Playwright empresarial e screenshots reais | PENDING |
| WLG/SEFAZ/produção | NO-GO (desligado) |

**Parecer técnico inicial:** revisão isolada condicionada aos checks; **NO-GO** para homologação visual concluída, merge, deploy, produção e integração fiscal real. Reclassificar apenas com links de evidência do HEAD exato.

**Rollback:** descartar/fechar esta PR Draft; nada foi incorporado à PR #530, main ou produção. Reversão sem migration ou alteração de dados.

**SHA de código anterior ao handoff final:** `937f538d80b006f2c5b12d3f90ef21e4fdfd3b9f` (checkpoint anterior à inclusão da suíte/handoff). **SHA final do Worker:** usar o `head_sha` da PR Draft após a última correção/CI; o registro não congela um hash auto-referente.

## Links dos testes desta PR
- [PR #531 — checks associados ao HEAD](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/531/checks)
- [Histórico GitHub Actions W10](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/workflows/emprovex-empresas-w10.yml)
- Auth/Firestore Emulator: somente projetos `demo-*`, conexões locais; nenhum serviço produtivo.
- Playwright específico da extensão e screenshots desktop/tablet/mobile: PENDING, gate de homologação visual permanece NO-GO.
