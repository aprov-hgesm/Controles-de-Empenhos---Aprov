# EMPROVEX — Bloco 8 — trilha de auditoria imutável

## Objetivo

O Bloco 8 materializa o invariante **NS-011 — Rastreabilidade**. Mutações críticas deixam de depender apenas de logs transitórios e passam a gerar eventos persistentes e append-only.

A trilha separa dois domínios:

- **operacional:** `workspaces/{workspaceId}/auditEvents/{eventId}`;
- **administrativo:** `platformAuditEvents/{eventId}`.

Essa separação preserva o isolamento multi-tenant: o administrador da plataforma não ganha, por causa da auditoria, leitura dos dados operacionais de outro setor.

## Contrato de evento

Todos os eventos usam `eventVersion = emprovex_audit_v1` e registram:

- `eventId`;
- `workspaceId`;
- `ug`;
- `operation`;
- `source`;
- `entityType`;
- `entityId`;
- `correlationId`;
- `actorUid`;
- `actorEmail`;
- `before`;
- `after`;
- `metadata`;
- `createdAt`.

O `correlationId` permite agrupar eventos originados pela mesma ação lógica.

## Imutabilidade

As Firestore Rules permitem apenas criação válida dos eventos.

```text
create: permitido sob identidade válida
update: sempre negado
delete: sempre negado
```

Nos eventos criados pelo cliente, `createdAt` usa `serverTimestamp()` e as Rules exigem equivalência com `request.time`.

O ator também é preso à sessão:

```text
actorUid == request.auth.uid
actorEmail == request.auth.token.email
```

Assim, o cliente não pode criar um evento atribuindo a ação a outro usuário.

## Eventos operacionais

O serviço central de integridade registra atomicamente:

- `ns.assign`;
- `ns.replace`;
- `ns.remove`;
- `invoice.identity_migrate`;
- `invoice.delete`;
- `invoice.bulk_delete`;
- `supplier_cnpj.migrate`.

A origem lógica é preservada:

- `manual`;
- `sag`;
- `migration`;
- `system`.

Importações SAG não possuem uma trilha paralela: ao persistirem NS, passam pelo mesmo serviço e ficam identificadas com `source = sag`.

### Atomicidade

Sempre que a mutação crítica já é executada por transação Firestore, o evento de auditoria é gravado **na mesma transação**. Se o evento não puder ser gravado, a mutação principal também não é confirmada.

Reaplicações idempotentes sem alteração material não geram evento de mudança.

## Eventos administrativos

A trilha administrativa registra:

- `sector.create`;
- `sector.profile_update`;
- `sector.status_change`;
- `sector.ug_backfill`;
- `sector.password_reset`;
- `sector.delete`.

Alterações de perfil, status e backfill de UG usam a mesma transação do diretório da plataforma.

O provisionamento server-side registra `sector.create` junto da criação do diretório. A redefinição de senha registra a conclusão depois da atualização do Firebase Auth. A exclusão registra `sector.delete` apenas depois que workspace, conta, índice de UG, locks e Firebase Auth terminam o fluxo sem pendências de recuperação.

## Privacidade e minimização

A auditoria não persiste senha, token OAuth, credenciais do Drive nem conteúdo de PDF.

Os snapshots `before` e `after` são reduzidos aos campos necessários para explicar a mutação: identidades, CNPJ, NS, UG, status e metadados de vínculo.

## Segurança multi-tenant

O Emulator comprova que:

- um setor cria evento apenas no próprio workspace;
- outro workspace não pode receber evento forjado por esse setor;
- `actorUid` não pode ser falsificado;
- evento operacional não pode ser alterado nem apagado;
- somente o administrador fundador cria eventos administrativos;
- evento administrativo também não pode ser alterado nem apagado.

## Compatibilidade

A trilha começa a valer para mutações executadas após a implantação do Bloco 8. O sistema **não fabrica eventos retroativos** para históricos anteriores.

Históricos inconsistentes continuam destinados ao Bloco 10, que poderá produzir eventos de reparo quando houver alteração efetiva.

## Critério de aceite

O Bloco 8 está pronto quando:

1. eventos operacionais críticos são atômicos com suas mutações;
2. eventos administrativos críticos são registrados;
3. Firestore Rules impedem update/delete;
4. ator, workspace e timestamp são protegidos;
5. Emulator comprova isolamento e imutabilidade;
6. existe guard permanente no CI;
7. TypeScript e build de produção permanecem verdes.
