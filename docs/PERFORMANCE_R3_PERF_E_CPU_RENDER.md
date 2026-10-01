# PERF-E — CPU e Renderização

Data: **2026-10-01**  
Branch: `perf-r3-e-render-cpu`  
Base: `feat/performance-r3-commercializacao@076a233cf250c95882e78498e89dd2a44d034f74`

## Escopo

Esta frente reduz recomputação de CPU em listas grandes sem alterar layout, filtros, ordenação, informação exibida, regras financeiras, Firestore ou navegação.

Arquivos de view reservados nesta entrega:
- `features/empenhos/components/EmpenhosView.tsx`;
- `features/notas-fiscais/components/NotasFiscaisView.tsx`;
- `features/itens/components/ConsultaItensView.tsx`.

Cronogramas, Dashboard, Relatórios e grandes listas da Central foram auditados, mas não alterados nesta entrega para manter a superfície pequena e evitar reescrita sem necessidade comprovada.

## Padrões eliminados

### Empenhos

Antes:
- totais financeiros eram recalculados no filtro e novamente em cada card;
- quantidade de itens com saldo fazia uma terceira varredura;
- cada card executava `invoices.filter(...)` sobre todas as NFs;
- filtro e ordenação eram refeitos em qualquer render;
- busca pesada reagia no mesmo caminho urgente de cada tecla.

Depois:
- uma única passagem por itens gera `empenhoMetricsById`;
- um único índice `invoicesByEmpenhoId` elimina filtro completo por card;
- lista filtrada/ordenada é derivada em `useMemo`;
- busca usa `useDeferredValue`, mantendo o campo de texto responsivo e postergando apenas o trabalho derivado.

### Notas Fiscais

Antes:
- `empenhos.find(...)` aparecia repetidamente durante contadores, filtros e cards;
- contadores de tramitação faziam múltiplas varreduras integrais de `invoices`;
- busca/filtro/sort eram refeitos inline a cada render.

Depois:
- `empenhosById` fornece lookup O(1);
- `invoiceDerived` calcula localização, exigência de TR, timestamp e contadores em uma única passagem;
- opções de empenho e lista filtrada/ordenada são memoizadas;
- busca usa `useDeferredValue`.

### Consulta de Itens

Antes:
- toda a consolidação de itens era reconstruída em cada render, inclusive em cada tecla da busca;
- cards expandidos faziam `empenhos.find(...)` por associação;
- resumo fazia varreduras adicionais.

Depois:
- consolidação depende apenas de `empenhos` e fica em `useMemo`;
- resumo é derivado uma vez por alteração da consolidação;
- associações usam `empenhosById`;
- durante digitação, muda apenas o filtro da coleção já consolidada e o valor derivado é diferido.

## Medição

Benchmark sintético determinístico, executado em Node.js 22.16.0, com aquecimento e mediana de 15 execuções.

Fixture:
- **750 empenhos**;
- **12 itens por empenho**;
- **9.000 itens**;
- **2.250 notas fiscais**;
- **6 termos sucessivos de busca** na Consulta de Itens.

A medição compara o padrão algorítmico anterior com o padrão introduzido nesta branch. Os tempos são microbenchmark de CPU e **não substituem** perfil de navegador/React Profiler.

| Superfície | Tempo antes (mediana) | Tempo depois (mediana) | Varreduras antes | Varreduras depois | Redução |
| --- | ---: | ---: | ---: | ---: | ---: |
| Empenhos | 13,547 ms | 0,080 ms | 1.732.500 | 11.250 | 99,35% |
| Notas Fiscais | 21,191 ms | 0,585 ms | 3.388.500 | 5.250 | 99,85% |
| Consulta de Itens — sequência de digitação | 10,344 ms | 2,664 ms | 54.072 | 9.072 | 83,22% |

A melhoria principal não depende do número exato em milissegundos: a queda de varreduras é estrutural. Em especial, Empenhos deixa de fazer um scan de todas as NFs para cada card visível, e Notas Fiscais deixa de procurar o empenho correspondente linearmente em vários passes.

Para repetir a medição:

```bash
node scripts/measure-performance-r3-e-render-cpu.mjs
```

## Comportamento da busca

- o valor exibido no `input` continua sendo atualizado imediatamente;
- o termo usado para a lista derivada passa por `useDeferredValue`;
- filtros, regras de correspondência e ordenação permanecem os mesmos;
- durante digitação rápida, React pode manter por um instante o último resultado concluído enquanto prioriza o input, evitando trabalho pesado síncrono por tecla.

## Alteração visual

**Nenhuma.**

Não foram alterados:
- layout;
- cards;
- classes visuais;
- animações;
- quantidade deliberada de registros;
- conteúdo exibido.

## Alteração funcional

**Nenhuma intencional.**

Filtros, ordenações, cálculos financeiros e critérios de tramitação foram preservados.

## Guard próprio

```bash
node scripts/verify-performance-r3-e-render-cpu.mjs
```

O guard impede a reintrodução dos scans lineares específicos removidos nesta frente e verifica a presença das derivações memoizadas.

## Gates esperados no handoff

- TypeScript;
- build;
- guards relacionados às views afetadas;
- `node scripts/verify-performance-r3-e-render-cpu.mjs`;
- `npm run verify:emprovex-core-protection`.

Browser E2E não é necessário por padrão nesta frente porque não há mudança de fluxo ou interação; permanece sob demanda caso a integração revele risco.

## Não realizado

- merge em `main`;
- merge na branch integradora;
- deploy;
- Firestore;
- code splitting;
- cache compartilhado;
- virtualização;
- mudanças de layout.
