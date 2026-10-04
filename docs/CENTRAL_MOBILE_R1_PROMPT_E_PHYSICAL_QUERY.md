# PROMPT — MOBILE-E — Consulta Física Móvel

Você é o chat trabalhador responsável **exclusivamente** pela frente:

**MOBILE-E — Consulta Física Móvel da Central Móvel R1 do EMPROVEX**


## Coordenação SaaS R1 ↔ MOBILE-R1

A SAAS-P está em execução paralela na `feat/saas-r1-commercializacao`.

Antes de alterar qualquer domínio compartilhado (Auth, workspace/UG, sessão/lease, legal gate, lifecycle, warehouseAccess, Rules, shell, contratos comuns da Central, helpers compartilhados ou package/CI comum):
- não incorpore mudanças do SaaS por conta própria;
- compare/consulte o estado canônico quando necessário;
- se sua frente tocar domínio compartilhado, registre no handoff uma seção **Impacto SAAS-R1** com arquivos afetados, mudança comportamental, necessidade de reconciliação e gates a repetir;
- qualquer conflito transversal deve ser devolvido ao Coordenador.

## Repositório
`aprov-hgesm/Controles-de-Empenhos---Aprov`

## Branch integradora
`feat/central-mobile-r1`

## Base comum congelada da Onda 2
`6852963c7aa9a1c83133239f0b929715fd316530`

## Sua branch
`mobile-r1-e-physical-query`

A branch já existe exatamente nessa base.

**Não recrie. Não faça rebase/merge de outras branches sem instrução do Coordenador.**

## 1. Leitura obrigatória

Leia Memorial, Plano Mestre, Execução Paralela, Integration Status, Handoff do Coordenador, validação da Integração 1, Testing Policy, CI Workflow e documentação da Central sobre localização, location balances, lotes, materiais e consultas.

Inspecione os repositories de leitura atuais e a telemetria/cache vigentes.

## 2. Missão exclusiva

Implementar uma capacidade **read-only**:

```text
LER POSIÇÃO
→ resolver EPX1
→ revalidar WarehouseStockPosition
→ carregar distribuição física
→ materiais
→ quantidades
→ lotes/validade
→ apresentar
```

Nenhuma escrita.

## 3. Dados

Reutilizar:
- `WarehouseMobileScanner`;
- `EXPECT_LOCATION`;
- EPX1/resolver;
- `warehouse_location_balance_v1`;
- material canônico;
- lotes vigentes;
- repositories de leitura existentes.

A consulta deve ser bounded/on-demand e não criar listener permanente desnecessário.

## 4. Conteúdo esperado

Quando disponível:
- material;
- quantidade na posição;
- unidade/apresentação útil para leitura;
- lote;
- validade;
- origem quando já existir no domínio;
- identificação da posição;
- outras informações estritamente derivadas das autoridades existentes.

Não inventar informação ausente.

## 5. Segurança

- workspace/UG revalidados;
- posição ativa;
- DEPOT não é posição de estoque;
- contexto divergente recusado;
- nenhuma leitura cross-workspace;
- falha fechada.

## 6. UX

A consulta deve responder rapidamente à pergunta:
> “O que deveria estar aqui?”

Mostrar estado vazio claramente.

Não oferecer correção mutável dentro da MOBILE-E.

## 7. Performance

Registrar:
- número aproximado de reads por consulta;
- ausência de listener contínuo;
- payload bounded;
- impacto no bundle móvel;
- reaproveitamento de cache apenas se seguro.

## 8. Testes

Cobrir:
- LOCAL;
- SUBPOSITION;
- vazio;
- múltiplos materiais;
- lotes/validade;
- posição inativa;
- DEPOT recusado;
- workspace/UG incompatível;
- ausência de escrita;
- leitura bounded.

Executar TypeScript, build, diff hygiene, Core Protection e regressões de localização/estoque pertinentes.

## 9. Fora do escopo

Não implementar:
- ALLOCATE;
- TRANSFER;
- inventário;
- OUTBOUND;
- conferência corretiva;
- escrita de saldo/ledger;
- offline sync.

## 10. Handoff

Entregar `MOBILE-E — HANDOFF` completo. Não fazer merge na integradora/main, deploy ou publicação de Rules.
