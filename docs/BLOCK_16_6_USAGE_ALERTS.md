# BLOCO 16.6 — ALERTAS DE CONSUMO E REFERÊNCIAS OPERACIONAIS

## Objetivo

Adicionar alertas administrativos de consumo ao EMPROVEX reutilizando as fontes já existentes, sem criar uma terceira telemetria, sem inferir cobrança oficial e sem bloquear a operação.

O Bloco 16.6 mantém três conceitos separados:

1. **métrica global real** — observada pelo Google Cloud Monitoring;
2. **estimativa interna por UG** — atribuída pelo EMPROVEX;
3. **referência operacional explícita** — valor configurado pelo operador para produzir alertas.

A referência operacional não é apresentada como franquia oficial do Firebase, nem como fatura, nem como rateio de cobrança.

## Motor de alertas

O motor reutiliza diretamente `assessUsageBudget` do Bloco 16.0.

Faixas preservadas:

- abaixo de 70%: normal;
- 70% a <85%: atenção;
- 85% a <95%: elevado;
- 95% a 100%: crítico;
- acima de 100%: excedido;
- referência não configurada: nenhum alerta é inferido.

Os alertas são somente informativos. Nenhuma operação de leitura, escrita, entrega, liquidação, sessão ou autenticação é bloqueada por consumo.

## Fontes dos alertas

### Global real

A origem é `google-cloud-monitoring`, já implementada no Bloco 16.4.

Somente reads, writes e deletes participam das referências diárias. Conexões ativas e snapshot listeners continuam visíveis como observabilidade, mas não recebem um orçamento diário artificial.

### Por UG estimado

A origem é `emprovex-workspace-estimate`, já implementada no Bloco 16.3.

Cada UG pode receber referência diária independente para:

- documentReads;
- documentWrites;
- documentDeletes.

Uma UG sem referência explícita permanece monitorada, porém não gera alerta de orçamento.

## Configuração server-side

O Bloco 16.6 não grava política de alerta no Firestore e não altera Firestore Rules.

As referências são opcionais e server-side:

`EMPROVEX_GLOBAL_DAILY_USAGE_REFERENCE_JSON`

Exemplo estrutural:

```json
{
  "documentReads": 100000,
  "documentWrites": 50000,
  "documentDeletes": 20000
}
```

`EMPROVEX_WORKSPACE_DAILY_USAGE_BUDGETS_JSON`

Exemplo estrutural:

```json
{
  "160416": {
    "documentReads": 10000,
    "documentWrites": 5000,
    "documentDeletes": 1000
  }
}
```

Os números acima são somente exemplos de formato e **não são defaults do sistema**. O código não contém franquia presumida para o banco nomeado do EMPROVEX.

Valores aceitos: inteiro positivo ou `null`. UGs precisam possuir 6 dígitos.

A leitura ocorre pela rota:

`GET /api/admin/usage-alert-policy`

A rota:

- valida Firebase ID token;
- é restrita à conta fundadora;
- usa `Cache-Control: private, no-store`;
- não escreve em Firestore;
- não expõe credenciais;
- retorna apenas as referências numéricas sanitizadas necessárias ao painel.

## Painel

O painel consolidado do Bloco 16.5 recebe uma seção adicional:

**Alertas de consumo/cotas**

A seção:

- calcula alertas apenas em memória;
- mostra a origem de cada alerta;
- identifica se o dado é global real ou estimativa por UG;
- mostra métrica, consumo, referência e percentual;
- ordena do nível mais grave para o menos grave;
- informa claramente quando nenhuma referência foi configurada;
- informa claramente quando as referências estão configuradas e nenhum limiar foi atingido.

O botão **Atualizar painel** também atualiza a política de alertas, além dos refreshes já existentes.

## Banco Firestore nomeado e cobrança

O banco monitorado permanece:

`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`

Os alertas operacionais deste bloco continuam configuráveis e independentes. A referência principal
de cobrança do banco Enterprise passou a ser exibida pelos Blocos 16.4/16.5 usando Read Units
faturáveis e a franquia diária parametrizada.

O Bloco 16.6 não calcula USD, BRL ou fatura estimada. Um alerta operacional de 95%, por exemplo,
continua significando 95% da referência configurada para aquela métrica — não 95% do valor monetário
da fatura.

## Segurança e arquitetura preservadas

O Bloco 16.6 não altera:

- Firestore Rules;
- coleções Firestore;
- autenticação híbrida;
- identidade por UG;
- isolamento multi-tenant;
- limite de sessões;
- lease e heartbeat;
- encerramento remoto;
- auditoria imutável;
- concorrência otimista;
- Google Drive;
- armazenamento de PDFs/documentos.

Vercel Blob e Firebase Storage continuam fora do armazenamento documental.

Nenhum deploy Vercel faz parte deste bloco.

## Critério de aceite

O Bloco 16.6 está concluído quando:

1. a branch parte do fechamento do 16.5;
2. alertas reutilizam `assessUsageBudget`;
3. 70/85/95/>100% são preservados;
4. global real e estimativa por UG continuam semanticamente separados;
5. ausência de referência não produz alerta falso;
6. referências são explícitas, opcionais e server-side;
7. a rota é founder-only;
8. nenhuma nova coleção, listener ou API de escrita é criada;
9. Firestore Rules permanecem inalteradas;
10. não há cálculo monetário nem franquia presumida;
11. guard do 16.6 roda na Application CI;
12. build, TypeScript, testes multi-tenant, Browser E2E e release gate permanecem verdes;
13. nenhum deploy Vercel é realizado.
