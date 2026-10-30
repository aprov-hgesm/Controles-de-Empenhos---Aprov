# EMPROVEX — RAM R3: análise, baseline e economia sem regressões — 29/10/2026

**Branch:** `feat/visual-mode-r1-session-navigation`, PR #411 DRAFT. **Estado:** trabalho somente em ambiente de desenvolvimento, sem merge nem produção. **Diretriz:** GOV-SIMP-01; priorizar ganho medido e paridade de operações.

## I. Observação e o que NÃO está comprovado

- Capturas do PC Windows ~8 GB: Essencial 6,8/7,8 GB; Normal 7,6/7,8 GB; delta global 0,8 GB. CPU momentânea 5%/81%. **Não são medições por processo; não é possível afirmar economia de 800 MB de RAM do app.**
- Prévia localhost roda Chromium, Next dev/Node.js e Firebase/Java Emulators, todos competindo pela RAM. Comparar Chrome sozinho, Node e Java separadamente. CI Linux com dataset sintético também não substitui medição no PC Windows.
- O renderer SVG 3D completo, PDF com jsPDF lazy e callbacks Drive/assinatura devem ficar intocados.

## II. Mapa da retenção no código

| Local | Evidência | Implicação |
| --- | --- | --- |
| `hooks/useOperationalData.ts` | `useState` guarda cinco coleções em memória | Dados já carregados podem continuar retidos após aba mudar; não é automaticamente fuga |
| `hooks/useOperationalRealtimeCollections.ts` | onSnapshot por plano da aba e unsubscribe; `setData` não é limpo ao desligar | Realtime reduzido, mas cache React permanece por integridade/reutilização |
| `app/login/page.tsx` / `OperationalWorkspace.tsx` | após visitar transação, workspace/hooks permanecem montados | Protege drafts/operações; possível retenção de callbacks/referências |
| `DashboardView.tsx` | Map de agregados, filtros e tabela inicial de até 60 linhas | DOM reduzido, mas totais exigem todos os empenhos; arrays temporários eram desnecessários |
| `WarehouseIsometricPreview.tsx` | múltiplos SVG por estrutura/material e projeções memoizadas | Custo proporcional ao modelo; manter renderizador intacto, medir isoladamente |
| `lib/pdfToolkit.ts` | `import('jspdf')` / `jspdf-autotable` somente ao gerar | Já evita carregar bibliotecas PDF em navegação inicial |

**NÃO apagar de modo generalizado `invoices`/históricos ao entrar no Painel:** `relatorios` não abre listener de invoices por padrão e pode precisar dos registros carregados. Qualquer release seletiva requer reidratação validada, identidade correta, persistência de histórico e proteção para ações em andamento.

## III. Primeira melhoria segura — Painel sem duplicar array de linhas filtradas

Arquivos:
- `features/dashboard/domain/dashboardRowsProjection.ts`: projeção pura com `visibleRows` limitada e `matchedCount/committed/received` calculados sobre **todos** os empenhos filtrados em uma única passagem.
- `features/dashboard/components/DashboardView.tsx`: usa a projeção com limite inicial de 60 no Essencial; `Number.POSITIVE_INFINITY` no Normal.
- `scripts/dashboard-rows-projection.test.mjs`: 1000 registros sintéticos, paridade de totais e filtros, limites 0/60/120/∞, ordem, ausência de mutação.
- `tests/e2e/essential-memory-baseline.spec.mjs`: mede heap JS retido após GC, total alocado, contagem de nós DOM/documentos/listeners em Normal e Essencial na mesma sessão; exporta `artifacts/memory/essential-baseline.json`.
- Workflow `VISUAL-R2 Integrity Audit` exige os novos testes e publica artefato `essential-memory-synthetic-baseline`.

**Prova exigida:** TypeScript, teste de projeção, 48 contratos, E2E autenticado; relatórios e emissão de documentos não devem mudar. **Ganho quantitativo de RAM = NÃO DECLARAR até haver comparação de heap/DOM reproducível.**

## IV. Plano de avanço posterior ao baseline

1. Medir antes/depois do Painel e da navegação `painel → empenhos → nova_nf → painel` sob os mesmos dados, distinguindo RAM do Windows, heap JS e DOM.
2. Se o heap aumentar após visitas e não reduzir com GC, investigar retenção intencional vs fuga e reduzir **somente** o que pode ser reconstruído.
3. Se classes numerosas ainda gerarem DOM alto, preservar pesquisa, todos os filtros, contagem, totais, ações e "Mostrar mais". Nunca truncar exportações, consultas ou saldo.
4. Antes de separar hooks ou limpar arrays: E2E que redige NF, seleciona PDF, troca NE, retorna, gera TR, visita Relatórios e volta, sem perda; proteção UID/UG; invariância em 3D.
5. Evitar novos listeners Firebase ou migrações para API apenas para "desocupar RAM" sem medir benefício/custo.
6. GO apenas para análise/código isolado; NO-GO para merge/deploy sem autorização e validação externa apropriada.

**Precedência:** este documento complementa [Memorial Oficial do Modo Essencial](./MODO_ESSENCIAL_MEMORIAL_OFICIAL.md). Os números de CI são verificados nas execuções correntes, não presumidos.
