# Performance R3 — Comercialização

Data de abertura: **2026-10-01**  
Branch: `feat/performance-r3-commercializacao`  
Baseline: `main@22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`

## Objetivo

Reduzir tempo de carregamento, quantidade de JavaScript inicial, leituras desnecessárias, custo de renderização e latência operacional do EMPROVEX **sem degradar estética, animações, transições, identidade visual ou ergonomia aprovada**.

Princípio:

> Não carregar, consultar, calcular ou preparar antecipadamente o que ainda não é necessário para a ação atual do operador.

## Baseline inicial

Build de produção observado:
- `/`: 460 kB First Load JS;
- `/adm-deposito`: 579 kB First Load JS;
- várias rotas operacionais da Central: 579 kB;
- `/admin`: 326 kB;
- shared JS: 103 kB.

Achados estruturais:
- o root operacional importa estaticamente grandes superfícies e hooks, mesmo quando a aba não está aberta;
- `WarehouseSectionContent` importa estaticamente as seis superfícies principais da Central;
- subtabs relevantes também importam superfícies pesadas antecipadamente;
- Saída de Material pode pré-carregar materiais, saldos, barcodes, depósitos, locais, location balances, lotes e destinos;
- repositório de barcode já possui busca direta por código e pode evitar catálogo amplo no fluxo de caixa;
- lotes podem ser consultados por material;
- location balances ainda são frequentemente consultados de forma ampla;
- fila de intake possui funções que recebem limites conceituais, mas ainda executam leituras integrais em pontos centrais;
- listas de Empenhos/NFs/Cronogramas executam filtros, joins e cálculos repetidos no cliente.

## R3.0 — Baseline e guardrails

Entregas:
- congelar métricas de bundle por rota;
- registrar tempos de tela pronta em cenários representativos;
- medir volume de documentos carregados nas principais superfícies;
- definir budgets iniciais sem tornar o CI instável;
- nenhuma mudança visual.

Gate:
- baseline versionado;
- build/typecheck verdes;
- metodologia reproduzível.

## R3.1 — Code splitting do EMPROVEX principal

Entregas:
- lazy loading das grandes views por aba;
- separar código de NF, Empenhos, Relatórios, Cronogramas etc. do caminho inicial;
- manter shell, login e Início leves;
- prefetch opcional após idle quando houver ganho real.

Meta:
- reduzir significativamente os 460 kB iniciais sem alterar comportamento visual.

## R3.2 — Code splitting da Central de Depósitos

Entregas:
- carregar somente a superfície correspondente à rota ativa;
- lazy loading de subtabs pesadas;
- impedir que Controle de Materiais carregue Estoque + Movimentações + Inventário + Relatórios antes da necessidade;
- impedir que Controle de Depósitos carregue Croqui + Localizações simultaneamente sem necessidade.

Meta:
- reduzir significativamente os 579 kB das rotas pesadas da Central.

## R3.3 — Shell/layout persistente da Central

Entregas:
- criar layout persistente quando tecnicamente seguro;
- evitar remontagem desnecessária de auth/workspace/header/sidebar;
- substituir reload completo de navegação por navegação Next quando aplicável;
- preservar fail-closed e validação de acesso.

## R3.4 — Cache curto em memória

Candidatos:
- depósitos;
- localizações;
- destinos;
- configurações estáveis.

Regras:
- somente memória;
- segregado por workspace;
- TTL/invalidação explícita;
- mutação bem-sucedida invalida/atualiza cache;
- nenhum dado operacional sensível persistido em localStorage como atalho.

## R3.5 — Saída de Material orientada à operação atual

Entregas candidatas:
- barcode direto por código, com cache dos últimos resultados;
- lotes carregados somente para o material selecionado;
- posições/saldos físicos consultados pelo material atual;
- preservar FEFO, revalidação transacional e proteção contra saldo negativo;
- manter exatamente o fluxo operacional barcode → quantidade → próximo item.

## R3.6 — Fila leve de recebimento

Problema:
- reconstrução da fila pode depender de coleções históricas amplas.

Entregas:
- separar caminho operacional de caminho de auditoria/reconciliação;
- consultar NFs elegíveis/pendentes de forma indexada e limitada;
- consultar estados apenas das NFs/itens relevantes;
- manter legado/reconciliação sob demanda;
- aplicar de verdade paginação/limites onde os contratos já indicam leitura bounded.

## R3.7 — CPU e renderização

Entregas:
- índices `Map` para invoices/alerts/totais por empenho;
- `useMemo` apenas onde remove recomputação mensurável;
- `useDeferredValue` para buscas pesadas;
- evitar `.filter()` integral repetido dentro de cada card;
- avaliar `content-visibility: auto` para listas longas;
- virtualização somente se os ganhos justificarem a complexidade.

## R3.8 — Dados quentes vs histórico

Executar somente após R3.1–R3.7 e medições.

Direção:
- realtime para dados realmente ativos;
- histórico sob demanda/paginado;
- não manter listeners globais apenas por conveniência.

Exemplos futuros:
- empenhos ativos/atuais realtime e antigos sob consulta;
- avisos pendentes realtime e arquivados históricos;
- cronogramas ativos realtime e encerrados históricos.

## R3.9 — Medição final e budget

Entregas:
- comparar First Load JS por rota antes/depois;
- comparar tempo até superfície operacional;
- comparar reads por abertura de tela;
- registrar LCP/INP/CLS onde fizer sentido;
- adicionar budget de bundle/arquitetura estável ao CI sem criar falso bloqueio frequente;
- documentar ganhos e limites.

## Ordem de implementação

Prioridade comercial:
1. R3.0;
2. R3.1;
3. R3.2;
4. R3.3;
5. R3.5;
6. R3.6;
7. R3.4/R3.7;
8. R3.8 somente se necessário;
9. R3.9.

## Restrições

- visual aprovado é preservado;
- nenhuma remoção de animação como estratégia principal;
- nenhuma migração Firebase/Vercel/Next.js nesta rodada;
- nenhuma quebra de contrato de ledger/estoque/NF;
- nenhuma redução de validação de segurança para ganhar velocidade;
- nenhuma leitura histórica ilimitada nova;
- otimização deve reduzir trabalho, não apenas esconder loading.

## Política de validação

Gates obrigatórios:
- TypeScript;
- build;
- testes de domínio;
- guards afetados;
- segurança/isolamento quando houver alteração de dados/acesso;
- Core Protection;
- diff hygiene.

Browser E2E:
- sob demanda, conforme `docs/TESTING_POLICY.md`.

Validação manual:
- usada para sensação de resposta, ergonomia e confirmação visual das superfícies afetadas.
