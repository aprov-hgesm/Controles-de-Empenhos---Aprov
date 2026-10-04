# SESSION-CAP-01 + RULES-AUDIT-01

## Estado

- Branch: `rc-session-cap-rules-audit`
- Base congelada: `c6c164c70a1be3e2e7e4e57b0bbf4866d61a71ce`
- Produção: intocada
- Deploy de Rules: não autorizado nesta frente
- Objetivo: remover apenas o teto artificial de duas sessões e certificar o ruleset RC.

## Inventário da arquitetura antiga

| Dependência | Contrato antigo | Risco | Tratamento SESSION-CAP-01 |
|---|---|---|---|
| `DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT` | `2` | bloqueio do 3º navegador | `null` = sem teto fixo |
| `SESSION_SLOT_IDS` | `slot-1`, `slot-2` | aquisição/lifecycle/painel limitados a dois | preservados somente como legado transitório |
| `platformSessionLease` | transação lia tombstone + 2 slots | custo e limite estrutural | tombstone + lease exato por `browserInstanceId` |
| `firestore.rules` | somente dois IDs válidos | 3ª/4ª sessão DENY | ID dinâmico vinculado a `browserInstanceId`; legado aceito |
| painel admin | filtrava `SESSION_SLOT_IDS` | sessão dinâmica invisível | lista qualquer lease válido do collection group |
| lifecycle | carregava e revogava dois slots | sessão 3+ sobreviveria à suspensão | lista todos, bloqueia autorização primeiro e revoga em lotes |
| provisioning rollback | deletes explícitos de dois slots | resíduos dinâmicos | limpeza recursiva do workspace |
| guards/E2E | exigiam exatamente 2 sessões | CI perpetuaria contrato antigo | evoluídos para 3ª/4ª ALLOW e isolamento DENY |

## Arquitetura RC

Cada instância de navegador externo usa:

`workspaces/{workspaceId}/sessionSlots/{browserInstanceId}`

O documento conserva `sessionId`, `workspaceId`, `ug`, `uid`, `accountEmail`,
`browserInstanceId`, `startedAt`, `lastSeenAt` e `expiresAt`.

### Invariantes

- o document ID dinâmico deve ser igual a `browserInstanceId`;
- uma sessão ativa não pode ser sobrescrita por identidade lógica diferente;
- múltiplas abas do mesmo navegador compartilham `browserInstanceId` e `sessionId`;
- lease permanece 30 minutos;
- heartbeat permanece 15 minutos;
- fundador continua isento do lease externo;
- tombstone continua bloqueando o mesmo `sessionId` enquanto existir;
- tenant externo não pode listar `sessionSlots`; administração pode;
- cross-workspace continua DENY;
- suspensão atualiza a autorização principal para `disabled` antes da limpeza de leases;
- leases são revogados/deletados em lotes para não depender de um limite de duas sessões.

## Compatibilidade de rollout

| Aplicação | Rules | Resultado |
|---|---|---|
| app antiga | Rules antigas | baseline histórico |
| app antiga | Rules RC | compatível via `slot-1` / `slot-2` |
| app RC | Rules RC | alvo final |
| app RC | Rules antigas | incompatível para criação de lease dinâmico |

Ordem obrigatória de rollout: **Rules RC primeiro, aplicação RC depois**.

Rollback seguro da aplicação: voltar a app antiga mantendo Rules RC.
Rollback das Rules exige primeiro rollback da aplicação; Rules antigas não aceitam leases dinâmicos.

## Expiração e retenção

Logout explícito remove o lease. O mesmo navegador reutiliza o mesmo document ID,
o que limita resíduos normais. Navegadores abandonados/crashados ainda podem deixar
documentos expirados; portanto o RC exige TTL do Firestore antes do GO produtivo.

Políticas preparadas, mas **não executadas por este worker**:

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=sessionSlots \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --enable-ttl

gcloud firestore fields ttls update expiresAt \
  --collection-group=sessionRevocations \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --enable-ttl
```

Verificação somente leitura:

```bash
gcloud firestore fields ttls list \
  --collection-group=sessionSlots \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1

gcloud firestore fields ttls list \
  --collection-group=sessionRevocations \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1
