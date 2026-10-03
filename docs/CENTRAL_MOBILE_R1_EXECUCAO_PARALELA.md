# EMPROVEX — Central Móvel R1 — Execução Paralela

Data: **2026-10-02**
Programa: **MOBILE-R1**
Integrador: `feat/central-mobile-r1`

## 1. Modelo oficial

> **baseline + contratos comuns → frentes independentes → ondas paralelas → handoffs → integração semântica controlada → validação integrada → certificação final**

Paralelismo não autoriza sobreposição descontrolada.

## 2. Papéis

### Coordenador / Integrador / Avaliador

Responsável por:
- baseline;
- contratos;
- branches;
- propriedade de arquivos;
- quadro vivo;
- handoffs;
- revisão de diff;
- testes;
- segurança;
- métricas;
- integração;
- conflitos semânticos;
- regressão entre ondas;
- MOBILE-I;
- MOBILE-J.

Não compete com workers.

### Worker

Cada worker:
- possui uma frente;
- possui branch exclusiva;
- lê documentos canônicos;
- confirma base/HEAD;
- declara arquivos;
- preserva contratos;
- não integra outras frentes;
- não publica produção;
- entrega handoff.

### Usuário/Fundador

Autoridade final para:
- prioridade;
- UX;
- mudança de escopo;
- contrato canônico;
- release;
- produção.

## 3. Branches

Integrador:
`feat/central-mobile-r1`

Onda 1:
- `mobile-r1-a-platform-scanner`
- `mobile-r1-b-location-labels`

Onda 2:
- `mobile-r1-c-intake-allocation`
- `mobile-r1-d-transfer`
- `mobile-r1-e-physical-query`

Onda 3:
- `mobile-r1-f-inventory`
- `mobile-r1-g-outbound`
- `mobile-r1-h-position-check`

Workers não mergeiam diretamente em `main`.

## 4. Dependências

```text
MOBILE-0
├── A ─┐
└── B ─┴→ Integração 1
          ├── C ─┐
          ├── D ─┼→ Integração 2
          └── E ─┘
                  ├── F ─┐
                  ├── G ─┼→ Integração 3
                  └── H ─┘
                           ↓
                        MOBILE-I
                           ↓
                        MOBILE-J
```

## 5. Contratos imutáveis

Preservar:
- material canônico;
- ledger append-only;
- saldo agregado oficial;
- projeção física oficial;
- lote;
- barcode;
- intake;
- TRANSFER;
- OUTBOUND;
- inventário;
- idempotência;
- isolamento;
- fail-closed;
- Core Protection;
- SaaS-I legal/access baseline.

Nenhum worker pode mudar significado desses contratos sem decisão coordenada.

## 5.1 Sincronização com o programa SaaS R1

A MOBILE-R1 e o SaaS R1 são programas paralelos com contratos parcialmente compartilhados.

Antes de abrir/integrar/certificar frente Mobile que toque Auth, workspace/UG, sessão/lease, legal gate, lifecycle, `warehouseAccess`, Rules, shell, contratos comuns da Central, helpers compartilhados ou package/CI comum:

1. consultar `feat/saas-r1-commercializacao`;
2. consultar `SAAS_R1_INTEGRATION_STATUS.md` e `SAAS_R1_COORDENADOR_HANDOFF.md`;
3. comparar semanticamente os arquivos afetados;
4. registrar se existe delta real;
5. bloquear somente se houver conflito concreto;
6. registrar **Impacto SAAS-R1** no handoff do worker quando aplicável.

Nunca sincronizar por merge/rebase cego entre integradoras.

## 6. Propriedade inicial de arquivos/áreas

### MOBILE-A
Preferência de propriedade:
- nova rota mobile;
- novos componentes `WarehouseMobile*` de shell/scanner;
- helper/hooks de câmera/scanner;
- navigation mobile estritamente nova.

Somente leitura, salvo autorização:
- repositories de estoque;
- ledger;
- intake allocation;
- outbound;
- inventory.

### MOBILE-B
Preferência:
- `lib/warehouse/labels.ts`;
- `features/warehouse/pdf/warehouseLabelsPdf.ts`;
- novos helpers de location barcode/resolver;
- testes de etiquetas/localização.

