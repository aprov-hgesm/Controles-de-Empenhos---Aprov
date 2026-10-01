# EMPROVEX — Memorial Oficial do Repositório

Última atualização: **2026-10-01**  
Baseline de produção consultada: `main@22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`

Este documento é a **porta de entrada canônica para continuidade do EMPROVEX como produto**. Ele resume o estado vigente e aponta para os documentos históricos/especializados. O histórico detalhado não deve ser apagado; quando houver divergência, a implementação real em `main` prevalece.

## 1. Fontes da verdade

Ordem de consulta para um novo trabalho:

1. `main` — estado efetivo do código em produção;
2. este memorial — estado consolidado e prioridades atuais;
3. documentação especializada do domínio alterado;
4. decisões arquiteturais registradas;
5. histórico de fases/branches/PRs apenas como contexto.

Para a Central de Depósitos:
- `docs/adm-deposito/README.md`;
- `docs/adm-deposito/STATUS.md`;
- `docs/adm-deposito/DECISIONS.md`;
- `docs/adm-deposito/ROADMAP.md`.

Política de testes:
- `docs/TESTING_POLICY.md`;
- `docs/DEVELOPMENT_CI_WORKFLOW.md`.

## 2. Estado atual do produto

O EMPROVEX é uma aplicação Next.js 15 com Firebase Auth/Firestore, Vercel e integrações Google utilizadas pelos fluxos institucionais.

Estado operacional consolidado:
- núcleo de Empenhos, Itens, Notas Fiscais, Comissão/Tesouraria, Cronogramas/Entregas, Avisos e Relatórios em produção;
- cadastro de empenho por PDF SIAFI disponível, preservando também as demais formas de cadastro existentes;
- edição segura de número/descritivo de item no detalhamento do empenho e antes da geração do cronograma;
- home operacional com snapshot agregado para reduzir leituras brutas;
- histórico de invoices em Relatórios consultado sob demanda/paginado;
- controle de sessão externo baseado em workspace/UG e lease;
- telemetria estimada de consumo por workspace + métricas globais separadas;
- Central de Depósitos integrada ao EMPROVEX e disponível para contextos de setor autenticados/autorizados, com isolamento por workspace/UG.

## 3. Central de Depósitos — estado vigente

Nome de produto vigente: **Central de Depósitos**.  
O caminho técnico `adm-deposito` e a documentação histórica são preservados por compatibilidade.

Superfícies principais:
- Início;
- Meus Depósitos;
- Alocação de Material;
- Saída de Material;
- Controle de Depósitos;
- Controle de Materiais.

Capacidades consolidadas:
- material canônico, ledger e saldos materializados;
- NF → pendência/entrada logística sem bloquear o núcleo EMPROVEX;
- depósitos, locais, subposições e croquis versionados;
- lotes, validade e FEFO;
- barcode e saída operacional;
- consumo imediato;
- inventário;
- SISCOFIS/Marco Zero via Mapa de Existência;
- relatórios logísticos;
- acesso externo multi-tenant já liberado;
- disposição visual dos depósitos personalizável por movimento, sem rotação/escala no fluxo atual;
- fluxo de recebimento simplificado/interativo;
- refatoração estrutural concluída em 2026-10-01 sem mudança de contratos operacionais.

## 4. Política de testes vigente

Browser E2E **não é gate permanente de merge/deploy**.

Gates automáticos prioritários:
- instalação reproduzível;
- TypeScript;
- build de produção;
- testes de domínio/contratos;
- guards estruturais e de segurança;
- testes Firestore/isolamento quando aplicáveis;
- EMPROVEX Core Protection;
- diff hygiene.

Browser E2E permanece disponível em workflow separado e é executado sob demanda quando o risco funcional/interativo justificar.

Validação manual assistida é parte legítima do processo para ergonomia, fluxo operacional, teclado/scanner, posicionamento visual e experiência real.

## 5. Performance e comercialização — prioridade atual

Branch oficial da rodada:  
`feat/performance-r3-commercializacao`

Documento detalhado:
`docs/PERFORMANCE_R3_COMERCIALIZACAO.md`

Objetivo:
> tornar o EMPROVEX perceptivelmente mais rápido e leve para comercialização sem reduzir qualidade visual, animações, transições ou identidade premium.

Baseline de build observado em 2026-10-01:
- `/`: **460 kB First Load JS**;
- `/adm-deposito`: **579 kB First Load JS**;
- várias rotas operacionais da Central: **579 kB First Load JS**;
- `/admin`: **326 kB First Load JS**;
- JS compartilhado global: **103 kB**.

Direção arquitetural:
- carregar código somente quando a superfície for usada;
- carregar dados somente quando a operação exigir;
- reduzir releituras e scans crescentes;
- preservar os contratos de negócio e segurança;
- medir antes/depois;
- impedir regressão futura por orçamento de performance.

## 6. Sequência oficial imediata

1. **Performance R3 — baseline mensurável**;
2. code splitting/lazy loading do núcleo operacional;
3. code splitting/lazy loading da Central;
4. navegação/layout persistente da Central;
5. cache curto em memória para dados estáveis;
6. Saída de Material orientada à operação atual (barcode/lote/posição sob demanda);
7. fila de recebimento sem scans integrais do histórico;
8. otimizações de CPU/renderização de listas;
9. telemetria de performance + orçamento no CI;
10. estabilização manual em uso real;
11. hardening transversal de segurança antes de expansão comercial ampla, sem adiar vulnerabilidade crítica confirmada.

## 7. Restrições da Performance R3

Não fazem parte da rodada, salvo necessidade técnica comprovada:
- remover/reduzir animações;
- simplificar identidade visual;
- trocar Firebase/Vercel/Next.js;
- reescrever ledger;
- alterar sem necessidade contratos de NF/Empenho;
- criar caches persistentes sensíveis no navegador;
- misturar migração de infraestrutura com otimização de frontend.

Toda mudança de performance deve ser reversível, medida e compatível com os guards existentes.

## 8. Riscos/pendências que não devem ser esquecidos

- crescimento histórico das coleções operacionais exige consultas progressivamente mais seletivas;
- a fila logística ainda possui pontos de leitura ampla que devem ser eliminados na R3;
- segurança e dependências continuam como linha separada de hardening;
- falha crítica real de segurança sempre interrompe a ordem normal de prioridades;
- documentação antiga pode descrever estados históricos como founder-only ou E2E obrigatório; essas afirmações não representam mais a política vigente quando conflitarem com este memorial e a `main`.

## 9. Regra de atualização

Ao concluir uma rodada relevante:
- atualizar este memorial;
- atualizar STATUS/DECISIONS/ROADMAP do domínio afetado;
- registrar baseline e resultado mensurável quando houver performance/custo;
- nunca apagar decisões antigas: marcar como superadas quando necessário;
- nunca tratar conversa isolada como fonte oficial superior ao repositório.
