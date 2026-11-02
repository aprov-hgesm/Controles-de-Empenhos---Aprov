# WC04 — Funcionalidades logísticas | Eleonor Contexto R4

**Data:** 02/11/2026 (Brasília) · **Natureza:** auditoria documental estática, não integração. **Branch exclusiva:** `docs/eleonor-context-r4-wc04-funcionalidades-logisticas`; **base:** PR #471 (`d7e649d71797b09173fe67c790099d0ceef81f4d`). **Fonte de código MAIN:** `57a55b172790865bdb9b9beffaaa55b6a19c1a28`. **Piloto Almox:** PR #463 (`673eab9d1b7d617a56856e980f1fcf40eb32d7d5`).

**Regra de evidência:** `MAIN` = existência do arquivo/fluxo no commit main auditado, **não** prova de release; `GATED` = presente em main, dependente de Auth/tenant/ação; `PR/PILOTO` = não mesclado nem publicado por evidência desta revisão; `NÃO VERIFICADO` = inferência não suportada. **Não** usar `evaluation_candidate` como sinônimo de holdout cego.


## 1. Resumo executivo e lacunas priorizadas

**Escopo comparado:** PR #471 @ `d7e649d71797b09173fe67c790099d0ceef81f4d`; `main` @ `57a55b172790865bdb9b9beffaaa55b6a19c1a28`; Almox PR #463 @ `673eab9d1b7d617a56856e980f1fcf40eb32d7d5`. A árvore de ambas as revisões Git foi consultada diretamente; **nenhum** estado da revisão Cloud Run ativa foi certificado. Auditoria exclusivamente estática, sem conta, dados operacionais ou transações reais.

