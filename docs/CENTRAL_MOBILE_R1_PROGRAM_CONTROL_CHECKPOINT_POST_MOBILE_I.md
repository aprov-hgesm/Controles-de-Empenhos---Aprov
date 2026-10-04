# MOBILE-R1 — CHECKPOINT PÓS-MOBILE-I

Data: **2026-10-03**

## Estado

Integrador:
`feat/central-mobile-r1`

MOBILE-I worker:
`mobile-r1-i-integration@ea5ad10054e2aea608e270a970fde723cde41d93`

Base:
`816c1c07cf251ce3705098a3a65b9d84e2fc8614`

PR:
`#245`

Integração:
`3a5689e0e613adfb7dbf48ef8d44085ec6c951b3`

Status:
**MOBILE-I APROVADA / INTEGRADA**

MOBILE-J:
**NÃO LIBERADA — AGUARDANDO PROGRAM CONTROL**

## Delta funcional

Foi encontrada e corrigida uma única regressão real de UX:
- MOBILE-E consulta física já estava funcional;
- card `Consultar localização` ainda aparecia como futura;
- card passou a navegar para `#consulta-localizacao`;
- nenhuma nova rota, domínio, schema ou API.

## Tooling

Adicionado:
- `verify:mobile-r1-integration-final`;
- step `Central Móvel R1 MOBILE-I integrated product guard`.

Nenhum gate anterior foi removido.

## Gates

No HEAD auditado `ea5ad10054e2aea608e270a970fde723cde41d93`:
- Application CI #945 SUCCESS;
- Core Protection #232 SUCCESS;
- Recovery #623 SUCCESS;
- Legal #47 SUCCESS;
- Production Build SUCCESS;
- Final TypeScript SUCCESS;
- Diff Hygiene SUCCESS;
- multi-tenant security SUCCESS;
- Central external workspace security SUCCESS;
- scanner SUCCESS;
- Integration 1 SUCCESS;
- physical query SUCCESS;
- MOBILE-C SUCCESS;
- Integration 2 SUCCESS;
- MOBILE-F SUCCESS;
- MOBILE-G SUCCESS;
- MOBILE-H SUCCESS;
- Integration 3 SUCCESS;
- MOBILE-I integrated product guard SUCCESS.

O squash da integradora não disparou novo workflow; os commits da integradora posteriores à base da worker eram documentais e o PR foi mergeado sem conflito. A certificação permanece ancorada no HEAD auditado acima.

## Jornada A–H

PASS automatizado/estrutural:
`Central Mobile → scanner → posição/material → ALLOCATE → consulta → TRANSFER → inventário → OUTBOUND → conferência`.

Nenhuma fonte de verdade paralela foi criada.

## Estoque

- ALLOCATE canônico preservado;
- TRANSFER preserva total agregado;
- inventário salva contagem sem saldo e ajusta somente após confirmação;
- OUTBOUND canônico único write da saída;
- H read-only;
- idempotência/replay preservados;
- nenhum caminho novo de saldo negativo.

## Performance

Sem regressão vs Integração 3:
- /central-mobile — 257 kB;
- /alocar — 275 kB;
- /transferir — 261 kB;
- /inventario — 271 kB;
- /saida — 265 kB;
- /conferir — 260 kB;
- Shared First Load — 104 kB.

## SaaS vivo

HEAD auditado:
`feat/saas-r1-commercializacao@750d4c69cd3f233938631bcdd22db7e397ddc50e`

Contratos idênticos/compatíveis:
- LegalAcceptanceGate;
- workspaceContext;
- platformAccess;
- platformSessionControl;
- warehouse feature flag;
- Firestore Rules;
- warehouse Rules;
- app/layout;
- inventoryRepository;
- outboundRepository.

Deltas conhecidos:
- CT-01 em `next.config.ts`: preservada para o futuro RC;
- WarehouseProtectedSurface: extensão Mobile preexistente/aceita;
- package/Application CI: tooling aditivo compatível.

Novo delta funcional:
**NENHUM**.

## HARDEN-A1

PR #244:
- OPEN / DRAFT / MERGEABLE;
- Security PASS;
- jsPDF critical tecnicamente eliminado;
- validação visual/manual dirigida ainda pendente;
- não integrado à Mobile.

## HARDEN-B

PR #237:
- OPEN / DRAFT / MERGEABLE;
- configuração técnica saudável;
- backup READY ainda pendente;
- restore isolado real ainda pendente;
- impacto Mobile: sem delta.

## CT-01

Contrato requerido:
`camera=(self), microphone=(), geolocation=()`

Preservada:
**SIM**

`next.config.ts` alterado pela MOBILE-I:
**NÃO**

Responsabilidade:
**integração SaaS / composição do futuro RC**

## Pendências físicas

Ainda pendentes:
- câmera Android real;
- câmera iPhone real;
- header HTTP efetivo do candidato publicado;
- som/vibração;
- Code128 impresso;
- COMPACT/MEDIUM/LARGE;
- jornada operacional física ponta a ponta.

## Vercel

O PR recebeu evidência de preview READY e também tentativa posterior bloqueada por `build-rate-limit`.
Nenhuma promoção/deploy produtivo foi realizada.
GitHub CI permanece a evidência técnica principal desta frente.

## Produção

**NÃO ALTERADA**

Não houve:
- merge main;
- deploy produtivo;
- Rules;
- migração;
- restore;
- alteração de usuários.

## Blockers

Blocker funcional Mobile:
**NENHUM**

Blockers globais para RC/certificação final:
- validações físicas Mobile;
- CT-01/header efetivo;
- HARDEN-A1 visual;
- HARDEN-B backup READY/restore;
- demais decisões do Program Control.

## Risco

**BAIXO / MÉDIO CONTROLADO**

## Recomendação

MOBILE-I:
**PASS / INTEGRADA**

MOBILE-J:
**APTA PARA AVALIAÇÃO PELO PROGRAM CONTROL, MAS NÃO LIBERADA**

Recomenda-se que o Program Control:
1. aceite o checkpoint MOBILE-I;
2. classifique as pendências físicas/RC;
3. decida formalmente se MOBILE-J pode ser ativada;
4. não reabra F/G/H nem MOBILE-I salvo regressão concreta.
