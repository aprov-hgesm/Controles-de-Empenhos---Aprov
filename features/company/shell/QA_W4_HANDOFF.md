# EMPROVEX Empresas — W4 / mapa de interfaces e QA
**Origem exclusiva:** W0 PR #511 @ `16b763e929342b6ea1f5858470cc670c9ea5a3f4`. **Escopo:** UI/UX sem APIs, sem autenticação alternativa, sem ledger militar, sem merge/deploy.

## Contratos W4 (apresentação)
- `features/company/shell/navigation.ts` é o manifesto **visual** de 14 rotas (não altera `features/company/modules.ts`, contrato compartilhado reservado ao integrador).
- `CompanyNavigation`: recebe apenas nome da empresa e callbacks de menu/logout da sessão validada. Link client-side com `aria-current`, foco móvel e Escape; não concede permissões.
- `CompanySessionGate`: usa a mesma sessão W0 (`resolveCompanySession`), revalida em foco, fail closed; modo Essencial é preferência local visual, não flag de backend nem autorização.
- `CompanyModulePlaceholder`: tela para todas as rotas ainda sem backend, sempre 'Em preparação'; configurações exibem somente identidade retornada pela sessão autorizada.
- `CompanySearchFilters`, `CompanyEmptyState`, `CompanyLoadingState`, `CompanyErrorState`, `CompanyFeedback`, `CompanyConfirmDialog`: componentes de apresentação, reutilizáveis no W9, sem consulta de dados, escrituras ou envio automático.

## Rotas e destino
| Rota | Tela | Estado W4 |
|---|---|---|
| /empresa | Início | Navegação e busca locais funcionais |
| /empresa/pedidos-om | Pedidos de OM | Em preparação |
| /empresa/empenhos | Empenhos | Em preparação |
| /empresa/compras | Compras | Em preparação |
| /empresa/fornecedores | Fornecedores | Em preparação |
| /empresa/catalogo | Catálogo | Em preparação |
| /empresa/cronogramas | Cronogramas | Em preparação |
| /empresa/estoque | Estoque | Em preparação |
| /empresa/entregas | Entregas | Em preparação |
| /empresa/notas-fiscais | Notas Fiscais | Em preparação |
| /empresa/financeiro | Financeiro | Em preparação |
| /empresa/clientes | Clientes | Em preparação |
| /empresa/relatorios | Relatórios | Em preparação |
| /empresa/configuracoes | Configurações | Identidade validada; demais preferências em preparação |
| /empresa/logistica | Alias legado | Apresenta Entregas em preparação |

## Matriz de acessibilidade e isolamento
| Critério | Implementação | QA independente |
|---|---|---|
| Teclado mobile / Escape / Tab | Menu em diálogo mobile, foco inicial/retorno, ciclo Tab | Playwright pendente de conta empresarial demo |
| Link ativo / leitor de tela | `aria-current`, nav nomeada, texto de preparação | Manual/axe pendente |
| Redução de movimento | `motion-reduce:transition-none`, animação dispensável, sem 3D | Playwright reduced-motion pendente |
| Falha de sessão | Bloqueio 401/403/503, erro com retry sem dados | Emulator W0 e CI; teste visual pendente |
| Página inexistente | `notFound()` em slug inválido | Route smoke pendente |
| Dados militares | Nenhum import do shell militar nem API de OM | Teste estático W4 |
| Desempenho | Sem fetch de dados operacionais, gráficos ou WebGL; preferência Essencial | Medição p50/p95 navegador pendente |
| Mobile desktop | Responsivo com 1/2/3 colunas e menu drawer | Capturas desktop/mobile pendentes |

**Comando de teste isolado W4:** `node --test features/company/shell/navigation.test.mjs`. **CI herdada:** empresas R1-M (typecheck, contratos, Emulator, núcleo, rotas críticas, build), Visual R2 e proteção do núcleo. **Limite honesto:** sem acesso a browser autenticado com identidade QA nesta branch não afirmar capturas ou Playwright empresarial executados. Não usar conta produtiva para testar.

**Handoff ao integrador W9/W10:** quando W1/W2/W3/W5 disponibilizarem os endpoints com guard server-side, substituir os placeholders por componentes de domínio sem alterar o provedor de sessão. Reconciliar `features/company/modules.ts` (9 slugs históricos) com o manifesto W4 apenas no integrador, preservando o alias /empresa/logistica. Não integrar automaticamente.