Somente leitura:
- scanner;
- ledger;
- movimentos.

### C–H
Devem preferir arquivos próprios e adapters pequenos.

Arquivos estruturais compartilhados não viram área comum de edição concorrente.

## 7. Regra de sobreposição

Se dois workers precisarem editar o mesmo arquivo:
1. Coordenador define proprietário;
2. segunda frente cria adapter/helper;
3. se impossível, ponto deixa de ser paralelo;
4. conflito fica no handoff.

## 8. Protocolo de início de worker

Antes de editar:
1. ler Memorial Oficial;
2. ler Plano Mestre MOBILE-R1;
3. ler Execução Paralela;
4. ler Integration Status;
5. ler Testing Policy;
6. ler Development CI Workflow;
7. ler documentação específica da Central;
8. confirmar branch e HEAD;
9. declarar arquivos;
10. não ampliar escopo.

## 9. Handoff

Obrigatório:

```text
MOBILE-[X] — HANDOFF

Branch:
HEAD:
Base:

Status:
APTO PARA REVISÃO / PARCIAL / BLOQUEADO

Objetivo:

Arquivos alterados:

Arquivos apenas consultados:

Contratos reutilizados:

Contratos novos:

Mudanças funcionais intencionais:

Testes:
comando -> resultado

Gates não executados:
motivo

Métricas:

Riscos:

Dependências:

Conflitos esperados:

Documentação:

Não realizado:
- merge main
- deploy produção
- escopo de outra frente
```

Sem handoff, sem integração.

## 10. Avaliação do Coordenador

Ao receber:
1. confirmar branch/HEAD/base;
2. comparar diff;
3. checar escopo;
4. contratos;
5. segurança;
6. métricas;
7. testes;
8. Rules;
9. dependências;
10. conflito com frentes abertas.

Resultado:
- APROVADA;
- APROVADA COM PENDÊNCIA;
- DEVOLVIDA;
- BLOQUEADA.

## 11. Gates por risco

Automáticos prioritários:
- typecheck;
- build;
- diff hygiene;
- testes de domínio;
- guards;
- segurança/Firestore quando aplicável;
- Core Protection.

Browser E2E:
- sob demanda;
- importante para fluxo móvel novo;
- falha de infraestrutura não equivale automaticamente a regressão funcional.

Manual:
- obrigatório para câmera/ergonomia.

## 12. Integração 1

A+B somente.

Validar:
- camera/decoder;
- tipo de código;
- resolver;
- posição;
- fallback;
- bundle desktop.

Não movimentar estoque.

## 13. Integração 2

C/D/E.

Preferência inicial:
1. E;
2. C;
3. D.

Motivo: leitura primeiro, depois mutações.

## 14. Integração 3

F/G/H.

Ordem determinada por conflitos reais.

## 15. MOBILE-I

Somente integração/glue/regressão.

Não adicionar feature.

Obrigatório revalidar upstream SaaS antes do fechamento.

## 16. MOBILE-J

Certificação final.

Não significa release automático.

## 17. Conflitos

Nunca:
- ours/theirs global;
- apagar otimização/feature alheia;
- relaxar Rule;
- alterar contrato para facilitar merge;
- duplicar fonte de verdade.

Preferir:
- adapters;
- helpers;
- interfaces estáveis;
- integração semântica.

## 18. Regra de interrupção

Worker para e reporta se encontrar:
- risco de corrupção;
- saldo paralelo;
- quebra ledger;
- isolamento;
- vulnerabilidade;
- contrato canônico incompatível;
- dependência circular;
- necessidade de offline sync;
- baseline inválido.

## 19. Troca de Coordenador

Antes de trocar:
- atualizar Integration Status;
- atualizar Handoff;
- registrar HEADs;
- registrar integrações;
- registrar conflitos resolvidos.

Novo Coordenador:
1. lê Memorial;
2. Plano;
3. Execução;
4. Status;
5. Handoff;
6. confere GitHub;
7. não reabre frente sem evidência.

## 20. Critério de sucesso do método

- workers independentes;
- escopos respeitados;
- ganhos mensuráveis;
- conflitos concentrados no Coordenador;
- integração sem reescrever frentes;
- única fonte de verdade;
- estado global documentado.
