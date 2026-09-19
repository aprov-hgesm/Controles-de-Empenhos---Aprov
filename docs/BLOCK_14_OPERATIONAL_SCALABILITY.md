# EMPROVEX — Bloco 14 — escalabilidade Firestore e performance cliente

## Objetivo

Reduzir leituras Firestore, listeners ociosos e custo de bundle no cliente sem alterar regras de negócio,
persistência, identidade, segurança multi-tenant ou UX funcional.

## Problema anterior

Após autenticação operacional, o EMPROVEX mantinha simultaneamente cinco coleções em realtime:

- empenhos;
- alerts;
- invoices;
- comissoes;
- cronogramas.

Isso ocorria independentemente da aba ativa.

Além dos dois watchers mínimos de identidade/lifecycle do workspace, cada operador mantinha todas as
coleções operacionais abertas mesmo quando visualizava somente o Painel.

## Estratégia

O Bloco 14 introduz um plano explícito por aba:

| Aba | Coleções operacionais realtime |
| --- | --- |
| Painel | empenhos |
| Empenhos | empenhos, alerts, invoices |
| Consulta de Itens | empenhos |
| Notas Fiscais | empenhos, alerts, invoices, comissoes |
| Relatórios | empenhos, invoices, comissoes |
| Itens do Empenho | empenhos |
| Cronogramas | empenhos, cronogramas |

`empenhos` permanece sempre em realtime porque sustenta dashboard, classes, itens e navegação.

As coleções opcionais são inscritas e desinscritas independentemente. Trocar de uma aba que usa
`invoices` para outra que também usa `invoices` não reinicia o listener.

## Prontidão da seção

Ao ativar uma aba que exige uma coleção ainda não sincronizada, a área principal mostra um estado
transitório de sincronização. A interface funcional só é exibida quando todas as coleções requeridas
pelaquela seção entregaram o primeiro snapshot.

O último snapshot permanece em memória quando uma coleção é desativada; isso evita zerar o estado
local desnecessariamente, mas o retorno à aba exige um snapshot novo antes de liberar interação.

## Identidade e segurança

Os dois watchers mínimos continuam sempre ativos para setores externos:

- documento do workspace;
- conta da plataforma.

Eles não são otimizados neste bloco porque são controles de revogação de acesso e identidade.

A resolução de workspace, UG, UID e status permanece fail-closed.

## Impacto esperado em listeners

Antes:

```text
5 coleções operacionais realtime por operador
+ 2 watchers de identidade/lifecycle para setor externo
```

Depois:

```text
Painel / Itens:       1 coleção operacional
Empenhos / Relatórios: 3 coleções
Notas Fiscais:        4 coleções
Cronogramas:          2 coleções
```

Para 100 operadores simultaneamente no Painel, o número de listeners operacionais cai teoricamente
de 500 para 100, mantendo os watchers mínimos de segurança.

## Cálculos derivados

Listas derivadas de empenhos/NFs e cálculo de saldo por classe passam a usar `useMemo`/`useCallback`
para evitar recomputação desnecessária em renders não relacionados.

## PDF e bundle inicial

`jspdf` e `jspdf-autotable` deixaram de ser imports estáticos dos hooks operacionais.

Eles passam a ser carregados dinamicamente somente quando o operador solicita:

- prompt PDF de empenho;
- PDF de cronograma;
- Termo de Recebimento;
- relatório PDF de empenho.

Isso preserva os mesmos geradores, mas reduz o código necessário no carregamento inicial da aplicação.

## Dados e funcionalidade

O Bloco 14 não:

- pagina ou corta histórico;
- altera queries de negócio;
- reduz dados exibidos;
- altera Firestore Rules;
- altera writes;
- altera lifecycle de NS/CNPJ/empenho;
- altera documentos do Google Drive.

A otimização atua somente no tempo de vida das subscriptions e no carregamento de bibliotecas pesadas.

## Browser E2E

O Browser E2E verifica o atributo técnico `data-active-realtime-collections` e confirma:

```text
Painel          → 1
Empenhos        → 3
Notas Fiscais   → 4
Relatórios      → 3
Cronogramas     → 2
Consulta Itens  → 1
Painel          → 1
```

Também exige que o estado de sincronização desapareça antes da interação da seção.

## Critério de aceite

O Bloco 14 está concluído quando:

1. `useOperationalData` não mantém as cinco coleções operacionais sempre abertas;
2. listeners opcionais são independentes por aba;
3. `empenhos` permanece realtime em todas as abas;
4. a seção não libera interação antes do primeiro snapshot requerido;
5. Browser E2E comprova os perfis de subscriptions;
6. jsPDF/autotable não são imports estáticos nos hooks operacionais;
7. testes e guards dos Blocos 9–13 permanecem verdes;
8. TypeScript, build e diff hygiene permanecem verdes.