```

Sem evidência do estado real dessas duas políticas, o critério de crescimento
controlado fica pendente externo e não deve ser convertido em PASS por inferência.

## Lifecycle com N sessões

A suspensão segue a ordem de segurança:

1. desabilitar `warehouseAccess`;
2. marcar `workspace.status` e `platformAccount.status` como `disabled`;
3. revogar e deletar todas as sessões encontradas;
4. registrar auditoria.

A etapa 2 fecha a autorização antes da limpeza potencialmente longa. A limpeza usa
lotes de 180 sessões (até 360 writes tombstone+delete por commit), abaixo do limite
de 500 writes por commit. Falha posterior mantém o sistema fail-closed e retorna
`RECOVERY_REQUIRED` em vez de reabrir o Warehouse.

Na reativação, leases residuais são limpos enquanto o workspace ainda está bloqueado.

## Rules — classificação do delta SESSION-CAP-01

| Delta | Classe | Justificativa / compensação |
|---|---|---|
| IDs dinâmicos em `sessionSlots` | PERMISSIVA controlada | necessário para N sessões; binding obrigatório ao `browserInstanceId` |
| `slot-1` / `slot-2` ainda aceitos | NEUTRA/COMPAT | janela de rollout/rollback |
| LIST de `sessionSlots` para tenant removido | RESTRITIVA | evita enumeração de sessões |
| admin collection-group LIST | NEUTRA | painel administrativo já existente |
| revocation `slotId` dinâmico | PERMISSIVA controlada | necessário para encerramento individual; create continua founder/admin-only |

## Matriz mínima ALLOW/DENY adicionada

- ALLOW: `slot-1` legado e `slot-2` legado durante transição;
- ALLOW: 3ª sessão dinâmica legítima;
- ALLOW: 4ª sessão dinâmica legítima;
- ALLOW: renovação da própria sessão dinâmica;
- ALLOW: retomada de lease expirado pelo mesmo navegador;
- ALLOW: administrador listar e encerrar sessão dinâmica;
- DENY: `slot-3` como pseudo-legado;
- DENY: document ID dinâmico diferente de `browserInstanceId`;
- DENY: sobrescrever lease dinâmico ativo de outra sessão lógica;
- DENY: tenant enumerar `sessionSlots`;
- DENY: cross-workspace;
- DENY: fundador consumir lease operacional externo no workspace fundador;
- DENY: tenant criar tombstone;
- DENY: tombstone existente ser reciclado.

## Fingerprints de repositório

| Rules | `main` / R3 conhecido | pré-SESSION-CAP (`c6c164...`) | RC atual |
|---|---|---|---|
| Principal | `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299` | `57a1394c921b2ab2c15537fbfc4aaea17515b28a` | `bc91185f34bcdcb4437a4de1078d1089a09292ba` |
| Warehouse | `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2` | `6e1f1050005314db4e17cb3136409abbddb0ee91` | `6e1f1050005314db4e17cb3136409abbddb0ee91` |

Tamanho fonte atual:

- principal RC: 95.273 bytes / 2.524 linhas;
- Warehouse RC: 156.038 bytes / 3.331 linhas.

Inventário semântico estrutural do principal:

- R3/main: 115 helpers, 20 `match`, 42 formas `allow` únicas;
- pré-SESSION-CAP: 116 helpers, 20 `match`, 44 formas `allow`;
- RC atual: 118 helpers, 20 `match`, 44 formas `allow`.

Do pré-SESSION-CAP para o RC não surgiu novo namespace `match`. Foram adicionados
`isLegacySessionSlotId` e `workspaceSessionSlotBindingMatches`. O `get,list` de
`sessionSlots` para tenant/admin foi separado em `get` para tenant/admin e `list`
somente administrativo, tornando a enumeração externa mais restritiva.

No Warehouse não existe delta SESSION-CAP-01: o blob pré-SESSION-CAP e o blob RC
são idênticos (`6e1f105...`). O delta conhecido em relação a main está ligado ao
lifecycle SaaS/Mobile já reconciliado antes desta frente.

## Baseline real de produção

A consulta do ruleset realmente ativo é etapa obrigatória da RULES-AUDIT-01.
Se credenciais de leitura não estiverem disponíveis no ambiente do worker, registrar
como pendência externa; não inferir que produção é igual a `main`.

## Gates e classificação

Este documento deve ser atualizado ao final com hashes, execução de CI/Emulator,
drift, limites das Rules, riscos residuais e classificação SESSION-CAP-01 / RULES-AUDIT-01.
