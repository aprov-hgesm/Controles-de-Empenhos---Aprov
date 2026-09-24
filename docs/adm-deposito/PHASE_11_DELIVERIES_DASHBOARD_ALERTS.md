# FASE 11 — Entregas, Dashboard Logístico e Alertas

## Escopo

A FASE 11 implementa DEP-22, DEP-22.1, DEP-23, DEP-23.1 e DEP-23.2 sobre a fronteira permanente do EMPROVEX Core Protection.

## Regra arquitetural central

O fluxo é unidirecional:

```text
EMPROVEX (Empenhos / Cronogramas / NFs) — somente leitura
                        ↓
ADM Depósito — correlação e projeções
                        ↓
warehouse/{workspaceId}/...
```

Nenhuma ação da FASE 11 grava em `workspaces/{workspaceId}/empenhos`,
`cronogramas`, `invoices` ou `alerts`.

## Entregas

- Cronograma existente continua sendo a única fonte de previsão;
- NF cadastrada continua significando recebimento no EMPROVEX;
- progresso recebido usa os valores canônicos do Empenho;
- atraso é calculado cumulativamente por item;
- excesso de um item não mascara falta de outro;
- não existe associação inventada NF ↔ remessa;
- correlação NF/Empenho ↔ material utiliza os movimentos `source.kind = INVOICE` já existentes no ledger do ADM.

## Dashboard logístico

A Visão Geral do ADM passa a ser o Dashboard real.

Indicadores derivam de fontes existentes e bounded:
- materiais com saldo;
- materiais sem localização;
- lotes vencidos/próximos;
- estoque zerado;
- baixo estoque quando houver limiar explícito;
- entregas vencidas/próximas;
- cronogramas ativos;
- inventários em reconciliação;
- divergências SISCOFIS;
- alertas logísticos detectados.

Não existe documento paralelo de “dashboard” nem listener global permanente.

## Alertas

D-025 foi revista para compatibilidade com o Core Protection.

Alertas logísticos:
- pertencem a `warehouse/{workspaceId}/alerts/{alertId}`;
- possuem ID determinístico por tipo + entidade;
- são reconciliados idempotentemente;
- são resolvidos, não apagados, quando a condição desaparece;
- não escrevem na Central de Avisos operacional do EMPROVEX;
- podem futuramente ser exibidos em uma superfície agregadora por leitura neutra, sem o ADM comandar mutações do núcleo.

Tipos iniciais:
- material sem localização;
- lote vencido;
- lote próximo do vencimento;
- estoque zerado;
- baixo estoque;
- inventário requerendo reconciliação;
- divergência SISCOFIS;
- entrega próxima;
- entrega vencida.

## Configuração

O limiar global de baixo estoque é opcional e explícito em:

`warehouse/{workspaceId}/settings/logistics-alerts`

Nenhum valor arbitrário é presumido.

## Segurança e desempenho

- piloto permanece founder-only;
- Rules novas ficam exclusivamente no bloco `warehouse/{workspaceId}`;
- Rules operacionais do EMPROVEX não são alteradas;
- leituras de Empenhos, Cronogramas e NFs são bounded;
- não há `onSnapshot` global;
- falha de alertas não bloqueia o Dashboard e nunca afeta operações do EMPROVEX.

## Validação da fase

Conforme D-054, durante a implementação:
- Core Protection permanece gate obrigatório;
- teste de domínio da FASE 11;
- guard permanente da FASE 11;
- regressão pesada Browser E2E/multi-tenant completa fica concentrada na campanha de estabilização/FASE 13, além do CI final quando aplicável.