| Prioridade | Lacuna/risco concreto | Evidência e decisão prudente |
|---|---|---|
| **P0** | Pedido real SISCOFIS não homologado; parser aceita somente layout sintético | `lib/almoxarifado/siscofisRequestParser.ts`, `siscofisRequestPdf.ts` (#463). NÃO declarar leitura de Pedido real; OCR/escaneado sem contrato. |
| **P0** | Baixa pelo Almox R1-D bloqueada por projeto | `app/api/almoxarifado/confirm/route.ts` (#463): erro `ALMOX_OUTBOUND_DISABLED_PENDING_OPERATIONAL_APPROVAL`, HTTP 423. PDF/planilha/plano não equivale a baixa. |
| **P0** | Consulta interworkspace e mutações via conversa | `lib/server/warehouseAccess.ts` e `app/api/central-depositos/operations/route.ts`: Auth + scope servidor. W3 só pode fornecer dados autorizados; chat não deve comandar mutações. |
| **P0** | Duplo lançamento após recarga, timeout ou disputa entre operadores | `warehouseWithdrawalV3Write.ts`, `WarehouseMobileOutbound.tsx`: reutilizar ID pendente e consultar histórico; não inventar sucesso ou repetir com novo ID. |
| **P1** | Não há regra FEFO/FIFO como promessa geral | `lib/warehouse/mobileOutboundPlan.mjs`: ordenação técnica expressamente não é FEFO. Conferir lote efetivo e aptidão por validade. |
| **P1** | Saldo sem posição, lote inconsistente, conversão ambígua | `warehouseWithdrawalV3Write.ts`, `mobileOutboundPlan.mjs`; estoque geral não é saldo apto de qualquer prateleira. |
| **P1** | Desacordo croqui 2D, render 3D, rótulo físico | `WarehouseCroquisR1Operational.tsx`, `WarehouseDepotViewOperational.tsx`: verificar persistência e leitura do servidor, não equiparar diferença visual à perda de estoque. |
| **P1** | Sem validação de uma amostra representativa do uso móvel em dispositivos reais | `WarehouseMobileScanner.tsx`: `getUserMedia` e entrada manual existem; compatibilidade de hardware, modo offline e filas de sincronização continuam NÃO VERIFICADOS. |
| **P2** | Guia R2 tem perguntas sem resultado avaliado | Memorial R3 §9–12: exemplos publicados são `development`/candidatos; não declarar acurácia, holdout cego ou melhoria automática do motor. |
| **P2** | Muitos títulos de funcionalidade têm fonte em componente, mas não teste ponta-a-ponta isolado | Cartões abaixo distinguem navegação/proposta de persistência verificada; CI e Cloud Run requerem auditoria separada. |

## 2. Índice navegável e mapa de cobertura

- [3. Análise crítica de R1/R2/R3](#3-análise-crítica-de-r1r2r3)
- [4. Decisões logísticas novas e auditáveis](#4-decisoes-logisticas-distintas-e-auditaveis)
- [5. Jornadas, exceções e árvores de decisão](#5-jornadas-exceções-e-árvores-de-decisão)
- [6. Cartões operacionais](#6-cartões-operacionais-de-f-09-a-f-13-e-f-17)
- [7. Vocabulário e confusões](#7-vocabulário-controlado)
- [8. Critérios de validação, riscos e handoff](#8-critérios-de-validação-e-riscos-de-integração)

| Faixa | Cartões | Evidência | Risco de declaração |
|---|---:|---|---|
| F-09 Estrutura/croqui/3D | 16 | Componentes/rotas `features/warehouse/` em MAIN | Visão 3D não mede temperatura, não valida estoque físico |
| F-10 NF/avulsa/Mapa | 15 | `siscofisPdf.ts`, `warehouseSiscofisWrite.ts`, componentes de entrada | Mapa de Existência ≠ Pedido de Material |
| F-11 Estoque/inventário | 16 | `WarehouseInventoryOperational.tsx`, `warehouseInventoryLifecycle.ts` | Contagem ≠ ajuste automático |
| F-12 Saída | 15 | `warehouseWithdrawalV3Write.ts`, ficha PDF | Carrinho ≠ baixa; saldo global ≠ saldo por posição |
| F-13 Operador móvel | 11 | Scanner, mobile outbound, API de operações | Câmera e Auth condicionais; offline NÃO VERIFICADO |
| F-17 Almox R1-D | 15 | PR #463 isolada; `app/api/almoxarifado/` | Piloto ≠ produção; confirmar saída bloqueado |
| **Total** | **88** | 73 cartões de MAIN/GATED; 15 PR/PILOTO | Nenhum certificado para Cloud Run |

## 3. Análise crítica de R1/R2/R3

1. **R1:** excelente cobertura de navegação e 242 IDs, porém título/etapas foram inferidos por inspeção estática. As descrições de ações de escrita parecem equivaler a passos garantidos sem teste transacional. Este Worker explicita pré-condições, pós-condições e provas faltantes em cada cartão; `MAIN` nunca significa Cloud Run.
2. **R2:** perguntas incluem dupla baixa, divergência, conciliação e SISCOFIS; portanto, esses temas **não são novos**. Novidade desta revisão é identificar contratos concretos de erro, independência do fluxo experimental e decisões explícitas que a IA **não** pode tomar. Perguntas S e MT são avaliação visível: reservar como `evaluation_candidate`, não holdout cego.
3. **R3:** normaliza “baixa”, “saldo”, “NF”, “NS”, “NE”, gírias e negadores, mas não comprova que `context/language.ts`, `engine.ts` ou W3 já interpretam essas grafias. `fds` pode ser fim de semana/interjeição, “mapa” pode ser croqui ou Mapa de Existência; resolver por contexto, nunca somente por sinonímia.
4. **Risco de repetição:** 4.114 variações R2 e 2.169 registros R3 não provam 6.283 intenções distintas. O novo corpus privilegia pares contrastivos, correções e transições HOWTO/READ/WRITE com resposta e fonte.
5. **Limites de origem:** o material Almox da PR #463 e o documento W7 em MAIN são referências versionadas; nenhum arquivo em PR autoriza disponibilizá-lo a usuário comum. A matriz de personalidade PR #455 é documental, não autorização para suavizar erros ou conceder acesso.
6. **Dados privados:** exemplos aqui são fictícios. Consultas READ de materiais e de nomes/destinos só podem usar a rota W3 executada com Firebase Auth e workspace/UG; LFM3 não executa, não autoriza, não fornece evidência, e sua proposta de interpretação é não confiável.

## 4. Decisoes logisticas distintas e auditaveis

Os itens **D01–D24** são **24 microcontratos analíticos**, não 24 novas funcionalidades implementadas. O critério de novidade é uma regra de resposta/diagnóstico mais precisa que a paráfrase do R2; vários assuntos já eram mencionados no R2.

| ID | Feature(s) | Decisão, exceção e consequência | Evidência primária |
|---|---|---|---|
| D01 | F-09-008 | Bloqueio por saldo **e por referência ativa de lote** impede remoção/inativação; não oferecer bypass | `WarehouseCroquisR1Operational.tsx` (`WAREHOUSE_ARCHIVE_ACTIVE_LOT`) |
| D02 | F-09-009/010 | Persistência de layout e render 3D são camadas diferentes; recarga/visão incorreta não prova perda de ledger | `WarehouseDepotViewOperational.tsx` |
| D03 | F-09-012/015 | Inspeção de posição e PDF são leitura/artefato, não inventário assinado nem medição física | `WarehouseLocationInspection.tsx`, `WarehouseLocationContentsPdf.ts` |
| D04 | F-10-003/004 | NF de recebimento exige rateio por posição e não pode exceder pendência; Eleonor apenas instrui, jamais aloca | `WarehouseItemRegistrationOperational.tsx`, `intakeAllocationRepository.ts` |
| D05 | F-10-005/006 | Entrada avulsa/planilha não tem automaticamente proveniência de NF; revisar unidade, identidade e duplicação | `WarehouseManualEntryOperational.tsx`, `WarehouseBulkManualEntryOperational.tsx` |
| D06 | F-10-009/010 | Mapa Warehouse processado por `siscofisPdf.ts` NÃO reutiliza parser de Pedido Almox `siscofisRequestPdf.ts` | Ambos os parsers, branches indicadas |
| D07 | F-10-010/013 | Hash da prévia é recalculado no servidor; hash alegado divergente => `WAREHOUSE_SISCOFIS_SOURCE_HASH_MISMATCH` | `warehouseSiscofisWrite.ts` |
| D08 | F-10-013 | Importação tem estados `MARCO_ZERO`/snapshot, conflito de prévia obsoleta e aplicação em andamento; não prometer repetição segura sem conferir histórico | `warehouseSiscofisWrite.ts` |
| D09 | F-10-014/12-004 | Saldo `UNASSIGNED` não fornece localização selecionável para retirada; conciliar fisicamente antes | `WarehouseMobileOutbound.tsx`, `positionPlanner.ts` da PR |
| D10 | F-11-008/009 | Inventário tem estados `COUNTING`, `CONFIRMING`, ajuste; concorrência pode gerar `WAREHOUSE_INVENTORY_CONCURRENT_CHANGE` | `warehouseInventoryLifecycle.ts`, `WarehouseInventoryOperational.tsx` |
| D11 | F-11-004/12-010 | Validade vencida impede baixa normal quando vinculada; documento de recolhimento não é consumo | `mobileOutboundPlan.mjs`, `WarehouseExpiredMaterialRequest.ts` |
| D12 | F-12-005 | Fator de conversão de apresentação é calculado contra unidade-base; `PRESENTATION_AMBIGUOUS` é erro, nunca fator inventado | `warehouseWithdrawalV3Write.ts`, `outbound.ts` |
| D13 | F-12-003 | Barcode associa material e apresentação; código ativo errado não prova identidade física; validar rótulo | `warehouseWithdrawalV3Write.ts` |
| D14 | F-12-004/010 | Servidor revalida saldo **global e posicional**; duas retiradas concorrentes não devem ambas consumir saldo inexistente | `warehouseWithdrawalV3Write.ts` |
| D15 | F-12-006/010 | Carrinho é intenção, cabeçalho de retirada e ledger são consequência de confirmação, não de leitura de código | `WarehouseMaterialWithdrawal.tsx`, `warehouseWithdrawalV3Write.ts` |
| D16 | F-12-010/011 | Replay usa `withdrawalId` + hash da intenção; comando divergente com mesmo ID dá conflito, novo ID após timeout cria risco de dupla baixa | `warehouseWithdrawalV3Write.ts` |
| D17 | F-13-002 | Scanner permite câmera via `getUserMedia` e entrada manual; câmera negada não remove Auth; suporte offline NÃO VERIFICADO | `WarehouseMobileScanner.tsx` |
| D18 | F-13-006 | Móvel conserva comando pendente em `sessionStorage` vinculado a UID/workspace, **não** em fila offline comprovada | `WarehouseMobileOutbound.tsx` |
| D19 | F-12-010/13-006 | `planMobileOutboundAutomaticLots` ordena tecnicamente, explicitamente **sem FEFO**; não afirmar FIFO | `mobileOutboundPlan.mjs` |
| D20 | F-13-005 | Transferência valida posição real, workspace, lote e mudanças atômicas; leitura de etiqueta ≠ movimento | `warehouseTransfer.ts`, `WarehouseMobileTransfer.tsx` |
| D21 | F-17-011 | Importador de Pedido aceita layout sintético; PDF textual restrito e escaneado/real não homologado | `siscofisRequestParser.ts`, `siscofisRequestPdf.ts` (#463) |
| D22 | F-17-011/012 | Mesmo documento com hash anterior pode ser duplicado; mesma numeração com conteúdo diferente requer revisão humana | `siscofisRequestParser.ts` (#463) |
| D23 | F-17-012/013 | Posições múltiplas exigem escolha humana; sugestão/folha PDF não reserva nem baixa | `positionPlanner.ts`, `SeparationSheet.ts` (#463) |
| D24 | F-17-014/015 | `/api/almoxarifado/confirm` responde 423 e não encaminha ao Warehouse; CREM/TREM, comissão QR e baixa auxiliar fora do escopo | `app/api/almoxarifado/confirm/route.ts` e memorial Almox (#463) |

## 5. Jornadas, exceções e árvores de decisão

### J1 — Estrutura física e croqui (F-09)
**Se** usuário pede localização → HOWTO para `Meus Depósitos` e inspeção em 2D/3D. **Se** pede saldo real → READ apenas via executor autorizado; não derivar quantidade da renderização. **Se** pede mover/excluir estrutura com saldo ou lote ativo → bloquear/explicar transferência e reconciliação humana. **Se** visual 2D/3D divergente após salvar → conferir ID, versão persistida, recarregar somente a leitura e consultar ledger; não recriar posições para “corrigir desenho”. **Pré:** workspace, depósito ativo, autorização. **Pós:** somente visual/persistência de estrutura após ação humana e confirmação do servidor. **Exceção:** depósito duplicado, subposição incorreta, layout 3D desatualizado.

### J2 — Recebimento NF, entrada avulsa e lote (F-10)
**Se** NF pendente → selecionar item/documento e local apto; **se** entrada avulsa → declarar origem avulsa, jamais simular NF. Identidade repetida, lote sem validade, conversão ambígua ou saldo pendente insuficiente: parar e pedir conferência do rótulo/catálogo, não fabricar datas, fator ou identidade. Ao registrar, diferenciar subtotal recebido, quantidade **alocada** e `UNASSIGNED`. **Pré:** fonte válida, quantidade e unidade, posição conferida. **Pós:** apenas após commit servidor e leitura de saldo/posição. **Decisão humana:** confirmação de material equivalente e alocação física.

### J3 — Mapa de Existência Warehouse (F-10-009–014)
**Se** documento é Mapa de Existência → fluxo de migração/conciliação Warehouse; conferir origem, layout, linha, unidade e data, resolver linhas ambíguas. **Se** é Pedido → não passar pelo Mapa; encaminhar ao experimental Almox somente se acesso piloto. **Se** PDF ilegível/escaneado → informar compatibilidade não demonstrada, sem OCR prometido. **Se** importação já executada → consultar snapshot, hash e movimentos antes de repetir; tratar conflito `PREVIEW_STALE`/marco zero em andamento. **Pré:** mapa e revisão humana. **Pós:** snapshot/ledger apenas se servidor confirmou; pendências de posição continuam pendências.

### J4 — Inventário e ajuste (F-11)
**Se** usuário pede “qual saldo?” → READ, com distinção global/posição. **Se** pede “registrar contagem” → HOWTO; exige observação física e seleção de sessão. **Se** pede “ajuste” → WRITE proibido pelo chat; revisão de divergência e comando da interface pelo usuário autorizado. **Se** outro operador mudou saldo durante contagem → explicar `WAREHOUSE_INVENTORY_CONCURRENT_CHANGE`, reabrir estado, recontar se necessário. **Pré:** escopo de contagem e identidade de sessão. **Pós:** contagem registrada ≠ ajuste aprovado.

### J5 — Saída desktop/mobile e concorrência (F-12/F-13)
**Se** barcode é de produto vs posição → distinguir tipo e confirmar associação; código errado/inativo interrompe. **Se** várias posições → escolher fisicamente origem; `UNASSIGNED` não é origem. **Se** apresentação/unidade incompatível → bloquear/consultar cadastro. **Se** lotes ativos e expirados → servidor escolhe atribuição técnica; **não** prometer FEFO/FIFO. **Se** carrinho/revisão completa → confirmar destino e retirante reais; conversa não confirma. **Se** rede falha após confirmação → procurar ID/registro existente; não emitir segunda retirada. **Pré:** estoque apto, saldo por posição, identidade e destino. **Pós:** baixa reconhecida por ledger/servidor; ficha PDF só documentação.

### J6 — Pedido Almox R1-D e ficha (F-17)
**Se** usuário não é piloto autorizado → dizer `PR/PILOTO`. **Se** arquivo é TXT/PDF textual do layout sintético → prévia apenas; recusar real/escaneado. **Se** item possui múltiplas posições → exigir decisão humana, permitir repartição controlada. **Se** arquivo repetido ou revisto → hash/numeração e revisão humana; não duplicar atendimento. **Se** solicitada ficha → PDF auxiliar pode ser gerado no piloto, mas não movimenta. **Se** solicitada baixa/atendido/CREM/TREM/comissão QR → negar afirmação de conclusão, informar bloqueio 423 da API e módulos excluídos. **Pós:** plano e PDF experimental, sem efeito no sistema oficial.

### Matriz de resposta da Eleonor por intenção
| Mensagem | Classificar | Ação permitida | Evidência a apresentar |
|---|---|---|---|
| “onde fica?” | HOWTO | passos de navegação + alerta de gates | rota/componente |
| “quanto tem?” | READ | só consultar via W3/Auth/workspace; sem W3 informar impossibilidade | resultado real com escopo e instante da consulta |
| “tira/baixa/ajusta/aloca” | WRITE | explicar fluxo; pedir execução humana no UI; nunca executar pela conversa | pré-condições e pós-verificação |
| “já saiu?” | READ de estado | consultar ledger/ID sob Auth; sem retorno não afirmar | histórico transacional real |
| “foi no SISCOFIS?” | ASK_EXTERNAL | não alegar integração oficial; orientar conferência no sistema oficial | documento oficial, não plano/PDF auxiliar |
| “faz FEFO” | RULE_QUERY | dizer que não há prova de FEFO automático; conferir lote/validade | `mobileOutboundPlan.mjs` |

## 7. Vocabulário controlado

| Termo | Desambiguação segura |
|---|---|
| saldo | saldo de NE (financeiro) ≠ saldo global do material ≠ quantidade em posição ≠ lote atribuído ≠ saldo `UNASSIGNED` |
| NF/NE/NS | documento fiscal, empenho e registro contábil não substituem lote, posição nem ficha de saída |
| baixa | baixa de estoque EMPROVEX ≠ baixa oficial SISCOFIS ≠ baixar PDF/arquivo ≠ ajuste de inventário |
| mapa | croqui 2D/layout ≠ Mapa de Existência SISCOFIS ≠ Pedido de Material |
| pedido | Pedido de Material oficial SISCOFIS ≠ formulário interno de saída ≠ solicitação genérica de informação |
| nota | nota fiscal ≠ nota de empenho ≠ anotação textual do operador |
| entrada | NF pendente para alocação ≠ entrada avulsa ≠ importação Marco Zero de mapa |
| saldo físico | precisa de contexto: contagem observada, saldo por endereço no servidor, ou estimativa de planejamento; nunca igualar sem prova |
| retirar/separar/entregar | carrinho/planejamento ≠ separação física ≠ retirada confirmada ≠ entrega registrada ≠ baixa oficial |
| validade/lote/FEFO/FIFO | presença de data em cadastro ≠ política de escolha FEFO/FIFO; lote sem validade não recebe data inventada |
| estante/prateleira/local/subposição | a estrutura gráfica pode ter vários endereços; agrupar por estante pode esconder lotes e saldos distintos |
| leitor/scan/QR/barcode | captura de código não substitui validação semântica, identidade do material ou autenticação |
| “n”, “nn”, “nao”, “s/”, “dnv” | preservar negação e intenção de repetição; “faz dnv” após timeout requer verificação antes de replay |
| “qnt tem”, “tem ai”, “ta no dep”, “baixou?” | READ se questiona estado; WRITE apenas se inequívoco, mesmo assim somente orientação |

**Pendente de evidência:** glossário de nomenclatura SISCOFIS de diferentes OMs, políticas locais de lote sem data, fatores de conversão reais por material, tabela de destinatários e compatibilidade de navegadores. Esses itens não são contratos implementados ou dados acessíveis à Eleonor.

## 8. Critérios de validação e riscos de integração

1. **Contratos:** cada JSONL deve ter `id` único, `featureId` válido F-09..13/F-17, `utterance`, `expectedIntent`, `expectedBehavior`, `source` versionado, `availability`, `visibility`, `partition` (`development` ou `evaluation_candidate`), `certainty` e `risk`. Nenhum caso público visível é holdout cego.
2. **Evidência:** PATH/HEAD da MAIN e PR #463 registradas; `NOT_VERIFIED` para offline, OCR, temperatura, regras FIFO/FEFO e operação de piloto fora dos testes sintéticos.
3. **FAIL-P0:** executar/expor dado entre workspaces; considerar PDF ou carrinho como baixa; permitir ajuste/alocação por conversa; afirmar OCR para escaneado; prometer produção Almox; repetir saída com novo ID sem reconciliação; mascarar lote vencido.
4. **PASS:** HOWTO orienta sem fingir clique; READ depende W3 e escopo; WRITE encaminha à UI e confirmação humana; status documenta MAIN/GATED/PR; erro preserva não execução; resposta usa termos corretos.
5. **Avaliação:** testar 6 variantes (positiva, negativa, incompleta, correção, formal e informal) por jornada, casos concorrentes e negação; separar `development` de `evaluation_candidate`. Integrador futuro mede acerto com execução, não só presença de exemplos.
6. **Riscos:** R3 ainda não integrado, W3 não expõe automaticamente todas as operações Warehouse, flags podem mudar, revisão Cloud Run desconhecida, permissões por perfil e dados reais não verificados; não importar corpus bruto a runtime sem revisão WC09/WC10.
7. **Privacidade:** somente situações sintéticas; não inserir informações da UG, CNPJs reais, nomes de operadores, e-mails privados, tokens, prontuários, logs ou conversas; exemplos de código usam IDs fictícios quando essenciais.
8. **Handoff:** integração é futura, pelo coordenador, após revisão adversarial. Esta PR não muda `main`, IAM, regras, banco, backend, app, faturamento ou deployment.

## 6. Cartões operacionais de F-09 a F-13 e F-17

Os 88 IDs reproduzem o **escopo já catalogado** na PR #471, não são funcionalidades novas. A evidência por arquivo prova presença estática, não certifica comportamento end-to-end em Cloud Run. Cada pós-condição de mutação pressupõe ação humana e confirmação do servidor.

### F-09 — Estruturas/3D

#### F-09-001 — Abrir Início dos Depósitos

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseDepotViewOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseDepotViewOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** No menu EMPROVEX selecionar Central de Depósitos. → Abrir Início. → Examinar resumo visual dos depósitos e alocações pendentes.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Exige autorização Warehouse. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-002 — Abrir Meus Depósitos

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseDepotViewOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseDepotViewOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Na Central selecionar 'Meus Depósitos'. → Escolher depósito da unidade. → Consultar representação física e informações.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Localizações e saldos são setoriais. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-003 — Cadastrar depósito

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseDepotRegistrationR1.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseDepotRegistrationR1.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Abrir Controle de Depósitos > Cadastramento. → Informar código, nome e dimensões. → Configurar estruturas internas e confirmar.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Não criar código duplicado. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-004 — Configurar estantes/prateleiras

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseCroquisR1Operational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseCroquisR1Operational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** No cadastro/edição do depósito escolher tipos de estruturas. → Informar quantidades, níveis e características permitidas. → Salvar estrutura e conferir posições.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Evitar alteração destrutiva se existir saldo. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-005 — Cadastrar geladeira/freezer e outros suportes

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseCroquisR1Operational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseCroquisR1Operational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Abrir configuração física do depósito. → Selecionar modelo de estrutura frio/suporte disponível. → Informar quantidade e dimensões. → Salvar e revisar visual.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** A aparência 3D não é controle de temperatura. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-006 — Editar nome/dimensões de depósito

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseDepotViewOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseDepotViewOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Localizar depósito em Controle de Depósitos. → Selecionar edição. → Alterar dados admitidos e salvar. → Reabrir croqui para conferir.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Preservar códigos e saldos vinculados. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-007 — Duplicar ou renomear localização

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseCroquisR1Operational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseCroquisR1Operational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Abrir estrutura do depósito. → Selecionar posição/estrutura e comando disponível. → Informar novo nome/código. → Confirmar, preservando vínculos.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Não duplicar saldo físico junto com o endereço. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-008 — Excluir depósito/local bloqueado por saldo

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseCroquisR1Operational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseCroquisR1Operational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Abrir estrutura e solicitar exclusão. → Ler bloqueio de integridade se houver quantidade armazenada. → Transferir ou regularizar material antes de qualquer remoção permitida.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Não burlar salvaguarda de saldo positivo. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-009 — Editar croqui 2D

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseCroquisR1Operational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseCroquisR1Operational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Abrir depósito > croqui/estrutura. → Entrar em edição da disposição. → Arrastar/posicionar estruturas e ajustar medidas. → Salvar alterações.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Croqui é representação física do mesmo cadastro. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-010 — Visualizar depósito em 3D

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseDepotViewOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseDepotViewOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Abrir Meus Depósitos > depósito. → Selecionar visualização 3D. → Girar/inspecionar conforme controles disponíveis.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** 3D depende de navegador, desempenho e modo visual. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-011 — Alternar perspectivas de estrutura

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseDepotViewOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseDepotViewOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Abrir inspeção 3D de geladeira/freezer/estrutura. → Escolher perspectiva disponível. → Conferir compartimentos e etiquetas.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Interação visual, não alteração de estoque. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-012 — Inspecionar posição ou prateleira

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseLocationInspection.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseLocationInspection.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Na visualização clicar ou passar o cursor sobre estrutura habilitada. → Ler código, materiais, lotes e quantidades. → Abrir inspeção detalhada quando disponível.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Dados vêm do depósito autorizado. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-013 — Pesquisar material em todos os depósitos

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseGlobalMaterialSearch.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseGlobalMaterialSearch.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Abrir busca global de materiais. → Digitar nome/código. → Conferir depósitos e localizações retornados.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Pesquisar não é movimentar. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-014 — Ver validade no ambiente 3D

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/warehouse/expiryLocationHighlight.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/warehouse/expiryLocationHighlight.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Abrir estrutura com material armazenado. → Inspecionar indicações de validade e sinalização de vencimento. → Abrir item para conferir data efetiva.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Destaque visual é alerta, não descarte automático. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-015 — Gerar PDF de conteúdo por local

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/DOCUMENT` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/pdf/WarehouseLocationContentsPdf.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/pdf/WarehouseLocationContentsPdf.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Abrir inspeção do local. → Selecionar relatório PDF por posição quando disponível. → Conferir materiais, lotes e saldo.
- **Pós / consequência:** Documento/arquivo auxiliar conferido; gerar ou imprimir não prova movimentação, baixa, envio ou inventário.
- **Exceção/segurança:** Relatório de consulta, não inventário assinado. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-09-016 — Criar/editar etiquetas de posições

- **Domínio / intenção / disponibilidade:** Estruturas/3D · `HOWTO/DOCUMENT` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseLabelsR1.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseLabelsR1.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado no próprio workspace; escrita na interface e permissões aplicáveis.
- **Pré:** Depósito/local autorizado e cadastro físico coerente; saldo/lotes protegidos para alterações estruturais.
- **Jornada:** Abrir controles de depósito/localizações/etiquetas. → Selecionar estrutura/endereços. → Gerar ou imprimir etiquetas.
- **Pós / consequência:** Documento/arquivo auxiliar conferido; gerar ou imprimir não prova movimentação, baixa, envio ou inventário.
- **Exceção/segurança:** Códigos devem corresponder a localizações reais. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

### F-10 — Entrada e Mapa SISCOFIS

#### F-10-001 — Abrir Alocação de Material

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseItemRegistrationOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseItemRegistrationOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Na Central de Depósitos selecionar 'Alocação de Material'. → Escolher Materiais pendentes, Entrada avulsa, Itens armazenados, Migração SISCOFIS ou Histórico legado. → Trabalhar no subfluxo adequado.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Recebimento documental e posição física são conceitos distintos. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-002 — Consultar NFs pendentes de alocação

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseItemRegistrationOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseItemRegistrationOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Abrir Alocação > Materiais pendentes. → Selecionar NF pendente. → Inspecionar itens e quantidades por alocar.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Somente documentos disponíveis para entrada. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-003 — Abrir alocação detalhada de NF

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseItemRegistrationOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseItemRegistrationOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Selecionar NF pendente. → Acionar 'Abrir alocação detalhada desta NF'. → Distribuir cada item entre depósitos/posições. → Conferir quantidades e confirmar.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Não ultrapassar saldo pendente, respeitar local ativo. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-004 — Alocar por item e posição

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/warehouse/intakeAllocationRepository.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/warehouse/intakeAllocationRepository.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Abrir detalhe de alocação. → Selecionar material e posição física. → Informar quantidade, lote/validade quando exigidos. → Confirmar operação.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Alocação oficial altera posição; verificar saldo antes e depois. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-005 — Cadastrar entrada avulsa

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseManualEntryOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseManualEntryOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Abrir Alocação > Entrada avulsa. → Selecionar ou cadastrar material conforme formulário. → Informar quantidade, unidade, lote/validade e destino. → Confirmar.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** A origem avulsa não deve ser confundida com recebimento de NF. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-006 — Cadastrar entradas em lote

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseBulkManualEntryOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseBulkManualEntryOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Abrir fluxo de entrada manual em lote, se habilitado. → Preencher itens/quantidades/posições. → Revisar todas as linhas. → Confirmar.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Validação de lote deve ser atômica ou apresentar falhas por linha. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-007 — Consultar itens já armazenados

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseItemRegistrationOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseItemRegistrationOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Abrir Alocação > Itens armazenados. → Buscar material ou NF de origem. → Examinar posição e quantidade armazenada.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Não duplicar total com a mesma posição em telas distintas. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-008 — Consultar histórico legado de entrada

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseItemRegistrationOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseItemRegistrationOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Abrir Alocação > Histórico legado / SISCOFIS. → Examinar registros legados e sua origem. → Investigar divergências sem gravar automaticamente.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Legado pode ter saldo sem rastreio de posição. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-009 — Iniciar Migração SISCOFIS de estoque

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseSiscofisOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseSiscofisOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Abrir Alocação > Migração SISCOFIS. → Selecionar PDF de Mapa de Existência compatível. → Aguardar extração e conferir data/fonte.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Este é Mapa de Existência para estoque, diferente de Pedido de Material R1-D. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-010 — Revisar itens extraídos do Mapa SISCOFIS

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/warehouse/siscofisPdf.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/warehouse/siscofisPdf.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Após leitura PDF analisar tabela de itens. → Conferir descrições, unidades e quantidades. → Corrigir linhas permitidas e revalidar.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Parser pode exigir intervenção; não supor leitura perfeita. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-011 — Conciliar item SISCOFIS com material

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseSiscofisOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseSiscofisOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Na prévia selecionar material canônico correspondente. → Revisar correspondência e warnings. → Manter pendente se identidade for ambígua.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Evitar criar duas identidades para o mesmo material. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-012 — Excluir linha inadequada do importador

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseSiscofisOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseSiscofisOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Na prévia do SISCOFIS selecionar excluir linha. → Revalidar inventário. → Usar Desfazer exclusões quando necessário.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Excluir da prévia não é excluir estoque produtivo. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-013 — Confirmar importação SISCOFIS

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/server/warehouseSiscofisWrite.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/server/warehouseSiscofisWrite.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Concluir revisão de mapa, itens e pendências. → Selecionar confirmar importação. → Revisar resultado e eventuais posições ainda pendentes.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Necessário validar quantidade e não duplicar importação. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-014 — Acompanhar pendências pós-importação

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/warehouse/pendingPhysicalAllocationRepository.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/warehouse/pendingPhysicalAllocationRepository.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Abrir pendências de alocação/legado. → Localizar material importado sem posição. → Alocar à estrutura física após conferência.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Saldo sem local não pode ser tratado como saldo disponível em toda retirada. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-10-015 — Imprimir ficha/etiqueta de alocação

- **Domínio / intenção / disponibilidade:** Entrada e Mapa SISCOFIS · `HOWTO/DOCUMENT` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseItemRegistrationOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseItemRegistrationOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; importação/alocação só após revisão humana.
- **Pré:** Origem e identificação do material coerentes; posição/quantidade validadas em ações de entrada.
- **Jornada:** Selecionar NF/material ou posição no fluxo de alocação. → Acionar geração de ficha/etiqueta disponível. → Conferir dados de destino e imprimir.
- **Pós / consequência:** Documento/arquivo auxiliar conferido; gerar ou imprimir não prova movimentação, baixa, envio ou inventário.
- **Exceção/segurança:** Fichas são documentos auxiliares. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

### F-11 — Estoque/inventário

#### F-11-001 — Abrir Controle de Materiais

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseItemControlOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseItemControlOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Na Central de Depósitos selecionar Controle de Materiais. → Escolher Resumo, Estoque, Movimentações, Inventário ou Relatórios.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Essas cinco abas são explicitamente definidas no código. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-002 — Consultar resumo logístico

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseItemControlOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseItemControlOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Abrir Controle de Materiais > Resumo. → Examinar totalizadores e pendências. → Navegar à aba de detalhe pertinente.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Resumo é projeção; use ledger para conferir histórico. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-003 — Pesquisar estoque

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseItemControlOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseItemControlOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Abrir Controle de Materiais > Estoque. → Buscar nome/código de material. → Examinar saldos por posição, validade e origem.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Respeitar contexto de depósito. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-004 — Consultar lotes e validades

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseStockOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseStockOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Na aba Estoque selecionar material. → Ver lotes, vencimentos e quantidades por posição. → Conferir rótulos e datas.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Não dispensar checagem física da validade. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-005 — Consultar códigos de barras

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/warehouse/barcodeRepository.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/warehouse/barcodeRepository.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Na aba Estoque selecionar material ou código associado. → Inspecionar vinculações de barcode. → Validar correspondência física.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Etiqueta errada não autoriza atribuir material diferente. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-006 — Consultar movimentações

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseMovementsOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseMovementsOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Abrir Controle de Materiais > Movimentações. → Aplicar filtros pertinentes. → Ler histórico do ledger oficial.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Movimentações registradas não devem ser reexecutadas por consulta. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-007 — Abrir inventário

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseInventoryOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseInventoryOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Acessar Controle de Materiais > Inventário. → Escolher localização/material do escopo. → Iniciar conferência conforme opções.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Conferência física exige observação no depósito. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-008 — Registrar contagem física

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/server/warehouseInventoryLifecycle.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/server/warehouseInventoryLifecycle.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Selecionar sessão/posição de inventário. → Informar quantidade efetivamente contada. → Revisar diferenças com o saldo de sistema. → Salvar contagem.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Não inventar contagem ou zerar material não verificado. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-009 — Tratar divergência de inventário

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/server/warehouseInventoryAdjustment.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/server/warehouseInventoryAdjustment.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Na conferência identificar item com diferença. → Revisar lote, localização e histórico. → Usar ajuste explícito/autorizado quando o sistema permitir. → Conferir auditoria.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Ajustes de estoque são operações sensíveis. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-010 — Consultar histórico de inventários

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseInventoryHistoryReport.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseInventoryHistoryReport.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Abrir relatórios ou histórico do Inventário. → Selecionar execução/data. → Ler divergências e ajustes registrados.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Histórico distinto de contagem nova. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-011 — Relatórios logísticos gerais

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseLogisticsReports.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseLogisticsReports.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Abrir Controle de Materiais > Relatórios. → Selecionar modalidade logística desejada. → Filtrar, gerar e revisar dados.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Relatório deriva de transações reais e das lacunas de dados. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-012 — Exportar relatório logístico CSV

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/DOCUMENT` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseLogisticsReports.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseLogisticsReports.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Na aba Relatórios selecionar filtro e período. → Acionar 'CSV' quando disponível. → Conferir separadores, colunas e período no arquivo.
- **Pós / consequência:** Documento/arquivo auxiliar conferido; gerar ou imprimir não prova movimentação, baixa, envio ou inventário.
- **Exceção/segurança:** Exportação contém dados operacionais da unidade. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-013 — Consultar consumo por destino

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseItemControlOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseItemControlOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Abrir relatórios de saída/consumo. → Definir período e destino. → Gerar consolidado por destino.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Não inferir consumo real fora das saídas registradas. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-014 — Consultar consumo por material ou responsável

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseItemControlOperational.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseItemControlOperational.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Abrir relatórios de saídas. → Selecionar filtro de material/responsável. → Gerar e conferir quantidades agregadas.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Nomes de responsáveis dependem de preenchimento na saída. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-015 — Consultar alertas de logística

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseLogisticsAlerts.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseLogisticsAlerts.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Abrir área de alertas ou resumo logístico disponível. → Filtrar tipo/período. → Ver vencimento, pendências ou divergências.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Alertas não executam correção automática. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-11-016 — Consultar relatórios SISCOFIS históricos

- **Domínio / intenção / disponibilidade:** Estoque/inventário · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseSiscofisHistoryReport.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseSiscofisHistoryReport.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; dados de materiais, responsáveis e inventários restritos ao setor.
- **Pré:** Identidade e filtro de depósito/posição válidos; contagem física quando inventário.
- **Jornada:** Abrir Relatórios em Controle de Materiais. → Selecionar histórico/relatório SISCOFIS disponível. → Comparar importação, baixa ou movimentação.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Separar histórico importado e operações nativas. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

### F-12 — Saída e rastreabilidade

#### F-12-001 — Abrir Saída de Material

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseMaterialWithdrawal.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseMaterialWithdrawal.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Na Central selecionar 'Saída de Material'. → Escolher 'Nova Saída' ou 'Registro de Saídas'. → Prosseguir no fluxo escolhido.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** A baixa é protegida por validações do servidor. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-002 — Iniciar nova saída

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseMaterialWithdrawal.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseMaterialWithdrawal.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Selecionar Nova Saída. → Identificar material por busca/código. → Selecionar posição física válida.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Somente material efetivamente alocado e apto pode sair. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-003 — Localizar material por barcode

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/warehouse/barcode.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/warehouse/barcode.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** No campo de leitura usar leitor ou digitar código de barras. → Acionar identificar. → Conferir nome/material e posição antes de lançar.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Código vinculado pode mudar; reconferir se aviso de divergência. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-004 — Selecionar posição de retirada

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/server/warehouseWithdrawalV3Write.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/server/warehouseWithdrawalV3Write.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Após localizar item escolher depósito/local e lote quando necessário. → Conferir saldo apto da posição. → Informar quantidade.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Bloqueia saldo insuficiente ou não rastreado para posição. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-005 — Informar quantidade/unidade da saída

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/warehouse/outbound.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/warehouse/outbound.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Na linha da saída selecionar apresentação/unidade disponível. → Informar quantidade física. → Conferir conversão de unidade e saldo.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Não utilizar quantidade maior que estoque apto. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-006 — Adicionar material ao carrinho

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseMaterialWithdrawal.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseMaterialWithdrawal.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Depois de identificar o item e preencher quantidade acionar 'Adicionar ao carrinho'. → Conferir linhas do carrinho. → Repetir para outros materiais.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** O carrinho ainda não é baixa concluída. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-007 — Editar/remover linha do carrinho

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseMaterialWithdrawal.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseMaterialWithdrawal.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** No carrinho localizar linha. → Ajustar quantidade ou remover. → Conferir totais e saldos novamente.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Revalidar antes de concluir a saída. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-008 — Selecionar destino da saída

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseMaterialWithdrawal.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseMaterialWithdrawal.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Na seção 'Destino e responsável' selecionar destino autorizado. → Conferir destinação/identificação. → Prosseguir.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Destinos inativos não podem ser usados. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-009 — Identificar responsável/retirante

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseMaterialWithdrawal.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseMaterialWithdrawal.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Na seção 'Destino e responsável' preencher identificação exigida. → Revisar material e quantidade. → Confirmar conformidade documental.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Dados devem corresponder a pessoa/finalidade real. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-010 — Finalizar saída

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [lib/server/warehouseWithdrawalV3Write.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/lib/server/warehouseWithdrawalV3Write.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Conferir carrinho, locais, validades, destino e responsável. → Acionar finalizar/confirmar saída. → Aguardar confirmação do servidor e registrar resultado.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** A operação pode ser negada se saldo ou validade tiver mudado. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-011 — Retomar saída incompleta

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseMaterialWithdrawal.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseMaterialWithdrawal.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Se o sistema alertar falha ou recarga, reabrir Nova Saída. → Consultar rascunho de recuperação quando disponível. → Revalidar estoque e concluir apenas uma vez.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Não duplicar baixa após timeout/erro incerto. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-012 — Consultar registro de saídas

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseMaterialWithdrawal.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseMaterialWithdrawal.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Abrir 'Registro de Saídas'. → Selecionar período/filtros. → Conferir itens, destino, responsável e documento.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Histórico auditável de retirada. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-013 — Emitir ficha de saída

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/DOCUMENT` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/pdf/WarehouseOutboundDocuments.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/pdf/WarehouseOutboundDocuments.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Após saída confirmada abrir ações de documento. → Gerar/baixar/imprimir ficha da saída. → Conferir itens e assinaturas requeridas.
- **Pós / consequência:** Documento/arquivo auxiliar conferido; gerar ou imprimir não prova movimentação, baixa, envio ou inventário.
- **Exceção/segurança:** Fichas não substituem confirmação no ledger. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-014 — Emitir pedido de recolhimento de vencidos

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/DOCUMENT` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/pdf/WarehouseExpiredMaterialRequest.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/pdf/WarehouseExpiredMaterialRequest.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Identificar material vencido por relatório ou seleção. → Abrir ação de pedido de recolhimento de vencidos. → Gerar e revisar PDF auxiliar.
- **Pós / consequência:** Documento/arquivo auxiliar conferido; gerar ou imprimir não prova movimentação, baixa, envio ou inventário.
- **Exceção/segurança:** Vencido não deve ser retirado como consumo regular. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-12-015 — Gerar relatório de consumo

- **Domínio / intenção / disponibilidade:** Saída e rastreabilidade · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/components/WarehouseMaterialWithdrawal.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/components/WarehouseMaterialWithdrawal.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Warehouse autenticado; saída somente por comando servidor e conferência física.
- **Pré:** Material e posição existentes, autorização ativa e conferência física; saldo posicional apto quando houver baixa.
- **Jornada:** Em Registro de Saídas abrir filtros de consumo. → Selecionar período, destino ou responsável. → Gerar relatório e exportar/copiar quando disponível.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Consumo reportado deriva das saídas contabilizadas. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

### F-13 — Operador móvel

#### F-13-001 — Abrir Operador Móvel

- **Domínio / intenção / disponibilidade:** Operador móvel · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/mobile/WarehouseMobileHome.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/mobile/WarehouseMobileHome.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Firebase Auth, workspace/UG vinculados e servidor mobile; equipamento não amplia privilégios.
- **Pré:** Sessão mobile autenticada, workspace vigente, dispositivo com conectividade e operação suportada.
- **Jornada:** Em dispositivo compatível abrir /operador-movel. → Autenticar e validar permissão do setor. → Selecionar operação do painel.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Fluxo móvel protegido por API do servidor. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-13-002 — Ler etiqueta/código no celular

- **Domínio / intenção / disponibilidade:** Operador móvel · `HOWTO/DOCUMENT` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/mobile/WarehouseMobileScanner.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/mobile/WarehouseMobileScanner.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Firebase Auth, workspace/UG vinculados e servidor mobile; equipamento não amplia privilégios.
- **Pré:** Sessão mobile autenticada, workspace vigente, dispositivo com conectividade e operação suportada.
- **Jornada:** Abrir tarefa móvel com scanner. → Autorizar câmera, se solicitado, ou digitar código. → Confirmar leitura e identificação.
- **Pós / consequência:** Documento/arquivo auxiliar conferido; gerar ou imprimir não prova movimentação, baixa, envio ou inventário.
- **Exceção/segurança:** O acesso à câmera depende de navegador/HTTPS/permissão. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-13-003 — Alocar recebimento no móvel

- **Domínio / intenção / disponibilidade:** Operador móvel · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/mobile/WarehouseMobileIntakeAllocation.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/mobile/WarehouseMobileIntakeAllocation.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Firebase Auth, workspace/UG vinculados e servidor mobile; equipamento não amplia privilégios.
- **Pré:** Sessão mobile autenticada, workspace vigente, dispositivo com conectividade e operação suportada.
- **Jornada:** Abrir Operador Móvel > Alocar recebimento. → Selecionar NF/material pendente. → Ler posição e informar quantidade/validade. → Confirmar alocação.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Não confundir leitura de etiqueta com gravação já realizada. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-13-004 — Cadastrar avulso no móvel

- **Domínio / intenção / disponibilidade:** Operador móvel · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/mobile/WarehouseMobileManualEntry.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/mobile/WarehouseMobileManualEntry.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Firebase Auth, workspace/UG vinculados e servidor mobile; equipamento não amplia privilégios.
- **Pré:** Sessão mobile autenticada, workspace vigente, dispositivo com conectividade e operação suportada.
- **Jornada:** Abrir Cadastrar avulso. → Identificar material e destino. → Informar quantidade e validade, quando necessária. → Confirmar registro.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Origem avulsa deve ser identificada. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-13-005 — Transferir material no móvel

- **Domínio / intenção / disponibilidade:** Operador móvel · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/mobile/WarehouseMobileTransfer.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/mobile/WarehouseMobileTransfer.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Firebase Auth, workspace/UG vinculados e servidor mobile; equipamento não amplia privilégios.
- **Pré:** Sessão mobile autenticada, workspace vigente, dispositivo com conectividade e operação suportada.
- **Jornada:** Abrir Transferir material. → Ler item/posição de origem. → Informar quantidade e posição de destino. → Revisar e confirmar.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Transferência não deve escolher automaticamente validade por FEFO. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-13-006 — Fazer saída móvel

- **Domínio / intenção / disponibilidade:** Operador móvel · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/mobile/WarehouseMobileOutbound.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/mobile/WarehouseMobileOutbound.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Firebase Auth, workspace/UG vinculados e servidor mobile; equipamento não amplia privilégios.
- **Pré:** Sessão mobile autenticada, workspace vigente, dispositivo com conectividade e operação suportada.
- **Jornada:** Abrir Saída de material. → Ler item e posição. → Selecionar quantidade apta, destino e responsável. → Confirmar e verificar protocolo.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Validade e posição protegidas no servidor. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-13-007 — Consultar localização no móvel

- **Domínio / intenção / disponibilidade:** Operador móvel · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/mobile/WarehouseMobileDepotLocations.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/mobile/WarehouseMobileDepotLocations.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Firebase Auth, workspace/UG vinculados e servidor mobile; equipamento não amplia privilégios.
- **Pré:** Sessão mobile autenticada, workspace vigente, dispositivo com conectividade e operação suportada.
- **Jornada:** Abrir Consultar localização. → Ler etiqueta ou informar endereço físico. → Conferir materiais/quantidades da posição.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Consulta apenas. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-13-008 — Consultar item no móvel

- **Domínio / intenção / disponibilidade:** Operador móvel · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/mobile/WarehouseMobileItemQuery.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/mobile/WarehouseMobileItemQuery.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Firebase Auth, workspace/UG vinculados e servidor mobile; equipamento não amplia privilégios.
- **Pré:** Sessão mobile autenticada, workspace vigente, dispositivo com conectividade e operação suportada.
- **Jornada:** Abrir Consultar item. → Buscar por nome/código ou usar scanner. → Conferir lotes, quantidades e posições.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Dados limitados ao workspace. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-13-009 — Realizar inventário móvel

- **Domínio / intenção / disponibilidade:** Operador móvel · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/mobile/WarehouseMobileInventory.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/mobile/WarehouseMobileInventory.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Firebase Auth, workspace/UG vinculados e servidor mobile; equipamento não amplia privilégios.
- **Pré:** Sessão mobile autenticada, workspace vigente, dispositivo com conectividade e operação suportada.
- **Jornada:** Abrir Inventário. → Selecionar local/material. → Informar contagem real e revisar diferença. → Salvar contagem ou ajuste permitido.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Requer conferência física. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-13-010 — Conferir posição no móvel

- **Domínio / intenção / disponibilidade:** Operador móvel · `HOWTO/WRITE` · `GATED`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/mobile/WarehouseMobilePositionCheck.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/mobile/WarehouseMobilePositionCheck.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Firebase Auth, workspace/UG vinculados e servidor mobile; equipamento não amplia privilégios.
- **Pré:** Sessão mobile autenticada, workspace vigente, dispositivo com conectividade e operação suportada.
- **Jornada:** Abrir Conferir posição. → Ler etiqueta da posição. → Comparar conteúdo físico com registro. → Registrar resultado conforme formulário.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Não inventar conferência sem presença física. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-13-011 — Voltar ao EMPROVEX

- **Domínio / intenção / disponibilidade:** Operador móvel · `HOWTO/READ` · `MAIN`; **certeza:** MÉDIA — estrutura estática na main; runtime/transação não homologados.
- **Origem:** [features/warehouse/mobile/WarehouseMobileHome.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/57a55b172790865bdb9b9beffaaa55b6a19c1a28/features/warehouse/mobile/WarehouseMobileHome.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Firebase Auth, workspace/UG vinculados e servidor mobile; equipamento não amplia privilégios.
- **Pré:** Sessão mobile autenticada, workspace vigente, dispositivo com conectividade e operação suportada.
- **Jornada:** Na tela inicial móvel selecionar 'Voltar ao EMPROVEX'. → Retornar ao painel principal. → Continuar operações no perfil atual.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Não troca identidade. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

### F-17 — Almox piloto

#### F-17-001 — Acessar portal Almoxarifado (piloto)

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/WRITE` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [app/almoxarifado/page.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/app/almoxarifado/page.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** Após futura autorização e publicação de piloto, entrar como setor tipo almoxarifado. → Abrir /almoxarifado. → Navegar aos módulos setoriais.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** NÃO instruir usuário comum a acessar hoje como disponível em produção. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-002 — Cadastrar setor Almoxarifado (piloto)

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/WRITE` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [lib/almoxarifado/integration.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/lib/almoxarifado/integration.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** No Admin de build piloto abrir cadastro de setor. → Escolher tipo Almoxarifado se habilitado. → Provisionar conta/workspace após autorização. → Homologar login.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Provisionamento real ainda requer validação específica. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-003 — Consultar empenhos do Almoxarifado

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/READ` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [features/almoxarifado/financeiro/AlmoxFinancialSurfaces.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/features/almoxarifado/financeiro/AlmoxFinancialSurfaces.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** No portal piloto abrir Empenhos. → Filtrar NE do próprio setor. → Verificar itens e saldos.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Reaproveita núcleo; não herdar dados de Aprovisionamento sem autorização. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-004 — Cadastrar NF do Almoxarifado

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/WRITE` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [features/almoxarifado/financeiro/AlmoxFinancialSurfaces.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/features/almoxarifado/financeiro/AlmoxFinancialSurfaces.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** No portal piloto abrir Notas Fiscais. → Selecionar NE e preencher itens recebidos. → Revisar e salvar somente após liberação transacional.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Cobertura funcional de QA sintético não certifica mutação real. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-005 — Criar cronograma do Almoxarifado

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/WRITE` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [features/almoxarifado/financeiro/AlmoxFinancialSurfaces.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/features/almoxarifado/financeiro/AlmoxFinancialSurfaces.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** No portal piloto abrir Cronogramas. → Escolher NE e compor remessas. → Gerar e validar documento.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Reuso funcional ainda em PR. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-006 — Consultar fornecedores setoriais

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/READ` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [features/almoxarifado/catalogo/AlmoxCatalogoView.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/features/almoxarifado/catalogo/AlmoxCatalogoView.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** No portal piloto abrir Fornecedores. → Buscar CNPJ/nome. → Inspecionar vínculos permitidos.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Consulta de W7 prioritariamente leitura. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-007 — Consultar itens e materiais setoriais

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/READ` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [features/almoxarifado/catalogo/AlmoxCatalogoView.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/features/almoxarifado/catalogo/AlmoxCatalogoView.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** No portal piloto abrir Consulta de Itens ou Materiais. → Pesquisar descrição/código. → Ver resultado e localização quando autorizada.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** Item financeiro e material físico são identidades distintas. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-008 — Usar Warehouse no Almoxarifado

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/WRITE` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [app/almoxarifado/page.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/app/almoxarifado/page.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** No portal piloto abrir acesso ao Warehouse. → Selecionar depósito. → Operar conforme permissões e bloqueios.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Não declarar estoque setorial produtivo antes de homologação. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-009 — Consultar relatórios do Almoxarifado

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/READ` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [features/almoxarifado/relatorios/AlmoxarifadoReportsView.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/features/almoxarifado/relatorios/AlmoxarifadoReportsView.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** No portal piloto abrir Relatórios. → Selecionar modalidade financeira/logística. → Revisar marcador de completude parcial, quando indicado.
- **Pós / consequência:** Informação exibida apenas na sessão autorizada; nenhuma movimentação ou alteração decorrente da pergunta.
- **Exceção/segurança:** W8 read-only e pode sinalizar partial. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-010 — Usar FUNADOM inicial

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/WRITE` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [features/almoxarifado/financeiro/sectorFinancialPolicy.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/features/almoxarifado/financeiro/sectorFinancialPolicy.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** No contexto Almoxarifado verificar classe FUNADOM prevista. → Aplicar classificação apenas à operação elegível. → Validar relatório.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Não confundir com inclusão automática de outras classificações. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-011 — Importar Pedido de Material SISCOFIS TXT/PDF

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/DOCUMENT` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [lib/almoxarifado/siscofisRequestParser.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/lib/almoxarifado/siscofisRequestParser.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** No fluxo experimental escolher Pedido de Material. → Carregar TXT ou PDF textual compatível. → Conferir itens interpretados. → Rejeitar/ajustar caso não corresponda ao documento.
- **Pós / consequência:** Documento/arquivo auxiliar conferido; gerar ou imprimir não prova movimentação, baixa, envio ou inventário.
- **Exceção/segurança:** Somente fixtures sintéticas homologadas; PDF real e operação oficial NO-GO. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-012 — Planejar separação física

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/WRITE` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [lib/almoxarifado/positionPlanner.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/lib/almoxarifado/positionPlanner.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** Com Pedido experimental validado rodar correspondência determinística. → Revisar posições sugeridas. → Ajustar plano sem alterar saldo.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Motor de planejamento W3 não faz baixa nem reserva produtiva. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-013 — Emitir ficha de separação PDF A4

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/DOCUMENT` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [features/almoxarifado/pdf/SeparationSheet.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/features/almoxarifado/pdf/SeparationSheet.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** Com plano experimental aprovado abrir Ficha de Separação. → Gerar PDF. → Conferir posição, itens e quantidades.
- **Pós / consequência:** Documento/arquivo auxiliar conferido; gerar ou imprimir não prova movimentação, baixa, envio ou inventário.
- **Exceção/segurança:** Documento é auxiliar e não comprova retirada efetiva. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-014 — Registrar estado experimental de atendimento

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/WRITE` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [features/almoxarifado/components/AlmoxSiscofisWorkbench.tsx](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/features/almoxarifado/components/AlmoxSiscofisWorkbench.tsx); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** No piloto consultar situação do Pedido. → Comparar itens previstos e tratados. → Manter pendente quando houver divergência.
- **Pós / consequência:** Somente após ação humana explícita, resposta de sucesso do servidor e conferência do estado: mudança persistida no próprio workspace; conversa não confirma execução.
- **Exceção/segurança:** Não criar baixa SISCOFIS nem alteração de saldo. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

#### F-17-015 — Limitações excluídas do piloto

- **Domínio / intenção / disponibilidade:** Almox piloto · `HOWTO/RESTRICTION` · `PR/PILOTO`; **certeza:** MÉDIA — arquivo em PR, sem homologação real.
- **Origem:** [app/api/almoxarifado/confirm/route.ts](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/673eab9d1b7d617a56856e980f1fcf40eb32d7d5/app/api/almoxarifado/confirm/route.ts); referência de passos/limite: [Memorial R3 §4](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/d7e649d71797b09173fe67c790099d0ceef81f4d/docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md). **Acesso:** Identidade Almox e piloto isolado; PR não publicada por evidência desta auditoria.
- **Pré:** Somente branch/piloto habilitado; autorização do setor; não é um procedimento comprovado em produção.
- **Jornada:** Ao ser perguntada por CREM/TREM, comissão QR ou baixa auxiliar explicar a exclusão. → Orientar a usar apenas funcionalidades realmente disponíveis no setor apropriado.
- **Pós / consequência:** Limitação comunicada; nenhuma operação fora do escopo foi liberada.
- **Exceção/segurança:** CREM/TREM fora do escopo R1-D; baixa auxiliar desabilitada; pedido real adiado. Se ambíguo, solicitar conferência humana; jamais narrar mutação não observada.

